"""
course_utils.py — Course Profile & Elevation Engineering

Provides:
  - Pre-loaded elevation profiles for major marathon courses
  - Segment-level grade calculations
  - Cumulative difficulty scoring
  - Course heading and segment direction
  - Remaining difficulty calculation for dynamic prediction

References:
  - Minetti et al. (2002): Running energy cost changes with gradient
  - Course data sourced from official race profiles and GPX data
"""

import math
import numpy as np
from typing import Optional


# ===================================================================
# 1. Major Marathon Course Presets
# ===================================================================
# Each preset contains: name, city, total_distance_km, and a simplified
# elevation profile as (distance_km, elevation_m) waypoints.
# These are derived from published course profiles.

COURSE_PRESETS = {
    "berlin": {
        "name": "BMW Berlin Marathon",
        "city": "Berlin, Germany",
        "total_distance_km": 42.195,
        "characteristics": "Very flat, fast PB course",
        "elevation_profile": [
            (0, 37), (5, 40), (10, 38), (15, 35), (20, 38),
            (21.1, 36), (25, 34), (30, 37), (35, 40), (40, 38), (42.195, 37),
        ],
        "general_heading_deg": 90,  # Roughly east (loop course)
    },
    "london": {
        "name": "TCS London Marathon",
        "city": "London, UK",
        "total_distance_km": 42.195,
        "characteristics": "Mostly flat with gentle undulations",
        "elevation_profile": [
            (0, 10), (5, 5), (10, 3), (15, 8), (20, 12),
            (21.1, 5), (25, 3), (30, 5), (35, 10), (40, 8), (42.195, 5),
        ],
        "general_heading_deg": 270,
    },
    "chicago": {
        "name": "Bank of America Chicago Marathon",
        "city": "Chicago, USA",
        "total_distance_km": 42.195,
        "characteristics": "Extremely flat, one of the fastest courses",
        "elevation_profile": [
            (0, 181), (5, 180), (10, 179), (15, 180), (20, 181),
            (21.1, 180), (25, 179), (30, 180), (35, 181), (40, 180), (42.195, 181),
        ],
        "general_heading_deg": 180,
    },
    "new_york": {
        "name": "TCS New York City Marathon",
        "city": "New York, USA",
        "total_distance_km": 42.195,
        "characteristics": "Hilly with bridge climbs, 5-borough tour",
        "elevation_profile": [
            (0, 95), (2, 50), (5, 20), (8, 10), (10, 5),
            (13, 35), (16, 55), (18, 15), (20, 5), (21.1, 10),
            (24, 15), (26, 40), (29, 50), (32, 60), (35, 40),
            (38, 25), (40, 45), (41, 60), (42.195, 40),
        ],
        "general_heading_deg": 0,
    },
    "boston": {
        "name": "Boston Marathon",
        "city": "Boston, USA",
        "total_distance_km": 42.195,
        "characteristics": "Net downhill but with Newton Hills and Heartbreak Hill (30-34km)",
        "elevation_profile": [
            (0, 146), (5, 110), (10, 60), (13, 45), (16, 30),
            (20, 15), (21.1, 20), (24, 25), (27, 30), (30, 20),
            (31, 50), (32, 70), (33, 80), (33.8, 84),  # Heartbreak Hill summit
            (35, 60), (37, 30), (39, 15), (40, 8), (42.195, 3),
        ],
        "general_heading_deg": 90,  # Roughly east (Hopkinton → Boston)
    },
    "tokyo": {
        "name": "Tokyo Marathon",
        "city": "Tokyo, Japan",
        "total_distance_km": 42.195,
        "characteristics": "Mostly flat with gentle rolling",
        "elevation_profile": [
            (0, 33), (5, 20), (10, 8), (15, 5), (20, 3),
            (21.1, 5), (25, 3), (30, 5), (35, 8), (40, 3), (42.195, 5),
        ],
        "general_heading_deg": 180,
    },
}


