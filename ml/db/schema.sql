-- ===================================================================
-- Stride Relational Database Schema (SQLite)
-- Designed for Athlete Profile, Baseline State & Continuous Learning
-- ===================================================================

PRAGMA foreign_keys = ON;

-- 1. Core Athlete Registry (Mapped to Supabase auth user_id)
CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,                       -- Supabase UUID
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    onboarding_completed BOOLEAN DEFAULT 0
);

-- 2. Section 1 — Personal Information
CREATE TABLE IF NOT EXISTS athlete_profiles (
    athlete_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    age INTEGER NOT NULL,                      -- Derived from date_of_birth
    sex_at_birth TEXT CHECK(sex_at_birth IN ('male', 'female', 'intersex')),
    gender TEXT,
    height_cm REAL NOT NULL,
    weight_kg REAL NOT NULL,
    country TEXT,
    location TEXT,                             -- City/Region
    timezone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 3. Section 2 — Running Identity
CREATE TABLE IF NOT EXISTS athlete_running_identity (
    athlete_id TEXT PRIMARY KEY,
    competitive_level TEXT CHECK(competitive_level IN ('recreational', 'competitive_amateur', 'advanced', 'elite', 'professional')),
    primary_race_distance TEXT NOT NULL,       -- e.g. '5k', '10k', 'half_marathon', 'marathon'
    secondary_race_distances TEXT,             -- JSON array of secondary distances
    running_experience_years REAL,
    marathons_completed INTEGER DEFAULT 0,
    half_marathons_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 4. Section 3 — Performance Baseline (Personal Bests & Recent Benchmarks)
CREATE TABLE IF NOT EXISTS athlete_performance (
    athlete_id TEXT PRIMARY KEY,
    -- Personal Bests
    pb_5k_sec INTEGER,
    pb_5k_date DATE,
    pb_5k_race_name TEXT,
    pb_10k_sec INTEGER,
    pb_10k_date DATE,
    pb_10k_race_name TEXT,
    pb_half_marathon_sec INTEGER,
    pb_half_marathon_date DATE,
    pb_half_marathon_race_name TEXT,
    pb_marathon_sec INTEGER,
    pb_marathon_date DATE,
    pb_marathon_race_name TEXT,
    -- Most Recent Race Performance
    recent_race_distance TEXT,
    recent_race_date DATE,
    recent_race_name TEXT,
    recent_race_finish_time_sec INTEGER,
    -- Distinct Half Marathon vs Marathon Halfway Split
    recent_half_marathon_time_sec INTEGER,     -- Standalone 21.1 km race
    recent_marathon_half_split_sec INTEGER,    -- 21.1 km split during a marathon
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 5. Section 3 — Granular Race Records & Splits
CREATE TABLE IF NOT EXISTS athlete_race_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    race_name TEXT NOT NULL,
    distance_km REAL NOT NULL,
    race_date DATE NOT NULL,
    finish_time_sec INTEGER NOT NULL,
    half_split_sec INTEGER,
    split_5k_sec INTEGER,
    split_10k_sec INTEGER,
    split_15k_sec INTEGER,
    split_20k_sec INTEGER,
    split_25k_sec INTEGER,
    split_30k_sec INTEGER,
    split_35k_sec INTEGER,
    split_40k_sec INTEGER,
    elevation_gain_m REAL,
    elevation_loss_m REAL,
    temperature_c REAL,
    humidity_pct REAL,
    wind_speed_mps REAL,
    headwind_mps REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 6. Section 4 — Current Training Baseline
CREATE TABLE IF NOT EXISTS athlete_training_baseline (
    athlete_id TEXT PRIMARY KEY,
    baseline_weekly_distance_km REAL NOT NULL,
    baseline_runs_per_week INTEGER NOT NULL,
    recent_longest_run_km REAL NOT NULL,
    baseline_weekly_duration_min REAL,
    baseline_avg_training_pace_minkm REAL,
    training_intensity_distribution TEXT,      -- JSON e.g. {"easy": 70, "long": 20, "tempo": 10}
    training_phase TEXT CHECK(training_phase IN ('base', 'build', 'peak', 'race_prep', 'taper', 'recovery', 'off_season')),
    training_plan_type TEXT CHECK(training_plan_type IN ('self_designed', 'coach', 'club', 'online_programme', 'other')),
    coach_supported BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 7. Section 5 — Physiological Baseline
CREATE TABLE IF NOT EXISTS athlete_physiology (
    athlete_id TEXT PRIMARY KEY,
    resting_hr_bpm INTEGER,
    max_hr_bpm INTEGER,
    vo2max_ml_kg_min REAL,
    vo2max_source TEXT CHECK(vo2max_source IN ('laboratory', 'wearable', 'running_watch', 'coach_assessment', 'self_reported', 'unknown')),
    body_fat_pct REAL,
    ffm_kg REAL,                               -- Fat-Free Mass
    lt_hr_bpm INTEGER,                         -- Lactate Threshold HR
    lt_pace_minkm REAL,                        -- Lactate Threshold Pace
    threshold_pace_minkm REAL,
    lab_running_economy REAL,
    lab_running_economy_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 8. Section 5 & 6 — Recovery Baseline & Wellness
CREATE TABLE IF NOT EXISTS athlete_recovery_baseline (
    athlete_id TEXT PRIMARY KEY,
    baseline_sleep_hours REAL,
    sleep_quality TEXT CHECK(sleep_quality IN ('very_poor', 'poor', 'fair', 'good', 'excellent')),
    typical_recovery_score INTEGER CHECK(typical_recovery_score BETWEEN 1 AND 5),
    typical_fatigue_score INTEGER CHECK(typical_fatigue_score BETWEEN 1 AND 5),
    typical_stress_score INTEGER CHECK(typical_stress_score BETWEEN 1 AND 5),
    typical_motivation_score INTEGER CHECK(typical_motivation_score BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 9. Section 4 & 6 — Goals & Target Event
CREATE TABLE IF NOT EXISTS athlete_goals (
    athlete_id TEXT PRIMARY KEY,
    target_race_name TEXT,
    target_race_distance_km REAL,
    target_race_date DATE,
    target_finish_time_sec INTEGER,
    primary_performance_goal TEXT CHECK(primary_performance_goal IN ('finish', 'personal_best', 'target_time', 'qualify', 'pacing', 'endurance', 'consistency')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 10. Section 6 — Training Surface, Terrain & Preferences
CREATE TABLE IF NOT EXISTS athlete_preferences (
    athlete_id TEXT PRIMARY KEY,
    primary_surface TEXT CHECK(primary_surface IN ('road', 'track', 'trail', 'treadmill', 'mixed')),
    surface_distribution TEXT,                 -- JSON e.g. {"road": 70, "trail": 20, "treadmill": 10}
    typical_terrain TEXT CHECK(typical_terrain IN ('flat', 'rolling', 'hilly', 'mountainous')),
    average_weekly_elevation_gain_m REAL,
    preferred_race_course TEXT CHECK(preferred_race_course IN ('flat', 'rolling', 'hilly', 'mountainous')),
    preferred_race_environment TEXT CHECK(preferred_race_environment IN ('cool', 'moderate', 'warm', 'no_preference')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 11. Section 6 — Nutrition Profile Baseline
CREATE TABLE IF NOT EXISTS athlete_nutrition_profile (
    athlete_id TEXT PRIMARY KEY,
    dietary_pattern TEXT CHECK(dietary_pattern IN ('no_preference', 'omnivore', 'vegetarian', 'vegan', 'other')),
    dietary_restrictions TEXT,
    fueling_experience TEXT CHECK(fueling_experience IN ('never', 'sometimes', 'usually', 'always')),
    typical_race_carbs_g_per_h REAL,
    typical_race_hydration TEXT CHECK(typical_race_hydration IN ('water_only', 'electrolyte_drink', 'water_and_electrolytes', 'other')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 12. Section 6 — Health / Injury Readiness (Scoped)
CREATE TABLE IF NOT EXISTS athlete_health_readiness (
    athlete_id TEXT PRIMARY KEY,
    managing_injury TEXT CHECK(managing_injury IN ('no', 'yes', 'prefer_not_to_say')),
    training_modified_by_injury TEXT CHECK(training_modified_by_injury IN ('no', 'yes')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 13. Dedicated Course & Elevation Storage
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,                       -- e.g. 'boston', 'berlin', 'chicago'
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    total_distance_km REAL NOT NULL DEFAULT 42.195,
    characteristics TEXT,
    general_heading_deg REAL DEFAULT 0.0,
    total_ascent_m REAL DEFAULT 0.0,
    total_descent_m REAL DEFAULT 0.0,
    net_elevation_m REAL DEFAULT 0.0,
    course_difficulty_score REAL DEFAULT 0.0,
    elevation_profile_json TEXT,               -- JSON array of [distance_km, elevation_m]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS course_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT NOT NULL,
    segment_index INTEGER NOT NULL,
    start_km REAL NOT NULL,
    end_km REAL NOT NULL,
    distance_km REAL NOT NULL,
    start_elevation_m REAL NOT NULL,
    end_elevation_m REAL NOT NULL,
    elevation_change_m REAL NOT NULL,
    grade_pct REAL NOT NULL,
    heading_deg REAL DEFAULT 0.0,
    difficulty_weight REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(course_id, segment_index)
);

-- 14. Dedicated Weather Observation Storage
CREATE TABLE IF NOT EXISTS weather_observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT,
    city TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    observation_time TIMESTAMP NOT NULL,
    temperature_c REAL NOT NULL,
    relative_humidity_pct REAL NOT NULL,
    dew_point_c REAL,
    wbgt_c REAL,
    wbgt_risk TEXT CHECK(wbgt_risk IN ('LOW', 'MODERATE', 'HIGH', 'EXTREME')),
    wind_speed_mps REAL NOT NULL,
    wind_direction_deg REAL NOT NULL,
    precipitation_mm REAL DEFAULT 0.0,
    surface_pressure_hpa REAL DEFAULT 1013.25,
    cloud_cover_pct REAL,
    source TEXT DEFAULT 'open_meteo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- 15. Continuous Longitudinal Data: Expanded Training Activities
CREATE TABLE IF NOT EXISTS training_activities (
    id TEXT PRIMARY KEY,
    athlete_id TEXT NOT NULL,
    activity_date DATE NOT NULL,
    start_time TIMESTAMP,
    activity_type TEXT DEFAULT 'running',      -- 'easy_run', 'tempo_run', 'interval', 'long_run', 'race', 'recovery_run'
    distance_km REAL NOT NULL,
    duration_min REAL NOT NULL,
    moving_duration_min REAL,
    average_pace_minkm REAL,
    best_pace_minkm REAL,
    average_hr REAL,
    max_hr REAL,
    hr_zone_1_min REAL DEFAULT 0.0,
    hr_zone_2_min REAL DEFAULT 0.0,
    hr_zone_3_min REAL DEFAULT 0.0,
    hr_zone_4_min REAL DEFAULT 0.0,
    hr_zone_5_min REAL DEFAULT 0.0,
    elevation_gain_m REAL DEFAULT 0.0,
    elevation_loss_m REAL DEFAULT 0.0,
    average_cadence REAL,
    temperature_c REAL,
    relative_humidity_pct REAL,
    headwind_mps REAL,
    perceived_exertion INTEGER,                -- RPE 1-10
    session_rpe_load REAL,                     -- duration_min * RPE
    trimp_score REAL,                          -- Banister TRIMP
    feeling_score INTEGER,                     -- 1-5
    gps_route_json TEXT,                       -- Waypoints or route coordinates
    source TEXT DEFAULT 'manual',              -- 'garmin', 'strava', 'apple', 'coros', 'manual'
    external_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_wellness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    sleep_hours REAL,
    sleep_quality INTEGER,
    resting_hr INTEGER,
    hrv_rmssd REAL,
    recovery_score INTEGER,
    fatigue_level INTEGER,
    stress_level INTEGER,
    muscle_soreness INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
    UNIQUE(athlete_id, log_date)
);

CREATE TABLE IF NOT EXISTS nutrition_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    activity_id TEXT,
    carbs_consumed_g REAL,
    fluids_consumed_ml REAL,
    sodium_mg REAL,
    perceived_energy INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- 16. Learned State: Longitudinal ML Features (Distinct from Baseline Data)
CREATE TABLE IF NOT EXISTS athlete_longitudinal_features (
    athlete_id TEXT PRIMARY KEY,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rolling_7d_distance_km REAL DEFAULT 0.0,
    rolling_28d_distance_km REAL DEFAULT 0.0,
    chronic_weekly_avg_km REAL DEFAULT 0.0,
    rolling_longest_run_4w_km REAL DEFAULT 0.0,
    rolling_runs_per_week_4w REAL DEFAULT 0.0,
    rolling_avg_pace_minkm REAL DEFAULT 0.0,
    acute_workload REAL DEFAULT 0.0,
    chronic_workload REAL DEFAULT 0.0,
    acwr REAL DEFAULT 1.0,
    acwr_zone TEXT DEFAULT 'optimal' CHECK(acwr_zone IN ('undertraining', 'optimal', 'caution', 'high_risk')),
    training_monotony REAL DEFAULT 1.0,
    training_strain REAL DEFAULT 0.0,
    sleep_avg_7d_hours REAL,
    recovery_avg_7d REAL,
    hrv_avg_7d REAL,
    resting_hr_avg_7d REAL,
    data_density_days INTEGER DEFAULT 0,
    feature_source TEXT DEFAULT 'hybrid_baseline' CHECK(feature_source IN ('hybrid_baseline', 'fully_wearable')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_athlete_race_results_athlete ON athlete_race_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_training_activities_athlete_date ON training_activities(athlete_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_daily_wellness_athlete_date ON daily_wellness(athlete_id, log_date);
CREATE INDEX IF NOT EXISTS idx_weather_course_time ON weather_observations(course_id, observation_time);
CREATE INDEX IF NOT EXISTS idx_weather_city_time ON weather_observations(city, observation_time);
CREATE INDEX IF NOT EXISTS idx_course_segments_course ON course_segments(course_id);

