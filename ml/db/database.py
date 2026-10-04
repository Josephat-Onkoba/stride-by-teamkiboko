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
    """Initializes tables from schema.sql."""
    with get_db_connection() as conn:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()

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
