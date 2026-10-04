import os
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import requests

app = Flask(__name__)
app.secret_key = 'stride_super_secret_key' # In production, use os.environ.get('SECRET_KEY')

# ==========================================
# MySQL Database Configuration
# ==========================================
app.config['MYSQL_HOST'] = os.environ.get('MYSQL_HOST', 'localhost')
app.config['MYSQL_USER'] = os.environ.get('MYSQL_USER', 'root')
app.config['MYSQL_PASSWORD'] = os.environ.get('MYSQL_PASSWORD', '')
app.config['MYSQL_DB'] = os.environ.get('MYSQL_DB', 'stride_db')

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=app.config['MYSQL_HOST'],
            user=app.config['MYSQL_USER'],
            password=app.config['MYSQL_PASSWORD'],
            database=app.config['MYSQL_DB']
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# ==========================================
# Routes
# ==========================================

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        age = request.form.get('age', type=int)
        gender = request.form.get('gender')
        body_mass = request.form.get('body_mass', type=float)
        
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed. Please ensure MySQL is running and schema is imported.", "error")
            return redirect(url_for('signup'))
            
        cursor = conn.cursor()
        hashed_pw = generate_password_hash(password)
        
        try:
            cursor.execute('''
                INSERT INTO users (email, password_hash, age, gender, body_mass)
                VALUES (%s, %s, %s, %s, %s)
            ''', (email, hashed_pw, age, gender, body_mass))
            conn.commit()
            flash("Account created! Please log in.", "success")
            return redirect(url_for('login'))
        except mysql.connector.IntegrityError:
            flash("Email already exists.", "error")
        finally:
            cursor.close()
            conn.close()
            
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        conn = get_db_connection()
        if not conn:
            flash("Database connection failed.", "error")
            return redirect(url_for('login'))
            
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['role'] = user['role']
            session['email'] = user['email']
            if user['role'] == 'admin':
                return redirect(url_for('admin'))
            return redirect(url_for('dashboard'))
        else:
            flash("Invalid credentials.", "error")
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    activities = []
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM activities WHERE user_id = %s ORDER BY activity_date DESC", (session['user_id'],))
        activities = cursor.fetchall()
        cursor.close()
        conn.close()
        
    return render_template('dashboard.html', activities=activities)

