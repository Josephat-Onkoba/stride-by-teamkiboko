import pandas as pd
import numpy as np

# In-memory mock database of athlete activities
# In production, this would be a real database.
athlete_activities = []
athlete_nutrition_logs = []

def process_activity_upload(file_path: str, athlete_id: str):
    """
    Parses a smartwatch CSV export (e.g. Strava, Garmin, Apple Health).
    Extracts metrics: total_distance, duration, average_hr, pace.
    """
    df = pd.read_csv(file_path)
    
    if len(df) == 0:
        return {"error": "Empty activity file"}
        
    # Example format: timestamp, distance_km, duration_min, heart_rate
    max_dist = df['distance_km'].max()
    max_dur = df['duration_min'].max()
    avg_hr = df['heart_rate'].mean() if 'heart_rate' in df.columns else None
    
    activity = {
        "id": f"act_{len(athlete_activities) + 1}",
        "athlete_id": athlete_id,
        "date": df['timestamp'].iloc[0].split()[0] if 'timestamp' in df.columns else "2026-10-03",
        "distance_km": round(max_dist, 2),
        "duration_min": round(max_dur, 2),
        "average_hr": round(avg_hr, 1) if avg_hr else None,
        "pace_min_km": round(max_dur / max_dist, 2) if max_dist > 0 else 0
    }
    
    athlete_activities.append(activity)
    
    # Recalculate training volume (mock rolling 7-day)
    weekly_vol = sum(a['distance_km'] for a in athlete_activities if a['athlete_id'] == athlete_id)
    long_run = max([a['distance_km'] for a in athlete_activities if a['athlete_id'] == athlete_id] + [0])
    
    return {
        "status": "success",
        "activity": activity,
        "new_training_stats": {
            "weekly_volume_km": round(weekly_vol, 1),
            "long_run_km": round(long_run, 1)
        }
    }

def add_nutrition_log(athlete_id: str, log: dict):
    """
    Records nutrition intake (carbs, fluids, sodium) from a run.
    """
    record = {
        "id": f"nut_{len(athlete_nutrition_logs) + 1}",
        "athlete_id": athlete_id,
        "date": log.get("date", "2026-10-03"),
        "carbs_g": log.get("carbs_g", 0),
        "fluid_ml": log.get("fluid_ml", 0),
        "sodium_mg": log.get("sodium_mg", 0),
        "perceived_energy": log.get("perceived_energy", 5) # 1-10 scale
    }
    athlete_nutrition_logs.append(record)
    return {"status": "success", "log": record}
