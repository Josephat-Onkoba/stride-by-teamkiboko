"""
features.py — Feature Engineering Pipeline

Assembles feature vectors for the 5-model ablation study from
five feature families:

  A — Athlete Profile
  B — Training History
  C — Pace / Race State
  D — Course Profile
  E — Environment

Each model uses a progressively richer subset:
  Model A: split only (1 feature)
  Model B: split + age + gender (4 features) — current production
  Model C: Model B + course (14 features)
  Model D: Model C + weather (24 features)
  Model E: Model D + physiology/training (30+ features)
"""

from typing import Optional
from course_utils import get_course_feature_vector
from weather_utils import get_weather_feature_vector


# ===================================================================
# Feature Family Definitions
# ===================================================================

# The feature names for each model level (for documentation and column tracking)
MODEL_A_FEATURES = ["half_split_sec"]

MODEL_B_FEATURES = MODEL_A_FEATURES + ["age", "gender_M", "gender_W"]

MODEL_C_FEATURES = MODEL_B_FEATURES + [
    "total_ascent_m", "total_descent_m", "net_elevation_m",
    "mean_grade_pct", "max_uphill_grade_pct", "max_downhill_grade_pct",
    "grade_std", "pct_uphill", "pct_downhill", "course_difficulty_score",
]

MODEL_D_FEATURES = MODEL_C_FEATURES + [
    "temperature_c", "relative_humidity_pct", "dew_point_c", "wbgt_c",
    "wind_speed_mps", "headwind_mps", "crosswind_mps", "tailwind_mps",
    "precipitation_mm", "pressure_hpa",
]

MODEL_E_FEATURES = MODEL_D_FEATURES + [
    "weight_kg", "height_cm", "vo2max_estimate",
    "weekly_volume_km", "long_run_km",
    "training_weeks",
]

FEATURE_SETS = {
    "A": MODEL_A_FEATURES,
    "B": MODEL_B_FEATURES,
    "C": MODEL_C_FEATURES,
    "D": MODEL_D_FEATURES,
    "E": MODEL_E_FEATURES,
}


# ===================================================================
# Feature Vector Builders
# ===================================================================

def build_model_a_features(half_split_sec: float) -> list[float]:
    """Model A: Split only (1 feature)."""
    return [half_split_sec]


def build_model_b_features(
    half_split_sec: float,
    age: int,
    gender: str,
) -> list[float]:
    """Model B: Split + demographics (4 features). Current production model."""
    gender_M = 1.0 if gender == "M" else 0.0
    gender_W = 1.0 if gender in ("W", "F") else 0.0
    return [half_split_sec, float(age), gender_M, gender_W]


def build_model_c_features(
    half_split_sec: float,
    age: int,
    gender: str,
    course_id: Optional[str] = None,
    custom_course: Optional[dict] = None,
) -> list[float]:
    """Model C: Demographics + course (14 features)."""
    base = build_model_b_features(half_split_sec, age, gender)
    course = get_course_feature_vector(course_id, custom_course)
    return base + course


def build_model_d_features(
    half_split_sec: float,
    age: int,
    gender: str,
    # Course
    course_id: Optional[str] = None,
    custom_course: Optional[dict] = None,
    # Weather
    temperature_c: float = 12.0,
    relative_humidity_pct: float = 50.0,
    wind_speed_mps: float = 2.0,
    wind_direction_deg: float = 0.0,
    course_heading_deg: float = 0.0,
    precipitation_mm: float = 0.0,
    pressure_hpa: float = 1013.25,
) -> list[float]:
    """Model D: Demographics + course + weather (24 features)."""
    base = build_model_c_features(half_split_sec, age, gender, course_id, custom_course)
    weather = get_weather_feature_vector(
        temperature_c, relative_humidity_pct,
        wind_speed_mps, wind_direction_deg, course_heading_deg,
        precipitation_mm, pressure_hpa,
    )
    return base + weather


def build_model_e_features(
    half_split_sec: float,
    age: int,
    gender: str,
    # Course
    course_id: Optional[str] = None,
    custom_course: Optional[dict] = None,
    # Weather
    temperature_c: float = 12.0,
    relative_humidity_pct: float = 50.0,
    wind_speed_mps: float = 2.0,
    wind_direction_deg: float = 0.0,
    course_heading_deg: float = 0.0,
    precipitation_mm: float = 0.0,
    pressure_hpa: float = 1013.25,
    # Physiology / Training
    weight_kg: float = 70.0,
    height_cm: float = 175.0,
    vo2max_estimate: float = 45.0,
    weekly_volume_km: float = 50.0,
    long_run_km: float = 30.0,
    training_weeks: float = 16.0,
) -> list[float]:
    """Model E: Full enriched (30 features)."""
    base = build_model_d_features(
        half_split_sec, age, gender,
        course_id, custom_course,
        temperature_c, relative_humidity_pct,
        wind_speed_mps, wind_direction_deg, course_heading_deg,
        precipitation_mm, pressure_hpa,
    )
    physio_training = [
        weight_kg,
        height_cm,
        vo2max_estimate,
        weekly_volume_km,
        long_run_km,
        training_weeks,
    ]
    return base + physio_training


# ===================================================================
# Utility: Get feature names for any model level
# ===================================================================

def get_feature_names(model_level: str) -> list[str]:
    """Return the feature names for a given model level (A-E)."""
    return FEATURE_SETS.get(model_level.upper(), MODEL_B_FEATURES)


def get_feature_count(model_level: str) -> int:
    """Return the number of features for a given model level."""
    return len(get_feature_names(model_level.upper()))


if __name__ == "__main__":
    print("=== Feature Counts ===")
    for level in "ABCDE":
        names = get_feature_names(level)
        print(f"  Model {level}: {len(names)} features")
        for i, name in enumerate(names):
            print(f"    [{i}] {name}")
        print()
    
    print("=== Sample Feature Vectors ===\n")
    
    split_sec = 5700  # 1:35:00
    
    print(f"Model A: {build_model_a_features(split_sec)}")
    print(f"Model B: {build_model_b_features(split_sec, 28, 'M')}")
    print(f"Model C: {build_model_c_features(split_sec, 28, 'M', 'boston')}")
    print(f"Model D: {build_model_d_features(split_sec, 28, 'M', 'boston', temperature_c=15, relative_humidity_pct=60, wind_speed_mps=4, wind_direction_deg=270, course_heading_deg=90)}")
    print(f"Model E: {build_model_e_features(split_sec, 28, 'M', 'boston', temperature_c=15, relative_humidity_pct=60, wind_speed_mps=4, wind_direction_deg=270, course_heading_deg=90, weight_kg=70, vo2max_estimate=55)}")