# ===================================================================
# 2. Compute Course Features from Elevation Profile
# ===================================================================
def compute_course_features(elevation_profile: list[tuple], total_distance_km: float = 42.195) -> dict:
    """
    Compute comprehensive course features from an elevation profile.
    
    Args:
        elevation_profile: List of (distance_km, elevation_m) tuples
        total_distance_km: Total race distance
    
    Returns:
        Dictionary of course features for model input.
    """
    if len(elevation_profile) < 2:
        raise ValueError("Need at least 2 waypoints")
    
    distances = [p[0] for p in elevation_profile]
    elevations = [p[1] for p in elevation_profile]
    
    # Global elevation features
    total_ascent = 0.0
    total_descent = 0.0
    grades = []
    segment_distances = []
    
    for i in range(1, len(elevation_profile)):
        d_km = distances[i] - distances[i-1]
        d_m = d_km * 1000
        elev_change = elevations[i] - elevations[i-1]
        
        if d_m > 0:
            grade = (elev_change / d_m) * 100  # percent grade
            grades.append(grade)
            segment_distances.append(d_km)
        
        if elev_change > 0:
            total_ascent += elev_change
        else:
            total_descent += abs(elev_change)
    
    net_elevation = elevations[-1] - elevations[0]
    grades_arr = np.array(grades)
    seg_dist_arr = np.array(segment_distances)
    
    positive_grades = grades_arr[grades_arr > 0.1]
    negative_grades = grades_arr[grades_arr < -0.1]
    flat_grades = grades_arr[np.abs(grades_arr) <= 0.1]
    
    # Weighted percentages by distance
    total_seg_dist = seg_dist_arr.sum()
    uphill_mask = grades_arr > 0.1
    downhill_mask = grades_arr < -0.1
    flat_mask = np.abs(grades_arr) <= 0.1
    
    pct_uphill = (seg_dist_arr[uphill_mask].sum() / total_seg_dist * 100) if total_seg_dist > 0 else 0
    pct_downhill = (seg_dist_arr[downhill_mask].sum() / total_seg_dist * 100) if total_seg_dist > 0 else 0
    pct_flat = (seg_dist_arr[flat_mask].sum() / total_seg_dist * 100) if total_seg_dist > 0 else 0
    
    # Cumulative positive elevation gain (important for pacing)
    cumulative_gain = []
    running_gain = 0.0
    for i in range(1, len(elevation_profile)):
        elev_change = elevations[i] - elevations[i-1]
        if elev_change > 0:
            running_gain += elev_change
        cumulative_gain.append(running_gain)
    
    # Course difficulty score (composite)
    # Higher = more difficult. Considers ascent, grade variability, and max grades.
    difficulty = (
        total_ascent * 0.5 +
        grades_arr.std() * 50 +
        (max(abs(grades_arr.max()), abs(grades_arr.min())) if len(grades_arr) > 0 else 0) * 10
    )
    
    return {
        # Global
        "total_ascent_m": round(total_ascent, 1),
        "total_descent_m": round(total_descent, 1),
        "net_elevation_m": round(net_elevation, 1),
        "mean_elevation_m": round(np.mean(elevations), 1),
        "max_elevation_m": round(max(elevations), 1),
        "min_elevation_m": round(min(elevations), 1),
        "elevation_range_m": round(max(elevations) - min(elevations), 1),
        # Grade
        "mean_grade_pct": round(float(grades_arr.mean()), 3) if len(grades_arr) > 0 else 0,
        "positive_grade_mean_pct": round(float(positive_grades.mean()), 3) if len(positive_grades) > 0 else 0,
        "negative_grade_mean_pct": round(float(negative_grades.mean()), 3) if len(negative_grades) > 0 else 0,
        "max_uphill_grade_pct": round(float(grades_arr.max()), 3) if len(grades_arr) > 0 else 0,
        "max_downhill_grade_pct": round(float(grades_arr.min()), 3) if len(grades_arr) > 0 else 0,
        "grade_std": round(float(grades_arr.std()), 3) if len(grades_arr) > 0 else 0,
        # Distribution
        "pct_uphill": round(pct_uphill, 1),
        "pct_downhill": round(pct_downhill, 1),
        "pct_flat": round(pct_flat, 1),
        # Difficulty
        "cumulative_positive_gain_m": round(total_ascent, 1),
        "course_difficulty_score": round(difficulty, 1),
        # Raw data for visualization
        "elevation_profile": elevation_profile,
        "segment_grades": [round(g, 2) for g in grades],
    }