@app.route('/upload_activity', methods=['POST'])
def upload_activity():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    if 'file' not in request.files:
        return redirect(request.url)
    
    file = request.files['file']
    if file.filename == '':
        return redirect(url_for('dashboard'))
        
    if file:
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        # Dummy parsing logic for now
        distance = request.form.get('distance', type=float, default=10.0)
        duration = request.form.get('duration', type=float, default=60.0)
        
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO activities (user_id, filename, distance_km, duration_min, activity_date)
                VALUES (%s, %s, %s, %s, NOW())
            ''', (session['user_id'], filename, distance, duration))
            conn.commit()
            cursor.close()
            conn.close()
            flash("Activity logged successfully!", "success")
            
    return redirect(url_for('dashboard'))

@app.route('/ribbon')
def race_ribbon():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    user = None
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
    # Generate mock race plan variables
    projected_time = "3h 45m"
    target_intake = "60 g/h"
    
    return render_template('ribbon.html', user=user, projected_time=projected_time, target_intake=target_intake)

@app.route('/coach')
def coach_workspace():
    if session.get('role') != 'coach':
        flash("Unauthorized. Coach access required.", "error")
        return redirect(url_for('dashboard'))
        
    conn = get_db_connection()
    athletes = []
    if conn:
        cursor = conn.cursor(dictionary=True)
        # Fetching dummy roster of all athletes for the prototype
        cursor.execute("SELECT id, email, age, gender, body_mass FROM users WHERE role = 'athlete'")
        athletes = cursor.fetchall()
        cursor.close()
        conn.close()
        
    return render_template('coach.html', athletes=athletes)

@app.route('/dev/become_coach')
def become_coach():
    """Development helper to let the current user test the coach view"""
    if 'user_id' in session:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET role='coach' WHERE id=%s", (session['user_id'],))
            conn.commit()
            cursor.close()
            conn.close()
            session['role'] = 'coach'
            flash("Developer Action: You are now a Coach!", "success")
    return redirect(url_for('coach_workspace'))

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if session.get('role') != 'admin':
        # Default behavior: if no admins exist, we let anyone access it to set it up 
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM users WHERE role = 'admin'")
            admin_count = cursor.fetchone()[0]
            if admin_count > 0:
                flash("Unauthorized. Admin access required.", "error")
                return redirect(url_for('dashboard'))
            cursor.close()
            conn.close()
        
    if request.method == 'POST':
        hf_model_url = request.form.get('hf_model_url')
        hf_api_key = request.form.get('hf_api_key')
        
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("REPLACE INTO system_config (config_key, config_value) VALUES ('hf_model_url', %s)", (hf_model_url,))
            cursor.execute("REPLACE INTO system_config (config_key, config_value) VALUES ('hf_api_key', %s)", (hf_api_key,))
            conn.commit()
            cursor.close()
            conn.close()
            flash("AI configuration updated successfully.", "success")
            
    # Fetch current configs and 'God View' stats
    config = {'hf_model_url': '', 'hf_api_key': ''}
    users_list = []
    total_activities = 0
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT config_key, config_value FROM system_config")
        for row in cursor.fetchall():
            config[row['config_key']] = row['config_value']
            
        cursor.execute("SELECT id, email, role, created_at FROM users ORDER BY created_at DESC")
        users_list = cursor.fetchall()
        
        cursor.execute("SELECT COUNT(*) as count FROM activities")
        total_activities = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
    return render_template('admin.html', config=config, users_list=users_list, total_activities=total_activities)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    half_split = data.get('half_split')
    age = data.get('age')
    category = data.get('category')
    
    if not half_split:
        return jsonify({'error': 'Missing half_split'}), 400
        
    hf_model_url = ''
    hf_api_key = ''
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT config_value FROM system_config WHERE config_key='hf_model_url'")
        url_row = cursor.fetchone()
        if url_row: hf_model_url = url_row[0]
        
        cursor.execute("SELECT config_value FROM system_config WHERE config_key='hf_api_key'")
        key_row = cursor.fetchone()
        if key_row: hf_api_key = key_row[0]
        
        cursor.close()
        conn.close()
        
    try:
        # Check if Admin has configured the AI Model
        if hf_model_url and hf_api_key and "YOUR_" not in hf_model_url:
            headers = {"Authorization": f"Bearer {hf_api_key}"}
            payload = {"inputs": {"half_split": half_split, "age": age, "category": category}}
            
            # Send to Hugging Face
            response = requests.post(hf_model_url, headers=headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                predicted_time = result.get('predicted_time', 0) # Adjust based on your model's output format
                return jsonify({
                    'predicted_finish_time': predicted_time,
                    'evidence_tag': '[V]',
                    'message': 'Prediction retrieved from Hugging Face model.'
                })
            else:
                return jsonify({
                    'predicted_finish_time': (float(half_split) * 2) + 12,
                    'evidence_tag': '[V]',
                    'message': f'Fallback (HF API returned {response.status_code})'
                })
        else:
            # Dummy Logic (Fallback when no model is connected)
            half_split_val = float(half_split)
            predicted_time = (half_split_val * 2) + 12 
            
            return jsonify({
                'predicted_finish_time': predicted_time,
                'evidence_tag': '[V]',
                'message': 'Prediction retrieved using baseline formula (Model not yet connected).'
            })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['GET', 'POST'])
def train_advisor():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    current_volume = 0
    if conn:
        cursor = conn.cursor(dictionary=True)
        # Sum distance for the user to get a mock "current weekly volume"
        cursor.execute("SELECT SUM(distance_km) as total_vol FROM activities WHERE user_id = %s", (session['user_id'],))
        vol_row = cursor.fetchone()
        if vol_row and vol_row['total_vol']:
            current_volume = round(vol_row['total_vol'], 1)
            
        cursor.close()
        conn.close()
        
    # Dummy similar cases for the "Runners Like You" CBR engine
    similar_runners = [
        {"id": "Runner 84A", "adaptation": "Added 1 interval session/week", "volume_change": "+5%"},
        {"id": "Runner 91B", "adaptation": "Increased long run by 3km", "volume_change": "+8%"},
        {"id": "Runner 12C", "adaptation": "Maintained volume, added strength work", "volume_change": "0%"}
    ]
    
    return render_template('train.html', current_volume=current_volume, similar_runners=similar_runners)

# ==========================================
# MICROSERVICE JSON API ENDPOINTS (Path A)
# ==========================================

@app.route('/api/fuel', methods=['POST'])
def api_fuel():
    """Stateless microservice endpoint for Fuel Lab math"""
    data = request.json or {}
    body_mass = float(data.get('body_mass', 70.0))
    
    pre_race_carb = round(body_mass * 8.5, 1)
    post_race_carb = round(body_mass * 1.1, 1)
    post_race_protein = round(body_mass * 0.3, 1)
    
    return jsonify({
        'pre_race_carb': pre_race_carb,
        'post_race_carb': post_race_carb,
        'post_race_protein': post_race_protein
    })

@app.route('/api/predict', methods=['POST'])
def api_predict_microservice():
    """Stateless microservice endpoint for AI predictions"""
    data = request.json or {}
    half_split = data.get('half_split')
    age = data.get('age')
    category = data.get('category')
    
    if not half_split:
        return jsonify({'error': 'Missing half_split'}), 400
        
    hf_model_url = ''
    hf_api_key = ''
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT config_value FROM system_config WHERE config_key='hf_model_url'")
        url_row = cursor.fetchone()
        if url_row: hf_model_url = url_row[0]
        
        cursor.execute("SELECT config_value FROM system_config WHERE config_key='hf_api_key'")
        key_row = cursor.fetchone()
        if key_row: hf_api_key = key_row[0]
        
        cursor.close()
        conn.close()
        
    try:
        if hf_model_url and hf_api_key and "YOUR_" not in hf_model_url:
            headers = {"Authorization": f"Bearer {hf_api_key}"}
            payload = {"inputs": {"half_split": half_split, "age": age, "category": category}}
            
            response = requests.post(hf_model_url, headers=headers, json=payload)
            if response.status_code == 200:
                result = response.json()
                predicted_time = result.get('predicted_time', 0)
                return jsonify({
                    'predicted_finish_time': predicted_time,
                    'evidence_tag': '[V]',
                    'source': 'Hugging Face Model'
                })
        
        # Fallback Math Logic
        half_split_val = float(half_split)
        predicted_time = (half_split_val * 2) + 12 
        
        return jsonify({
            'predicted_finish_time': predicted_time,
            'evidence_tag': '[V]',
            'source': 'Local Fallback Math'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/config', methods=['GET', 'POST'])
def api_admin_config():
    """Stateless microservice endpoint for managing system config"""
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'DB connection failed'}), 500

    if request.method == 'POST':
        data = request.json or {}
        hf_model_url = data.get('hf_model_url', '')
        hf_api_key = data.get('hf_api_key', '')
        cursor = conn.cursor()
        cursor.execute("REPLACE INTO system_config (config_key, config_value) VALUES ('hf_model_url', %s)", (hf_model_url,))
        cursor.execute("REPLACE INTO system_config (config_key, config_value) VALUES ('hf_api_key', %s)", (hf_api_key,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success'})

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT config_key, config_value FROM system_config")
    config = {}
    for row in cursor.fetchall():
        config[row['config_key']] = row['config_value']
    cursor.close()
    conn.close()
    return jsonify({
        'hf_model_url': config.get('hf_model_url', ''),
        'hf_api_key': config.get('hf_api_key', '')
    })

@app.route('/api/auth/signup', methods=['POST'])
def api_signup():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'athlete')
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        try:
            hashed = generate_password_hash(password)
            cursor.execute("INSERT INTO users (email, password_hash, role) VALUES (%s, %s, %s)", (email, hashed, role))
            conn.commit()
            
            cursor.execute("SELECT id, email, role FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()
            session['user_id'] = user[0]
            session['email'] = user[1]
            session['role'] = user[2]
            return jsonify({"status": "success", "user": {"id": user[0], "email": user[1], "role": user[2]}})
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        finally:
            cursor.close()
            conn.close()
    return jsonify({"error": "DB error"}), 500

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, email, password_hash, role FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['email'] = user['email']
            session['role'] = user['role']
            return jsonify({"status": "success", "user": {"id": user['id'], "email": user['email'], "role": user['role']}})
        
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/auth/me', methods=['GET'])
def api_me():
    if 'user_id' in session:
        return jsonify({"status": "success", "user": {"id": session['user_id'], "email": session.get('email'), "role": session.get('role')}})
    return jsonify({"error": "Not logged in"}), 401

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success"})

@app.route('/api/coaches', methods=['GET'])
def api_get_coaches():
    athlete_id = session.get('user_id')
    conn = get_db_connection()
    coaches = []
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id, u.email, c.status 
            FROM users u 
            LEFT JOIN coach_connections c ON u.id = c.coach_id AND c.athlete_id = %s
            WHERE u.role='coach'
        """, (athlete_id,))
        coaches = cursor.fetchall()
        cursor.close()
        conn.close()
    return jsonify(coaches)

@app.route('/api/coaches/request', methods=['POST'])
def api_coach_request():
    if 'user_id' not in session or session.get('role') != 'athlete':
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json or {}
    coach_id = data.get('coach_id')
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        # Prevent duplicates
        cursor.execute("SELECT id FROM coach_connections WHERE athlete_id = %s AND coach_id = %s", (session['user_id'], coach_id))
        if cursor.fetchone():
            return jsonify({"error": "Request already exists."}), 400
            
        cursor.execute("INSERT INTO coach_connections (athlete_id, coach_id, status) VALUES (%s, %s, 'pending')", (session['user_id'], coach_id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"status": "success"})
    return jsonify({"error": "DB error"}), 500

@app.route('/api/coaches/dashboard', methods=['GET'])
def api_coach_dashboard():
    if 'user_id' not in session or session.get('role') != 'coach':
        return jsonify({"error": "Unauthorized"}), 401
        
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor(dictionary=True)
        # Pending requests
        cursor.execute("SELECT c.id, u.email as athlete_email FROM coach_connections c JOIN users u ON c.athlete_id = u.id WHERE c.coach_id = %s AND c.status = 'pending'", (session['user_id'],))
        pending = cursor.fetchall()
        
        # Active roster
        cursor.execute("SELECT c.id, u.email as athlete_email, u.id as athlete_id FROM coach_connections c JOIN users u ON c.athlete_id = u.id WHERE c.coach_id = %s AND c.status = 'active'", (session['user_id'],))
        roster = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return jsonify({"status": "success", "pending": pending, "roster": roster})
    return jsonify({"error": "DB error"}), 500

@app.route('/api/coaches/respond', methods=['POST'])
def api_coach_respond():
    if 'user_id' not in session or session.get('role') != 'coach':
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json or {}
    connection_id = data.get('connection_id')
    action = data.get('action') # 'accept' or 'reject'
    new_status = 'active' if action == 'accept' else 'rejected'
    
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE coach_connections SET status = %s WHERE id = %s AND coach_id = %s", (new_status, connection_id, session['user_id']))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"status": "success"})
    return jsonify({"error": "DB error"}), 500

@app.route('/api/coaches/athlete/<int:athlete_id>/plan', methods=['GET', 'POST'])
def api_athlete_plan(athlete_id):
    if 'user_id' not in session or session.get('role') != 'coach':
        return jsonify({"error": "Unauthorized"}), 401
        
    coach_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "DB error"}), 500
        
    cursor = conn.cursor(dictionary=True)
    # verify connection
    cursor.execute("SELECT id FROM coach_connections WHERE athlete_id=%s AND coach_id=%s AND status='active'", (athlete_id, coach_id))
    if not cursor.fetchone():
        return jsonify({"error": "Unauthorized access to athlete"}), 403
        
    cursor.execute("CREATE TABLE IF NOT EXISTS training_plans (id INT AUTO_INCREMENT PRIMARY KEY, athlete_id INT, coach_id INT, plan_text TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)")
    
    if request.method == 'GET':
        cursor.execute("SELECT plan_text, updated_at FROM training_plans WHERE athlete_id=%s AND coach_id=%s ORDER BY id DESC LIMIT 1", (athlete_id, coach_id))
        plan = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify(plan if plan else {"plan_text": ""})
        
    elif request.method == 'POST':
        data = request.json
        plan_text = data.get('plan_text', '')
        cursor.execute("INSERT INTO training_plans (athlete_id, coach_id, plan_text) VALUES (%s, %s, %s)", (athlete_id, coach_id, plan_text))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"status": "success"})

@app.route('/fuel')
def fuel_lab():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    user = None
    if conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT body_mass FROM users WHERE id = %s", (session['user_id'],))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
    body_mass = user['body_mass'] if user and user.get('body_mass') else 70.0
    
    # Calculate Phase Targets based on physiological equations
    pre_race_carb = round(body_mass * 8.5, 1) # 8.5 g/kg/day average
    post_race_carb = round(body_mass * 1.1, 1) # 1.1 g/kg/h
    post_race_protein = round(body_mass * 0.3, 1) # 0.3 g/kg
    
    return render_template('fuel.html', 
                           body_mass=body_mass, 
                           pre_race_carb=pre_race_carb, 
                           post_race_carb=post_race_carb,
                           post_race_protein=post_race_protein)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
