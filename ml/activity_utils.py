"""
activity_utils.py — Smartwatch Activity Ingestion & Nutrition Logging

Extracts metrics from GPS/wearable exports and persists directly into the
relational SQLite database (training_activities and nutrition_logs).
Automatically triggers longitudinal feature and ACWR updates.
"""

import os
import uuid
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List

from db.database import (
    save_training_activity,
    get_athlete_activities,
    get_db_connection,
)

def process_activity_upload(file_path: str, athlete_id: str) -> Dict[str, Any]:
    """
    Parses a smartwatch CSV/FIT export (Strava, Garmin, Apple Health, Coros).
    Extracts distance, duration, heart rate, elevation, and persists
    into the SQLite training_activities table.
    """
    df = pd.read_csv(file_path)
    if len(df) == 0:
        return {"error": "Empty activity file"}

    # Extract metrics dynamically based on standard wearable column names
    dist_cols = [c for c in df.columns if 'distance' in c.lower()]
    dur_cols = [c for c in df.columns if 'duration' in c.lower() or 'time' in c.lower()]
    hr_cols = [c for c in df.columns if 'heart' in c.lower() or 'hr' in c.lower()]
    elev_cols = [c for c in df.columns if 'elevation' in c.lower() or 'gain' in c.lower()]
    cad_cols = [c for c in df.columns if 'cadence' in c.lower()]

    max_dist = float(df[dist_cols[0]].max()) if dist_cols else 10.0
    # Normalize distance if in meters
    if max_dist > 500:
        max_dist = max_dist / 1000.0

    max_dur = float(df[dur_cols[0]].max()) if dur_cols else 50.0
    # Normalize duration if in seconds
    if max_dur > 1000:
        max_dur = max_dur / 60.0

    avg_hr = float(df[hr_cols[0]].mean()) if hr_cols else None
    max_hr = float(df[hr_cols[0]].max()) if hr_cols else None
    elev_gain = float(df[elev_cols[0]].sum()) if elev_cols else 0.0
    avg_cad = float(df[cad_cols[0]].mean()) if cad_cols else None

    # Determine activity date
    act_date = date.today().isoformat()
    time_cols = [c for c in df.columns if 'timestamp' in c.lower() or 'date' in c.lower()]
    if time_cols:
        try:
            val = str(df[time_cols[0]].iloc[0])
            act_date = val.split()[0]
        except Exception:
            pass

    activity_payload = {
        "id": f"act_{uuid.uuid4().hex[:10]}",
        "athlete_id": athlete_id,
        "activity_date": act_date,
        "activity_type": "running",
        "distance_km": round(max_dist, 2),
        "duration_min": round(max_dur, 2),
        "average_hr": round(avg_hr, 1) if avg_hr else None,
        "max_hr": round(max_hr, 1) if max_hr else None,
        "elevation_gain_m": round(elev_gain, 1),
        "average_cadence": round(avg_cad, 1) if avg_cad else None,
        "source": "smartwatch_upload",
    }

    # Persist in SQLite and recalculate ACWR
    res = save_training_activity(activity_payload)

    return {
        "status": "success",
        "activity": activity_payload,
        "features": res.get("updated_features", {}),
    }

def add_nutrition_log(athlete_id: str, log: dict) -> Dict[str, Any]:
    """
    Persists nutrition intake (carbs, fluids, sodium) into SQLite nutrition_logs.
    """
    conn = get_db_connection()
    try:
        with conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO nutrition_logs (
                    athlete_id, log_date, activity_id, carbs_consumed_g,
                    fluids_consumed_ml, sodium_mg, perceived_energy
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                athlete_id,
                log.get("date") or date.today().isoformat(),
                log.get("activity_id"),
                float(log.get("carbs_g", 0)),
                float(log.get("fluid_ml", 0)),
                float(log.get("sodium_mg", 0)),
                int(log.get("perceived_energy", 5)),
            ))
            log_id = cur.lastrowid
        return {
            "status": "success",
            "id": log_id,
            "athlete_id": athlete_id,
            "carbs_consumed_g": float(log.get("carbs_g", 0)),
        }
    finally:
        conn.close()
