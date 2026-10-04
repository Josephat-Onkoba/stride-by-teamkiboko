"""
training_features.py — Automatic ACWR Calculation & Longitudinal ML Feature Extraction

Provides:
  - Automatic calculation of Acute:Chronic Workload Ratio (ACWR)
  - Foster's Training Monotony & Strain metrics
  - Longitudinal feature aggregation from training_activities and daily_wellness
  - Seamless hybrid baseline fallback when continuous wearable data is sparse (<7 days)
  - Clear segregation between static baseline profile data and learned dynamic features

References:
  - Gabbett TJ (2016): The training—injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med.
  - Foster C (1998): Monitoring training in athletes with reference to overtraining syndrome. Med Sci Sports Exerc.
  - Hulin et al. (2014): Spikes in acute workload are associated with increased injury risk in elite athletes.
"""

import sqlite3
import numpy as np
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List

def calculate_athlete_acwr(conn: sqlite3.Connection, athlete_id: str, as_of_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Calculates the Acute:Chronic Workload Ratio (ACWR) and related training stress markers
    strictly from objective historical activity data, without asking the athlete.
    
    Windows:
      - Acute Workload: Last 7 days (t-6 to t inclusive)
      - Chronic Workload: Last 28 days (t-27 to t inclusive), normalized to weekly average (sum / 4)
    
    Cold-Start / Hybrid Baseline:
      If fewer than 7 days of activities exist, seamlessly bootstraps from athlete_training_baseline
      to avoid division-by-zero or wild swings before the athlete uploads continuous data.
    """
    if as_of_date is None:
        target_date = date.today()
    else:
        target_date = datetime.strptime(as_of_date, "%Y-%m-%d").date()

    acute_start = target_date - timedelta(days=6)
    chronic_start = target_date - timedelta(days=27)

    cur = conn.cursor()

    # 1. Fetch activities in the 28-day window
    cur.execute("""
        SELECT activity_date, distance_km, duration_min, perceived_exertion, session_rpe_load, trimp_score
        FROM training_activities
        WHERE athlete_id = ? AND activity_date BETWEEN ? AND ?
        ORDER BY activity_date ASC
    """, (athlete_id, chronic_start.isoformat(), target_date.isoformat()))
    
    rows = cur.fetchall()
    
    # 2. Fetch baseline data for cold start if needed
    cur.execute("SELECT * FROM athlete_training_baseline WHERE athlete_id = ?", (athlete_id,))
    baseline = cur.fetchone()
    base_weekly_km = float(baseline["baseline_weekly_distance_km"]) if baseline and baseline["baseline_weekly_distance_km"] else 40.0
    base_longest_km = float(baseline["recent_longest_run_km"]) if baseline and baseline["recent_longest_run_km"] else 15.0

    # Group activities by day
    daily_distance = {}
    daily_duration = {}
    daily_rpe_load = {}
    
    current = chronic_start
    while current <= target_date:
        d_str = current.isoformat()
        daily_distance[d_str] = 0.0
        daily_duration[d_str] = 0.0
        daily_rpe_load[d_str] = 0.0
        current += timedelta(days=1)

    logged_days = set()
    all_runs = []
    
    for r in rows:
        act_date = r["activity_date"]
        dist = float(r["distance_km"] or 0)
        dur = float(r["duration_min"] or 0)
        rpe = float(r["perceived_exertion"] or 5)
        rpe_load = float(r["session_rpe_load"] or (dur * rpe) if dur > 0 else (dist * 10))
        
        if act_date in daily_distance:
            daily_distance[act_date] += dist
            daily_duration[act_date] += dur
            daily_rpe_load[act_date] += rpe_load
            logged_days.add(act_date)
            all_runs.append(dist)

    data_density_days = len(logged_days)

    # Calculate 7-day acute values
    acute_days = [(target_date - timedelta(days=i)).isoformat() for i in range(7)]
    acute_dist_arr = np.array([daily_distance[d] for d in acute_days])
    acute_distance_km = float(acute_dist_arr.sum())
    acute_duration_min = float(sum(daily_duration[d] for d in acute_days))
    acute_rpe_load = float(sum(daily_rpe_load[d] for d in acute_days))

    # Calculate 28-day chronic values
    chronic_days = [(target_date - timedelta(days=i)).isoformat() for i in range(28)]
    chronic_distance_28d = float(sum(daily_distance[d] for d in chronic_days))
    chronic_duration_28d = float(sum(daily_duration[d] for d in chronic_days))
    chronic_rpe_load_28d = float(sum(daily_rpe_load[d] for d in chronic_days))

    # Determine whether to use hybrid baseline or empirical longitudinal data
    if data_density_days < 7:
        feature_source = "hybrid_baseline"
        # Seed chronic weekly average from verified onboarding baseline
        chronic_weekly_avg_km = max(base_weekly_km, 10.0)
        # If acute activities are also 0, default acute to baseline weekly load
        if acute_distance_km == 0:
            acute_distance_km = chronic_weekly_avg_km
        acwr = round(acute_distance_km / chronic_weekly_avg_km, 2)
        rolling_longest_run_km = base_longest_km
    else:
        feature_source = "fully_wearable"
        chronic_weekly_avg_km = round(chronic_distance_28d / 4.0, 2)
        # Safe denominator minimum (5 km/wk)
        safe_chronic = max(chronic_weekly_avg_km, 5.0)
        acwr = round(acute_distance_km / safe_chronic, 2)
        rolling_longest_run_km = float(max(all_runs)) if all_runs else base_longest_km

    # Workload risk categorization (Gabbett sweet spot: 0.8 - 1.3)
    if acwr < 0.8:
        acwr_zone = "undertraining"
        acwr_risk_label = "Low training stimulus / detraining risk"
    elif 0.8 <= acwr <= 1.3:
        acwr_zone = "optimal"
        acwr_risk_label = "Optimal workload zone (sweet spot)"
    elif 1.3 < acwr <= 1.5:
        acwr_zone = "caution"
        acwr_risk_label = "Elevated workload / caution zone"
    else:
        acwr_zone = "high_risk"
        acwr_risk_label = "Acute workload spike (elevated injury risk)"

    # Foster's Training Monotony & Strain (based on acute 7 days)
    acute_mean = float(acute_dist_arr.mean())
    acute_std = float(acute_dist_arr.std())
    monotony = round(acute_mean / (acute_std + 1e-4), 2)
    training_strain = round(acute_distance_km * monotony, 1)

    return {
        "athlete_id": athlete_id,
        "as_of_date": target_date.isoformat(),
        "acute_distance_7d_km": round(acute_distance_km, 1),
        "chronic_distance_28d_km": round(chronic_distance_28d, 1),
        "chronic_weekly_avg_km": round(chronic_weekly_avg_km, 1),
        "acute_duration_7d_min": round(acute_duration_min, 1),
        "chronic_duration_28d_min": round(chronic_duration_28d, 1),
        "acute_rpe_load": round(acute_rpe_load, 1),
        "chronic_rpe_load_weekly": round(chronic_rpe_load_28d / 4.0, 1),
        "acwr": acwr,
        "acwr_zone": acwr_zone,
        "acwr_risk_label": acwr_risk_label,
        "training_monotony": monotony,
        "training_strain": training_strain,
        "rolling_longest_run_4w_km": round(rolling_longest_run_km, 1),
        "data_density_days": data_density_days,
        "feature_source": feature_source,
    }


def compute_and_save_longitudinal_features(conn: sqlite3.Connection, athlete_id: str) -> Dict[str, Any]:
    """
    Computes rolling ML features and stores them in athlete_longitudinal_features.
    Maintains a strict architectural separation between profile baseline data and
    learned longitudinal features.
    """
    acwr_data = calculate_athlete_acwr(conn, athlete_id)

    cur = conn.cursor()

    # Query recent 7-day wearable recovery metrics from daily_wellness
    target_date = date.today()
    seven_days_ago = target_date - timedelta(days=6)
    
    cur.execute("""
        SELECT AVG(sleep_hours) as avg_sleep,
               AVG(recovery_score) as avg_rec,
               AVG(hrv_rmssd) as avg_hrv,
               AVG(resting_hr) as avg_rhr
        FROM daily_wellness
        WHERE athlete_id = ? AND log_date BETWEEN ? AND ?
    """, (athlete_id, seven_days_ago.isoformat(), target_date.isoformat()))
    
    wellness = cur.fetchone()
    sleep_avg = round(float(wellness["avg_sleep"]), 1) if wellness and wellness["avg_sleep"] is not None else None
    rec_avg = round(float(wellness["avg_rec"]), 1) if wellness and wellness["avg_rec"] is not None else None
    hrv_avg = round(float(wellness["avg_hrv"]), 1) if wellness and wellness["avg_hrv"] is not None else None
    rhr_avg = round(float(wellness["avg_rhr"]), 1) if wellness and wellness["avg_rhr"] is not None else None

    # Calculate average pace in last 28 days
    four_weeks_ago = target_date - timedelta(days=27)
    cur.execute("""
        SELECT AVG(average_pace_minkm) as avg_pace,
               COUNT(*) as total_runs
        FROM training_activities
        WHERE athlete_id = ? AND activity_date BETWEEN ? AND ?
    """, (athlete_id, four_weeks_ago.isoformat(), target_date.isoformat()))
    
    pace_row = cur.fetchone()
    rolling_pace = round(float(pace_row["avg_pace"]), 2) if pace_row and pace_row["avg_pace"] is not None else None
    runs_per_week_4w = round((pace_row["total_runs"] or 0) / 4.0, 1) if pace_row else 0.0

    features = {
        **acwr_data,
        "rolling_avg_pace_minkm": rolling_pace,
        "rolling_runs_per_week_4w": runs_per_week_4w,
        "sleep_avg_7d_hours": sleep_avg,
        "recovery_avg_7d": rec_avg,
        "hrv_avg_7d": hrv_avg,
        "resting_hr_avg_7d": rhr_avg,
    }

    # Upsert into athlete_longitudinal_features
    with conn:
        conn.execute("""
            INSERT INTO athlete_longitudinal_features (
                athlete_id, last_calculated_at, rolling_7d_distance_km, rolling_28d_distance_km,
                chronic_weekly_avg_km, rolling_longest_run_4w_km, rolling_runs_per_week_4w,
                rolling_avg_pace_minkm, acute_workload, chronic_workload, acwr, acwr_zone,
                training_monotony, training_strain, sleep_avg_7d_hours, recovery_avg_7d,
                hrv_avg_7d, resting_hr_avg_7d, data_density_days, feature_source, updated_at
            ) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(athlete_id) DO UPDATE SET
                last_calculated_at = CURRENT_TIMESTAMP,
                rolling_7d_distance_km = excluded.rolling_7d_distance_km,
                rolling_28d_distance_km = excluded.rolling_28d_distance_km,
                chronic_weekly_avg_km = excluded.chronic_weekly_avg_km,
                rolling_longest_run_4w_km = excluded.rolling_longest_run_4w_km,
                rolling_runs_per_week_4w = excluded.rolling_runs_per_week_4w,
                rolling_avg_pace_minkm = excluded.rolling_avg_pace_minkm,
                acute_workload = excluded.acute_workload,
                chronic_workload = excluded.chronic_workload,
                acwr = excluded.acwr,
                acwr_zone = excluded.acwr_zone,
                training_monotony = excluded.training_monotony,
                training_strain = excluded.training_strain,
                sleep_avg_7d_hours = excluded.sleep_avg_7d_hours,
                recovery_avg_7d = excluded.recovery_avg_7d,
                hrv_avg_7d = excluded.hrv_avg_7d,
                resting_hr_avg_7d = excluded.resting_hr_avg_7d,
                data_density_days = excluded.data_density_days,
                feature_source = excluded.feature_source,
                updated_at = CURRENT_TIMESTAMP;
        """, (
            athlete_id,
            features["acute_distance_7d_km"],
            features["chronic_distance_28d_km"],
            features["chronic_weekly_avg_km"],
            features["rolling_longest_run_4w_km"],
            features["rolling_runs_per_week_4w"],
            features["rolling_avg_pace_minkm"],
            features["acute_distance_7d_km"],
            features["chronic_weekly_avg_km"],
            features["acwr"],
            features["acwr_zone"],
            features["training_monotony"],
            features["training_strain"],
            features["sleep_avg_7d_hours"],
            features["recovery_avg_7d"],
            features["hrv_avg_7d"],
            features["resting_hr_avg_7d"],
            features["data_density_days"],
            features["feature_source"],
        ))

    return features
