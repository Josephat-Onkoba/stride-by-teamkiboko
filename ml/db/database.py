"""
database.py — SQLite Relational Database Manager for Stride
"""

import os
import sqlite3
import json
from datetime import datetime, date
from typing import Optional, Dict, Any, List

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "stride.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

def get_db_connection() -> sqlite3.Connection:
    """Return a connection with Row factory and foreign keys enabled."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Initializes tables from schema.sql and seeds course/weather data if needed."""
    with get_db_connection() as conn:
        # Check if training_activities has the expanded schema
        cur = conn.cursor()
        try:
            cols = [c[1] for c in cur.execute("PRAGMA table_info(training_activities)").fetchall()]
            if cols and "session_rpe_load" not in cols:
                # Safe to drop since it's an empty live-sync table
                cur.execute("DROP TABLE IF EXISTS training_activities;")
        except Exception:
            pass

        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()

        # Automatic seeding
        seed_courses_if_needed(conn)
        seed_weather_observations_if_needed(conn)

def seed_courses_if_needed(conn: sqlite3.Connection):
    """Seeds major marathon courses and calculated segments if courses table is empty."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM courses")
    if cur.fetchone()[0] > 0:
        return

    try:
        from course_utils import COURSE_PRESETS
        from feature_engineering import compute_course_segment_features
    except ImportError:
        import sys
        sys.path.insert(0, BASE_DIR)
        from course_utils import COURSE_PRESETS
        from feature_engineering import compute_course_segment_features

    with conn:
        for cid, preset in COURSE_PRESETS.items():
            profile = preset.get("elevation_profile", [])
            feats = compute_course_segment_features(profile)

            conn.execute("""
                INSERT INTO courses (
                    id, name, city, country, total_distance_km, characteristics,
                    general_heading_deg, total_ascent_m, total_descent_m,
                    net_elevation_m, course_difficulty_score, elevation_profile_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING;
            """, (
                cid,
                preset.get("name", cid.capitalize()),
                preset.get("city", ""),
                preset.get("city", "").split(",")[-1].strip() if "," in preset.get("city", "") else "",
                float(preset.get("total_distance_km", 42.195)),
                preset.get("characteristics", ""),
                float(preset.get("general_heading_deg", 0.0)),
                feats["total_ascent_m"],
                feats["total_descent_m"],
                feats["net_elevation_m"],
                feats["course_difficulty_score"],
                json.dumps(profile),
            ))

            # Insert segments
            for seg in feats.get("segments", []):
                conn.execute("""
                    INSERT INTO course_segments (
                        course_id, segment_index, start_km, end_km, distance_km,
                        start_elevation_m, end_elevation_m, elevation_change_m,
                        grade_pct, heading_deg, difficulty_weight
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(course_id, segment_index) DO NOTHING;
                """, (
                    cid,
                    seg["segment_index"],
                    seg["start_km"],
                    seg["end_km"],
                    seg["distance_km"],
                    seg["start_elevation_m"],
                    seg["end_elevation_m"],
                    seg["elevation_change_m"],
                    seg["grade_pct"],
                    float(preset.get("general_heading_deg", 0.0)),
                    seg["metabolic_cost_multiplier"],
                ))

def seed_weather_observations_if_needed(conn: sqlite3.Connection):
    """Seeds historical race weather from weather_data.csv if table is empty."""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM weather_observations")
    if cur.fetchone()[0] > 0:
        return

    csv_path = os.path.join(BASE_DIR, "data", "weather_data.csv")
    if not os.path.exists(csv_path):
        return

    try:
        from feature_engineering import calculate_dew_point, calculate_wbgt
    except ImportError:
        import sys
        sys.path.insert(0, BASE_DIR)
        from feature_engineering import calculate_dew_point, calculate_wbgt

    import csv
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        with conn:
            for row in reader:
                city = row["city"].strip().lower()
                course_map = {"boston": "boston", "berlin": "berlin", "chicago": "chicago", "nyc": "new_york"}
                cid = course_map.get(city)

                temp = float(row.get("temperature_c", 15.0))
                rh = float(row.get("relative_humidity_pct", 60.0))
                wind_mps = float(row.get("wind_speed_mps", 2.0))
                wind_deg = float(row.get("wind_direction_deg", 0.0))
                precip = float(row.get("precipitation_mm", 0.0))
                press = float(row.get("pressure_hpa", 1013.25))
                cloud = float(row.get("cloud_cover_pct", 50.0)) if row.get("cloud_cover_pct") else None

                dew = calculate_dew_point(temp, rh)
                wbgt_data = calculate_wbgt(temp, rh, wind_mps)

                conn.execute("""
                    INSERT INTO weather_observations (
                        course_id, city, observation_time, temperature_c, relative_humidity_pct,
                        dew_point_c, wbgt_c, wbgt_risk, wind_speed_mps, wind_direction_deg,
                        precipitation_mm, surface_pressure_hpa, cloud_cover_pct, source
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'historical_archive')
                """, (
                    cid,
                    city,
                    f"{row['date']} 10:00:00",
                    temp,
                    rh,
                    dew,
                    wbgt_data["wbgt_c"],
                    wbgt_data["wbgt_risk"],
                    wind_mps,
                    wind_deg,
                    precip,
                    press,
                    cloud,
                ))

def calculate_age(dob_str: str) -> int:
    """Derives age from YYYY-MM-DD string."""
    try:
        born = datetime.strptime(dob_str, "%Y-%m-%d").date()
        today = date.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except Exception:
        return 30

def time_to_seconds(t_str: Optional[str]) -> Optional[int]:
    """Converts HH:MM:SS or MM:SS to integer seconds."""
    if not t_str or not isinstance(t_str, str):
        return None
    parts = t_str.strip().split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        elif len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 1 and parts[0].isdigit():
            return int(parts[0])
    except ValueError:
        return None
    return None

def save_athlete_onboarding(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves the complete 6-section athlete onboarding profile in a single atomic transaction.
    """
    athlete_id = payload.get("athlete_id")
    email = payload.get("email", "")
    if not athlete_id:
        raise ValueError("athlete_id is required")

    # Section 1: Personal Info
    p = payload.get("personal", {})
    dob = p.get("date_of_birth", "1995-01-01")
    age = p.get("age") or calculate_age(dob)
    
    # Section 2: Running Identity
    r = payload.get("running_identity", {})
    sec_distances = r.get("secondary_race_distances", [])
    if isinstance(sec_distances, list):
        sec_distances_json = json.dumps(sec_distances)
    else:
        sec_distances_json = json.dumps([])

    # Section 3: Performance
    perf = payload.get("performance", {})
    
    # Section 4: Training Baseline
    train = payload.get("training_baseline", {})
    distrib = train.get("training_intensity_distribution")
    distrib_json = json.dumps(distrib) if distrib else None

    # Section 5: Physiology & Recovery
    phys = payload.get("physiology", {})
    rec = payload.get("recovery", {})

    # Section 6: Goals, Preferences & Nutrition
    goals = payload.get("goals", {})
    pref = payload.get("preferences", {})
    surf_distrib = pref.get("surface_distribution")
    surf_json = json.dumps(surf_distrib) if surf_distrib else None
    nut = payload.get("nutrition", {})
    health = payload.get("health", {})

    conn = get_db_connection()
    try:
        with conn:
            # 1. athletes
            conn.execute("""
                INSERT INTO athletes (id, email, onboarding_completed, updated_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    email = excluded.email,
                    onboarding_completed = 1,
                    updated_at = CURRENT_TIMESTAMP;
            """, (athlete_id, email))

            # 2. athlete_profiles
            conn.execute("""
                INSERT INTO athlete_profiles (
                    athlete_id, full_name, date_of_birth, age, sex_at_birth, gender,
                    height_cm, weight_kg, country, location, timezone, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    full_name = excluded.full_name,
                    date_of_birth = excluded.date_of_birth,
                    age = excluded.age,
                    sex_at_birth = excluded.sex_at_birth,
                    gender = excluded.gender,
                    height_cm = excluded.height_cm,
                    weight_kg = excluded.weight_kg,
                    country = excluded.country,
                    location = excluded.location,
                    timezone = excluded.timezone,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                p.get("full_name", "Athlete"),
                dob,
                age,
                p.get("sex_at_birth", "male"),
                p.get("gender"),
                float(p.get("height_cm", 175)),
                float(p.get("weight_kg", 68)),
                p.get("country"),
                p.get("location"),
                p.get("timezone", "UTC"),
            ))

            # 3. athlete_running_identity
            conn.execute("""
                INSERT INTO athlete_running_identity (
                    athlete_id, competitive_level, primary_race_distance,
                    secondary_race_distances, running_experience_years,
                    marathons_completed, half_marathons_completed, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    competitive_level = excluded.competitive_level,
                    primary_race_distance = excluded.primary_race_distance,
                    secondary_race_distances = excluded.secondary_race_distances,
                    running_experience_years = excluded.running_experience_years,
                    marathons_completed = excluded.marathons_completed,
                    half_marathons_completed = excluded.half_marathons_completed,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                r.get("competitive_level", "recreational"),
                r.get("primary_race_distance", "marathon"),
                sec_distances_json,
                float(r.get("running_experience_years") or 0),
                int(r.get("marathons_completed") or 0),
                int(r.get("half_marathons_completed") or 0),
            ))

            # 4. athlete_performance
            conn.execute("""
                INSERT INTO athlete_performance (
                    athlete_id, pb_5k_sec, pb_5k_date, pb_5k_race_name,
                    pb_10k_sec, pb_10k_date, pb_10k_race_name,
                    pb_half_marathon_sec, pb_half_marathon_date, pb_half_marathon_race_name,
                    pb_marathon_sec, pb_marathon_date, pb_marathon_race_name,
                    recent_race_distance, recent_race_date, recent_race_name, recent_race_finish_time_sec,
                    recent_half_marathon_time_sec, recent_marathon_half_split_sec, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    pb_5k_sec = excluded.pb_5k_sec,
                    pb_5k_date = excluded.pb_5k_date,
                    pb_5k_race_name = excluded.pb_5k_race_name,
                    pb_10k_sec = excluded.pb_10k_sec,
                    pb_10k_date = excluded.pb_10k_date,
                    pb_10k_race_name = excluded.pb_10k_race_name,
                    pb_half_marathon_sec = excluded.pb_half_marathon_sec,
                    pb_half_marathon_date = excluded.pb_half_marathon_date,
                    pb_half_marathon_race_name = excluded.pb_half_marathon_race_name,
                    pb_marathon_sec = excluded.pb_marathon_sec,
                    pb_marathon_date = excluded.pb_marathon_date,
                    pb_marathon_race_name = excluded.pb_marathon_race_name,
                    recent_race_distance = excluded.recent_race_distance,
                    recent_race_date = excluded.recent_race_date,
                    recent_race_name = excluded.recent_race_name,
                    recent_race_finish_time_sec = excluded.recent_race_finish_time_sec,
                    recent_half_marathon_time_sec = excluded.recent_half_marathon_time_sec,
                    recent_marathon_half_split_sec = excluded.recent_marathon_half_split_sec,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                time_to_seconds(perf.get("pb_5k_time")) or perf.get("pb_5k_sec"),
                perf.get("pb_5k_date"),
                perf.get("pb_5k_race_name"),
                time_to_seconds(perf.get("pb_10k_time")) or perf.get("pb_10k_sec"),
                perf.get("pb_10k_date"),
                perf.get("pb_10k_race_name"),
                time_to_seconds(perf.get("pb_half_marathon_time")) or perf.get("pb_half_marathon_sec"),
                perf.get("pb_half_marathon_date"),
                perf.get("pb_half_marathon_race_name"),
                time_to_seconds(perf.get("pb_marathon_time")) or perf.get("pb_marathon_sec"),
                perf.get("pb_marathon_date"),
                perf.get("pb_marathon_race_name"),
                perf.get("recent_race_distance"),
                perf.get("recent_race_date"),
                perf.get("recent_race_name"),
                time_to_seconds(perf.get("recent_race_finish_time")) or perf.get("recent_race_finish_time_sec"),
                time_to_seconds(perf.get("recent_half_marathon_time")) or perf.get("recent_half_marathon_time_sec"),
                time_to_seconds(perf.get("recent_marathon_half_split")) or perf.get("recent_marathon_half_split_sec"),
            ))

            # 5. athlete_training_baseline
            conn.execute("""
                INSERT INTO athlete_training_baseline (
                    athlete_id, baseline_weekly_distance_km, baseline_runs_per_week,
                    recent_longest_run_km, baseline_weekly_duration_min,
                    baseline_avg_training_pace_minkm, training_intensity_distribution,
                    training_phase, training_plan_type, coach_supported, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    baseline_weekly_distance_km = excluded.baseline_weekly_distance_km,
                    baseline_runs_per_week = excluded.baseline_runs_per_week,
                    recent_longest_run_km = excluded.recent_longest_run_km,
                    baseline_weekly_duration_min = excluded.baseline_weekly_duration_min,
                    baseline_avg_training_pace_minkm = excluded.baseline_avg_training_pace_minkm,
                    training_intensity_distribution = excluded.training_intensity_distribution,
                    training_phase = excluded.training_phase,
                    training_plan_type = excluded.training_plan_type,
                    coach_supported = excluded.coach_supported,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                float(train.get("baseline_weekly_distance_km") or 40.0),
                int(train.get("baseline_runs_per_week") or 4),
                float(train.get("recent_longest_run_km") or 15.0),
                float(train.get("baseline_weekly_duration_min") or 240.0),
                float(train.get("baseline_avg_training_pace_minkm") or 5.5),
                distrib_json,
                train.get("training_phase", "base"),
                train.get("training_plan_type", "self_designed"),
                1 if train.get("coach_supported") else 0,
            ))

            # 6. athlete_physiology
            conn.execute("""
                INSERT INTO athlete_physiology (
                    athlete_id, resting_hr_bpm, max_hr_bpm, vo2max_ml_kg_min,
                    vo2max_source, body_fat_pct, ffm_kg, lt_hr_bpm,
                    lt_pace_minkm, threshold_pace_minkm, lab_running_economy,
                    lab_running_economy_date, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    resting_hr_bpm = excluded.resting_hr_bpm,
                    max_hr_bpm = excluded.max_hr_bpm,
                    vo2max_ml_kg_min = excluded.vo2max_ml_kg_min,
                    vo2max_source = excluded.vo2max_source,
                    body_fat_pct = excluded.body_fat_pct,
                    ffm_kg = excluded.ffm_kg,
                    lt_hr_bpm = excluded.lt_hr_bpm,
                    lt_pace_minkm = excluded.lt_pace_minkm,
                    threshold_pace_minkm = excluded.threshold_pace_minkm,
                    lab_running_economy = excluded.lab_running_economy,
                    lab_running_economy_date = excluded.lab_running_economy_date,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                phys.get("resting_hr_bpm"),
                phys.get("max_hr_bpm"),
                phys.get("vo2max_ml_kg_min"),
                phys.get("vo2max_source", "unknown"),
                phys.get("body_fat_pct"),
                phys.get("ffm_kg"),
                phys.get("lt_hr_bpm"),
                phys.get("lt_pace_minkm"),
                phys.get("threshold_pace_minkm"),
                phys.get("lab_running_economy"),
                phys.get("lab_running_economy_date"),
            ))

            # 7. athlete_recovery_baseline
            conn.execute("""
                INSERT INTO athlete_recovery_baseline (
                    athlete_id, baseline_sleep_hours, sleep_quality,
                    typical_recovery_score, typical_fatigue_score,
                    typical_stress_score, typical_motivation_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    baseline_sleep_hours = excluded.baseline_sleep_hours,
                    sleep_quality = excluded.sleep_quality,
                    typical_recovery_score = excluded.typical_recovery_score,
                    typical_fatigue_score = excluded.typical_fatigue_score,
                    typical_stress_score = excluded.typical_stress_score,
                    typical_motivation_score = excluded.typical_motivation_score,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                float(rec.get("baseline_sleep_hours") or 7.5),
                rec.get("sleep_quality", "good"),
                int(rec.get("typical_recovery_score") or 4),
                int(rec.get("typical_fatigue_score") or 2),
                int(rec.get("typical_stress_score") or 2),
                int(rec.get("typical_motivation_score") or 4),
            ))

            # 8. athlete_goals
            conn.execute("""
                INSERT INTO athlete_goals (
                    athlete_id, target_race_name, target_race_distance_km,
                    target_race_date, target_finish_time_sec,
                    primary_performance_goal, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    target_race_name = excluded.target_race_name,
                    target_race_distance_km = excluded.target_race_distance_km,
                    target_race_date = excluded.target_race_date,
                    target_finish_time_sec = excluded.target_finish_time_sec,
                    primary_performance_goal = excluded.primary_performance_goal,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                goals.get("target_race_name"),
                float(goals.get("target_race_distance_km") or 42.195),
                goals.get("target_race_date"),
                time_to_seconds(goals.get("target_finish_time")) or goals.get("target_finish_time_sec"),
                goals.get("primary_performance_goal", "finish"),
            ))

            # 9. athlete_preferences
            conn.execute("""
                INSERT INTO athlete_preferences (
                    athlete_id, primary_surface, surface_distribution,
                    typical_terrain, average_weekly_elevation_gain_m,
                    preferred_race_course, preferred_race_environment, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    primary_surface = excluded.primary_surface,
                    surface_distribution = excluded.surface_distribution,
                    typical_terrain = excluded.typical_terrain,
                    average_weekly_elevation_gain_m = excluded.average_weekly_elevation_gain_m,
                    preferred_race_course = excluded.preferred_race_course,
                    preferred_race_environment = excluded.preferred_race_environment,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                pref.get("primary_surface", "road"),
                surf_json,
                pref.get("typical_terrain", "rolling"),
                pref.get("average_weekly_elevation_gain_m"),
                pref.get("preferred_race_course", "flat"),
                pref.get("preferred_race_environment", "cool"),
            ))

            # 10. athlete_nutrition_profile
            conn.execute("""
                INSERT INTO athlete_nutrition_profile (
                    athlete_id, dietary_pattern, dietary_restrictions,
                    fueling_experience, typical_race_carbs_g_per_h,
                    typical_race_hydration, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    dietary_pattern = excluded.dietary_pattern,
                    dietary_restrictions = excluded.dietary_restrictions,
                    fueling_experience = excluded.fueling_experience,
                    typical_race_carbs_g_per_h = excluded.typical_race_carbs_g_per_h,
                    typical_race_hydration = excluded.typical_race_hydration,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                nut.get("dietary_pattern", "no_preference"),
                nut.get("dietary_restrictions"),
                nut.get("fueling_experience", "sometimes"),
                nut.get("typical_race_carbs_g_per_h"),
                nut.get("typical_race_hydration", "water_and_electrolytes"),
            ))

            # 11. athlete_health_readiness
            conn.execute("""
                INSERT INTO athlete_health_readiness (
                    athlete_id, managing_injury, training_modified_by_injury, updated_at
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(athlete_id) DO UPDATE SET
                    managing_injury = excluded.managing_injury,
                    training_modified_by_injury = excluded.training_modified_by_injury,
                    updated_at = CURRENT_TIMESTAMP;
            """, (
                athlete_id,
                health.get("managing_injury", "no"),
                health.get("training_modified_by_injury", "no"),
            ))

            # 12. If initial race results provided
            races = perf.get("race_results", [])
            for race in races:
                conn.execute("""
                    INSERT INTO athlete_race_results (
                        athlete_id, race_name, distance_km, race_date, finish_time_sec,
                        half_split_sec, elevation_gain_m, temperature_c
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    athlete_id,
                    race.get("race_name", "Race"),
                    float(race.get("distance_km", 42.195)),
                    race.get("race_date", date.today().isoformat()),
                    time_to_seconds(race.get("finish_time")) or race.get("finish_time_sec", 14400),
                    time_to_seconds(race.get("half_split")) or race.get("half_split_sec"),
                    race.get("elevation_gain_m"),
                    race.get("temperature_c"),
                ))

    finally:
        conn.close()

    return {"status": "success", "athlete_id": athlete_id}

def get_athlete_full_profile(athlete_id: str) -> Optional[Dict[str, Any]]:
    """Fetches all modular relational tables and returns a combined profile."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # athletes
        cur.execute("SELECT * FROM athletes WHERE id = ?", (athlete_id,))
        ath = cur.fetchone()
        if not ath:
            return None

        # profiles
        cur.execute("SELECT * FROM athlete_profiles WHERE athlete_id = ?", (athlete_id,))
        prof = cur.fetchone()

        # running identity
        cur.execute("SELECT * FROM athlete_running_identity WHERE athlete_id = ?", (athlete_id,))
        run_id = cur.fetchone()

        # performance
        cur.execute("SELECT * FROM athlete_performance WHERE athlete_id = ?", (athlete_id,))
        perf = cur.fetchone()

        # race results
        cur.execute("SELECT * FROM athlete_race_results WHERE athlete_id = ? ORDER BY race_date DESC LIMIT 10", (athlete_id,))
        races = [dict(r) for r in cur.fetchall()]

        # training baseline
        cur.execute("SELECT * FROM athlete_training_baseline WHERE athlete_id = ?", (athlete_id,))
        train = cur.fetchone()

        # physiology
        cur.execute("SELECT * FROM athlete_physiology WHERE athlete_id = ?", (athlete_id,))
        phys = cur.fetchone()

        # recovery
        cur.execute("SELECT * FROM athlete_recovery_baseline WHERE athlete_id = ?", (athlete_id,))
        rec = cur.fetchone()

        # goals
        cur.execute("SELECT * FROM athlete_goals WHERE athlete_id = ?", (athlete_id,))
        goals = cur.fetchone()

        # preferences
        cur.execute("SELECT * FROM athlete_preferences WHERE athlete_id = ?", (athlete_id,))
        pref = cur.fetchone()

        # nutrition
        cur.execute("SELECT * FROM athlete_nutrition_profile WHERE athlete_id = ?", (athlete_id,))
        nut = cur.fetchone()

        # health
        cur.execute("SELECT * FROM athlete_health_readiness WHERE athlete_id = ?", (athlete_id,))
        health = cur.fetchone()

        return {
            "athlete_id": ath["id"],
            "email": ath["email"],
            "onboarding_completed": bool(ath["onboarding_completed"]),
            "personal": dict(prof) if prof else {},
            "running_identity": dict(run_id) if run_id else {},
            "performance": dict(perf) if perf else {},
            "race_results": races,
            "training_baseline": dict(train) if train else {},
            "physiology": dict(phys) if phys else {},
            "recovery": dict(rec) if rec else {},
            "goals": dict(goals) if goals else {},
            "preferences": dict(pref) if pref else {},
            "nutrition": dict(nut) if nut else {},
            "health": dict(health) if health else {},
        }
    finally:
        conn.close()


# ===================================================================
# Course & Course Segment Operations
# ===================================================================

def get_all_courses() -> List[Dict[str, Any]]:
    """Retrieves all registered marathon courses."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM courses ORDER BY name ASC")
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

def get_course_details(course_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves course metadata along with its ordered segment elevation breakdown."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        course_row = cur.fetchone()
        if not course_row:
            return None
        
        cur.execute("SELECT * FROM course_segments WHERE course_id = ? ORDER BY segment_index ASC", (course_id,))
        segments = [dict(s) for s in cur.fetchall()]
        
        course_dict = dict(course_row)
        course_dict["segments"] = segments
        if course_dict.get("elevation_profile_json"):
            try:
                course_dict["elevation_profile"] = json.loads(course_dict["elevation_profile_json"])
            except Exception:
                course_dict["elevation_profile"] = []
        return course_dict
    finally:
        conn.close()

def save_course_with_segments(course: Dict[str, Any]) -> Dict[str, Any]:
    """Saves or updates a marathon course with its elevation segments."""
    cid = course.get("id") or course.get("name", "custom").lower().replace(" ", "_")
    profile = course.get("elevation_profile", [])
    
    try:
        from feature_engineering import compute_course_segment_features
    except ImportError:
        import sys
        sys.path.insert(0, BASE_DIR)
        from feature_engineering import compute_course_segment_features

    feats = compute_course_segment_features(profile)

    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO courses (
                    id, name, city, country, total_distance_km, characteristics,
                    general_heading_deg, total_ascent_m, total_descent_m,
                    net_elevation_m, course_difficulty_score, elevation_profile_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    city = excluded.city,
                    country = excluded.country,
                    total_distance_km = excluded.total_distance_km,
                    characteristics = excluded.characteristics,
                    general_heading_deg = excluded.general_heading_deg,
                    total_ascent_m = excluded.total_ascent_m,
                    total_descent_m = excluded.total_descent_m,
                    net_elevation_m = excluded.net_elevation_m,
                    course_difficulty_score = excluded.course_difficulty_score,
                    elevation_profile_json = excluded.elevation_profile_json;
            """, (
                cid,
                course.get("name", cid.capitalize()),
                course.get("city", "Unknown"),
                course.get("country", "Unknown"),
                float(course.get("total_distance_km", 42.195)),
                course.get("characteristics", ""),
                float(course.get("general_heading_deg", 0.0)),
                feats["total_ascent_m"],
                feats["total_descent_m"],
                feats["net_elevation_m"],
                feats["course_difficulty_score"],
                json.dumps(profile),
            ))

            # Replace segments
            conn.execute("DELETE FROM course_segments WHERE course_id = ?", (cid,))
            for seg in feats.get("segments", []):
                conn.execute("""
                    INSERT INTO course_segments (
                        course_id, segment_index, start_km, end_km, distance_km,
                        start_elevation_m, end_elevation_m, elevation_change_m,
                        grade_pct, heading_deg, difficulty_weight
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cid,
                    seg["segment_index"],
                    seg["start_km"],
                    seg["end_km"],
                    seg["distance_km"],
                    seg["start_elevation_m"],
                    seg["end_elevation_m"],
                    seg["elevation_change_m"],
                    seg["grade_pct"],
                    float(course.get("general_heading_deg", 0.0)),
                    seg["metabolic_cost_multiplier"],
                ))
        return {"status": "success", "course_id": cid}
    finally:
        conn.close()


# ===================================================================
# Weather Observation Operations
# ===================================================================

def save_weather_observation(obs: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves an environmental observation, automatically deriving dew point,
    Liljegren WBGT, and thermal heat risk.
    """
    try:
        from feature_engineering import calculate_dew_point, calculate_wbgt
    except ImportError:
        import sys
        sys.path.insert(0, BASE_DIR)
        from feature_engineering import calculate_dew_point, calculate_wbgt

    temp = float(obs.get("temperature_c", 15.0))
    rh = float(obs.get("relative_humidity_pct", 50.0))
    wind_mps = float(obs.get("wind_speed_mps", 2.0))
    wind_deg = float(obs.get("wind_direction_deg", 0.0))
    obs_time = obs.get("observation_time") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    dew = calculate_dew_point(temp, rh)
    wbgt_info = calculate_wbgt(temp, rh, wind_mps)

    conn = get_db_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO weather_observations (
                    course_id, city, latitude, longitude, observation_time,
                    temperature_c, relative_humidity_pct, dew_point_c, wbgt_c,
                    wbgt_risk, wind_speed_mps, wind_direction_deg, precipitation_mm,
                    surface_pressure_hpa, cloud_cover_pct, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                obs.get("course_id"),
                obs.get("city", "Unknown"),
                obs.get("latitude"),
                obs.get("longitude"),
                obs_time,
                temp,
                rh,
                dew,
                wbgt_info["wbgt_c"],
                wbgt_info["wbgt_risk"],
                wind_mps,
                wind_deg,
                float(obs.get("precipitation_mm", 0.0)),
                float(obs.get("surface_pressure_hpa", 1013.25)),
                obs.get("cloud_cover_pct"),
                obs.get("source", "manual"),
            ))
            obs_id = cur.lastrowid
        return {
            "status": "success",
            "observation_id": obs_id,
            "dew_point_c": dew,
            "wbgt_c": wbgt_info["wbgt_c"],
            "wbgt_risk": wbgt_info["wbgt_risk"],
        }
    finally:
        conn.close()

def get_weather_observations(course_or_city: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves historical or real-time environmental observations."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if course_or_city:
            query_val = course_or_city.lower()
            cur.execute("""
                SELECT * FROM weather_observations
                WHERE LOWER(course_id) = ? OR LOWER(city) = ?
                ORDER BY observation_time DESC LIMIT ?
            """, (query_val, query_val, limit))
        else:
            cur.execute("SELECT * FROM weather_observations ORDER BY observation_time DESC LIMIT ?", (limit,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()


# ===================================================================
# Training Activities & Automatic ACWR Recalculation
# ===================================================================

def save_training_activity(activity: Dict[str, Any]) -> Dict[str, Any]:
    """
    Persists raw continuous activity data and automatically updates
    the athlete's longitudinal features (including ACWR).
    """
    athlete_id = activity.get("athlete_id")
    if not athlete_id:
        raise ValueError("athlete_id is required")

    import uuid
    act_id = activity.get("id") or f"act_{uuid.uuid4().hex[:10]}"
    act_date = activity.get("activity_date") or date.today().isoformat()
    dist_km = float(activity.get("distance_km", 0.0))
    dur_min = float(activity.get("duration_min", 0.0))
    rpe = activity.get("perceived_exertion")

    # Automatic pace calculation
    pace = activity.get("average_pace_minkm")
    if not pace and dist_km > 0 and dur_min > 0:
        pace = round(dur_min / dist_km, 2)

    # Automatic session RPE load
    rpe_load = activity.get("session_rpe_load")
    if rpe_load is None and rpe is not None and dur_min > 0:
        rpe_load = round(dur_min * float(rpe), 1)

    # Optional Banister TRIMP estimation
    trimp = activity.get("trimp_score")
    avg_hr = activity.get("average_hr")
    if trimp is None and avg_hr and dur_min > 0:
        # Default rest 50, max 190 if not in scope
        delta_hr = max(0.0, min(1.0, (float(avg_hr) - 50.0) / 140.0))
        trimp = round(dur_min * delta_hr * 0.64 * (2.71828 ** (1.92 * delta_hr)), 1)

    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                INSERT INTO training_activities (
                    id, athlete_id, activity_date, start_time, activity_type,
                    distance_km, duration_min, moving_duration_min, average_pace_minkm,
                    best_pace_minkm, average_hr, max_hr, hr_zone_1_min, hr_zone_2_min,
                    hr_zone_3_min, hr_zone_4_min, hr_zone_5_min, elevation_gain_m,
                    elevation_loss_m, average_cadence, temperature_c, relative_humidity_pct,
                    headwind_mps, perceived_exertion, session_rpe_load, trimp_score,
                    feeling_score, gps_route_json, source, external_id, notes
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                ON CONFLICT(id) DO UPDATE SET
                    activity_date = excluded.activity_date,
                    distance_km = excluded.distance_km,
                    duration_min = excluded.duration_min,
                    average_pace_minkm = excluded.average_pace_minkm,
                    average_hr = excluded.average_hr,
                    perceived_exertion = excluded.perceived_exertion,
                    session_rpe_load = excluded.session_rpe_load,
                    trimp_score = excluded.trimp_score,
                    notes = excluded.notes;
            """, (
                act_id, athlete_id, act_date, activity.get("start_time"), activity.get("activity_type", "running"),
                dist_km, dur_min, activity.get("moving_duration_min"), pace,
                activity.get("best_pace_minkm"), avg_hr, activity.get("max_hr"),
                activity.get("hr_zone_1_min", 0.0), activity.get("hr_zone_2_min", 0.0),
                activity.get("hr_zone_3_min", 0.0), activity.get("hr_zone_4_min", 0.0),
                activity.get("hr_zone_5_min", 0.0), float(activity.get("elevation_gain_m", 0.0)),
                float(activity.get("elevation_loss_m", 0.0)), activity.get("average_cadence"),
                activity.get("temperature_c"), activity.get("relative_humidity_pct"),
                activity.get("headwind_mps"), rpe, rpe_load, trimp,
                activity.get("feeling_score"), activity.get("gps_route_json"),
                activity.get("source", "manual"), activity.get("external_id"), activity.get("notes")
            ))

        # Automatically recalculate learned longitudinal features & ACWR
        try:
            from training_features import compute_and_save_longitudinal_features
        except ImportError:
            import sys
            sys.path.insert(0, BASE_DIR)
            from training_features import compute_and_save_longitudinal_features

        features = compute_and_save_longitudinal_features(conn, athlete_id)

        return {
            "status": "success",
            "activity_id": act_id,
            "average_pace_minkm": pace,
            "session_rpe_load": rpe_load,
            "trimp_score": trimp,
            "updated_features": features,
        }
    finally:
        conn.close()

def get_athlete_activities(athlete_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves activities logged for an athlete ordered chronologically."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM training_activities
            WHERE athlete_id = ?
            ORDER BY activity_date DESC, created_at DESC
            LIMIT ?
        """, (athlete_id, limit))
        return [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

def get_athlete_longitudinal_features(athlete_id: str) -> Dict[str, Any]:
    """
    Returns the athlete's current longitudinal ML features (including ACWR).
    Recalculates from activities/baseline if not yet computed.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM athlete_longitudinal_features WHERE athlete_id = ?", (athlete_id,))
        row = cur.fetchone()
        if row:
            return dict(row)
        
        # Compute if missing
        try:
            from training_features import compute_and_save_longitudinal_features
        except ImportError:
            import sys
            sys.path.insert(0, BASE_DIR)
            from training_features import compute_and_save_longitudinal_features
            
        return compute_and_save_longitudinal_features(conn, athlete_id)
    finally:
        conn.close()

