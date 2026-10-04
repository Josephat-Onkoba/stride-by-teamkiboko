CREATE DATABASE IF NOT EXISTS stride_db;
USE stride_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'athlete', -- 'athlete', 'coach', 'admin'
    age INT,
    gender VARCHAR(10),
    body_mass FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    filename VARCHAR(255),
    distance_km FLOAT,
    duration_min FLOAT,
    activity_date DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value VARCHAR(500)
);

-- Insert default admin configuration keys
INSERT IGNORE INTO system_config (config_key, config_value) VALUES ('hf_model_url', '');
INSERT IGNORE INTO system_config (config_key, config_value) VALUES ('hf_api_key', '');

CREATE TABLE IF NOT EXISTS coach_connections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    athlete_id INT,
    coach_id INT,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
);