# ===================================================================
# 3. Remaining Course Difficulty (for dynamic/mid-race prediction)
# ===================================================================
def compute_remaining_difficulty(
    elevation_profile: list[tuple],
    current_distance_km: float,
) -> dict:
    """
    Calculate remaining course difficulty from the runner's current position.
    Useful for Model B (dynamic mid-race prediction).
    """
    remaining_profile = [(d, e) for d, e in elevation_profile if d >= current_distance_km]
    
    if len(remaining_profile) < 2:
        return {
            "remaining_distance_km": 0,
            "remaining_ascent_m": 0,
            "remaining_descent_m": 0,
            "remaining_difficulty_score": 0,
        }
    
    total_distance = remaining_profile[-1][0] - remaining_profile[0][0]
    
    remaining_ascent = 0.0
    remaining_descent = 0.0
    
    for i in range(1, len(remaining_profile)):
        elev_change = remaining_profile[i][1] - remaining_profile[i-1][1]
        if elev_change > 0:
            remaining_ascent += elev_change
        else:
            remaining_descent += abs(elev_change)
    
    difficulty = remaining_ascent * 0.5 + remaining_descent * 0.2
    
    return {
        "remaining_distance_km": round(total_distance, 2),
        "remaining_ascent_m": round(remaining_ascent, 1),
        "remaining_descent_m": round(remaining_descent, 1),
        "remaining_difficulty_score": round(difficulty, 1),
    }


# ===================================================================
# 4. Get Course Feature Vector for Model Input
# ===================================================================
def get_course_feature_vector(course_id: Optional[str] = None, custom_features: Optional[dict] = None) -> list[float]:
    """
    Get a flat feature vector suitable for model input.
    
    Returns 10 features:
      [total_ascent_m, total_descent_m, net_elevation_m,
       mean_grade_pct, max_uphill_grade_pct, max_downhill_grade_pct,
       grade_std, pct_uphill, pct_downhill, course_difficulty_score]
    """
    if course_id and course_id in COURSE_PRESETS:
        preset = COURSE_PRESETS[course_id]
        features = compute_course_features(preset["elevation_profile"])
    elif custom_features:
        features = custom_features
    else:
        # Default: flat course (neutral)
        return [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 33.3, 33.3, 0.0]
    
    return [
        features["total_ascent_m"],
        features["total_descent_m"],
        features["net_elevation_m"],
        features["mean_grade_pct"],
        features["max_uphill_grade_pct"],
        features["max_downhill_grade_pct"],
        features["grade_std"],
        features["pct_uphill"],
        features["pct_downhill"],
        features["course_difficulty_score"],
    ]


# ===================================================================
# 5. List All Available Courses
# ===================================================================
def list_courses() -> list[dict]:
    """Return summary info for all preset courses."""
    courses = []
    for cid, preset in COURSE_PRESETS.items():
        features = compute_course_features(preset["elevation_profile"])
        courses.append({
            "id": cid,
            "name": preset["name"],
            "city": preset["city"],
            "characteristics": preset["characteristics"],
            "total_ascent_m": features["total_ascent_m"],
            "total_descent_m": features["total_descent_m"],
            "net_elevation_m": features["net_elevation_m"],
            "course_difficulty_score": features["course_difficulty_score"],
        })
    return courses


if __name__ == "__main__":
    print("=== Course Profiles ===\n")
    for cid, preset in COURSE_PRESETS.items():
        features = compute_course_features(preset["elevation_profile"])
        print(f"{preset['name']}")
        print(f"  Ascent: {features['total_ascent_m']}m | Descent: {features['total_descent_m']}m | Net: {features['net_elevation_m']}m")
        print(f"  Grades: mean={features['mean_grade_pct']}% max_up={features['max_uphill_grade_pct']}% max_down={features['max_downhill_grade_pct']}%")
        print(f"  Distribution: {features['pct_uphill']}% up / {features['pct_flat']}% flat / {features['pct_downhill']}% down")
        print(f"  Difficulty Score: {features['course_difficulty_score']}")
        print()
    
    # Dynamic remaining difficulty example: Boston at 30km
    print("=== Boston Marathon: Remaining from 30km ===")
    remaining = compute_remaining_difficulty(COURSE_PRESETS["boston"]["elevation_profile"], 30.0)
    for k, v in remaining.items():
        print(f"  {k}: {v}")
