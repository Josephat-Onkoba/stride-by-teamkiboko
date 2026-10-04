"""
feature_engineering.py — Automated Environmental, Course & Wind Feature Engineering

Automatically generates model-ready features from:
  - Raw GPS / course profiles (elevation, grade, Minetti metabolic cost, difficulty)
  - Raw weather observations (temperature, humidity, vapor pressure, WBGT, dew point)
  - Dynamic wind decomposition (course-relative headwind, crosswind, aerodynamic drag)

References:
  - Minetti AE et al. (2002): Energy cost of walking and running at extreme uphill and downhill slopes. J Appl Physiol.
  - Pugh LG (1970): Oxygen intake in track and treadmill running with observations on the effect of air resistance. J Physiol.
  - Liljegren JC et al. (2008): Modeling the wet bulb globe temperature using standard meteorological measurements.
  - Ely MR et al. (2007): Impact of weather on marathon-running performance. Med Sci Sports Exerc.
"""

import math
import numpy as np
from typing import Optional, Dict, Any, List

def calculate_dew_point(temperature_c: float, relative_humidity_pct: float) -> float:
    """Calculates dew point using the Magnus-Tetens approximation."""
    a = 17.27
    b = 237.7
    rh = max(1.0, min(float(relative_humidity_pct), 100.0))
    alpha = (a * temperature_c) / (b + temperature_c) + math.log(rh / 100.0)
    return round((b * alpha) / (a - alpha), 1)

def calculate_vapor_pressure(temperature_c: float, relative_humidity_pct: float) -> float:
    """Calculates actual vapor pressure in hPa using the Tetens formula."""
    rh = max(1.0, min(float(relative_humidity_pct), 100.0))
    es = 6.112 * math.exp((17.67 * temperature_c) / (temperature_c + 243.5))
    return es * (rh / 100.0)

def calculate_wbgt(
    temperature_c: float,
    relative_humidity_pct: float,
    wind_speed_mps: float = 1.0,
) -> Dict[str, Any]:
    """
    Estimates Wet Bulb Globe Temperature (WBGT) and classifies heat stress risk.
    """
    e = calculate_vapor_pressure(temperature_c, relative_humidity_pct)
    wbgt = 0.567 * temperature_c + 0.393 * e + 3.94
    wbgt = round(wbgt, 1)

    if wbgt < 18.0:
        risk = "LOW"
        guideline = "Ideal running conditions; low thermal strain."
    elif wbgt < 23.0:
        risk = "MODERATE"
        guideline = "Moderate heat stress; increased hydration vigilance recommended."
    elif wbgt < 28.0:
        risk = "HIGH"
        guideline = "High thermal burden; measurable aerobic slowdown expected (1.5-3%)."
    else:
        risk = "EXTREME"
        guideline = "Extreme heat risk; heavy pacing penalty (4-8+%), risk of heat exhaustion."

    return {
        "wbgt_c": wbgt,
        "wbgt_risk": risk,
        "guideline": guideline,
    }

def decompose_wind(
    wind_speed_mps: float,
    wind_direction_deg: float,
    course_heading_deg: float = 0.0,
    runner_pace_kmh: float = 12.0,
) -> Dict[str, Any]:
    """
    Decomposes meteorological wind vector into course-relative components:
      - Headwind: Positive slows the runner, negative is tailwind assist
      - Crosswind: Perpendicular lateral force
      - Aerodynamic drag penalty based on Pugh (1970)
    """
    # Wind angle relative to runner course direction
    # wind_direction is direction wind is blowing FROM
    rel_angle_deg = (wind_direction_deg - course_heading_deg) % 360.0
    rel_rad = math.radians(rel_angle_deg)

    # cos(rel_rad): 1.0 when wind blows directly into runner face (headwind)
    # -1.0 when wind blows from behind (tailwind)
    headwind_mps = round(wind_speed_mps * math.cos(rel_rad), 2)
    crosswind_mps = round(abs(wind_speed_mps * math.sin(rel_rad)), 2)

    runner_mps = runner_pace_kmh / 3.6
    # Relative apparent airspeed against runner
    apparent_headwind = runner_mps + headwind_mps
    
    # Aerodynamic drag cost relative to calm conditions (Pugh 1970)
    # Drag proportional to V^2
    calm_drag = 0.004 * (runner_mps ** 2)
    actual_drag = 0.004 * max(0.0, apparent_headwind) ** 2
    drag_ratio = actual_drag / (calm_drag + 1e-5) if calm_drag > 0 else 1.0

    return {
        "relative_wind_angle_deg": round(rel_angle_deg, 1),
        "headwind_mps": headwind_mps,
        "crosswind_mps": crosswind_mps,
        "is_headwind": headwind_mps > 0.5,
        "is_tailwind": headwind_mps < -0.5,
        "aerodynamic_drag_ratio": round(drag_ratio, 2),
    }

def calculate_minetti_grade_cost(grade_pct: float) -> float:
    """
    Calculates metabolic cost of running on a gradient using Minetti et al. (2002).
    Cr(i) in J / (kg * m). For flat ground (i = 0), Cr = 3.6 J / (kg * m).
    Returns the relative energy cost multiplier (1.0 = flat).
    """
    i = grade_pct / 100.0  # slope as decimal
    # Clamp slope to physiological range studied by Minetti [-0.45 to +0.45]
    i_clamped = max(-0.45, min(0.45, i))
    
    # 5th-order polynomial from Minetti et al. (2002) Eq. 2
    cr = (
        155.4 * (i_clamped ** 5)
        - 30.4 * (i_clamped ** 4)
        - 43.3 * (i_clamped ** 3)
        + 46.3 * (i_clamped ** 2)
        + 19.5 * i_clamped
        + 3.6
    )
    # Flat ground baseline is 3.6
    return round(float(cr / 3.6), 3)

def compute_course_segment_features(elevation_profile: List[Any]) -> Dict[str, Any]:
    """
    Transforms raw waypoint elevation data into segment-level physical metrics
    and global course statistics.
    """
    if len(elevation_profile) < 2:
        return {
            "total_ascent_m": 0.0,
            "total_descent_m": 0.0,
            "net_elevation_m": 0.0,
            "mean_grade_pct": 0.0,
            "course_difficulty_score": 0.0,
            "segments": [],
        }

    total_ascent = 0.0
    total_descent = 0.0
    segments = []
    grades = []

    for idx in range(1, len(elevation_profile)):
        p_prev = elevation_profile[idx - 1]
        p_curr = elevation_profile[idx]

        start_km, start_elev = float(p_prev[0]), float(p_prev[1])
        end_km, end_elev = float(p_curr[0]), float(p_curr[1])

        dist_km = end_km - start_km
        dist_m = dist_km * 1000.0
        elev_change = end_elev - start_elev

        grade_pct = (elev_change / dist_m * 100.0) if dist_m > 0 else 0.0
        grades.append(grade_pct)

        if elev_change > 0:
            total_ascent += elev_change
        else:
            total_descent += abs(elev_change)

        minetti_mult = calculate_minetti_grade_cost(grade_pct)

        segments.append({
            "segment_index": idx - 1,
            "start_km": round(start_km, 2),
            "end_km": round(end_km, 2),
            "distance_km": round(dist_km, 2),
            "start_elevation_m": round(start_elev, 1),
            "end_elevation_m": round(end_elev, 1),
            "elevation_change_m": round(elev_change, 1),
            "grade_pct": round(grade_pct, 2),
            "metabolic_cost_multiplier": minetti_mult,
        })

    net_elev = float(elevation_profile[-1][1]) - float(elevation_profile[0][1])
    grades_arr = np.array(grades) if grades else np.array([0.0])

    # Composite course difficulty: ascent + grade variance + peak grade
    difficulty_score = (
        total_ascent * 0.4
        + float(grades_arr.std()) * 40.0
        + float(np.max(np.abs(grades_arr))) * 8.0
    )

    return {
        "total_ascent_m": round(total_ascent, 1),
        "total_descent_m": round(total_descent, 1),
        "net_elevation_m": round(net_elev, 1),
        "mean_grade_pct": round(float(grades_arr.mean()), 2),
        "max_uphill_grade_pct": round(float(grades_arr.max()), 2),
        "max_downhill_grade_pct": round(float(grades_arr.min()), 2),
        "course_difficulty_score": round(difficulty_score, 1),
        "segments": segments,
    }

def extract_environmental_features(
    temperature_c: float,
    relative_humidity_pct: float,
    wind_speed_mps: float,
    wind_direction_deg: float,
    course_heading_deg: float = 0.0,
    elevation_profile: Optional[List[Any]] = None,
    runner_pace_kmh: float = 12.0,
) -> Dict[str, Any]:
    """
    Unified Automated Feature Pipeline:
    Ingests raw course profile + weather measurements and generates
    model-ready input variables for Task 1A and Task 1B.
    """
    dew_point = calculate_dew_point(temperature_c, relative_humidity_pct)
    wbgt_info = calculate_wbgt(temperature_c, relative_humidity_pct, wind_speed_mps)
    wind_info = decompose_wind(wind_speed_mps, wind_direction_deg, course_heading_deg, runner_pace_kmh)

    # 1. Heat slowdown model (Ely et al. 2007)
    wbgt_val = wbgt_info["wbgt_c"]
    if wbgt_val > 12.0:
        heat_slowdown_pct = min(12.0, (wbgt_val - 12.0) * 0.45)
    else:
        heat_slowdown_pct = 0.0

    # 2. Headwind slowdown model
    hw = wind_info["headwind_mps"]
    if hw > 0:
        wind_slowdown_pct = min(10.0, hw * 0.8)
    else:
        # Partial tailwind benefit (capped because tailwinds don't assist 1:1)
        wind_slowdown_pct = max(-2.5, hw * 0.3)

    # 3. Elevation course features
    if elevation_profile and len(elevation_profile) >= 2:
        course_feats = compute_course_segment_features(elevation_profile)
    else:
        course_feats = {
            "total_ascent_m": 0.0,
            "total_descent_m": 0.0,
            "net_elevation_m": 0.0,
            "course_difficulty_score": 0.0,
            "segments": [],
        }

    # Grade penalty derived from ascent (approx 15-20s per 100m of net ascent)
    ascent = course_feats.get("total_ascent_m", 0.0)
    grade_slowdown_pct = min(8.0, (ascent / 42.195) * 0.02)

    total_slowdown_pct = round(heat_slowdown_pct + wind_slowdown_pct + grade_slowdown_pct, 2)

    return {
        "dew_point_c": dew_point,
        "wbgt_c": wbgt_info["wbgt_c"],
        "wbgt_risk": wbgt_info["wbgt_risk"],
        "wbgt_guideline": wbgt_info["guideline"],
        "headwind_mps": wind_info["headwind_mps"],
        "crosswind_mps": wind_info["crosswind_mps"],
        "is_headwind": wind_info["is_headwind"],
        "is_tailwind": wind_info["is_tailwind"],
        "heat_slowdown_pct": round(heat_slowdown_pct, 2),
        "wind_slowdown_pct": round(wind_slowdown_pct, 2),
        "grade_slowdown_pct": round(grade_slowdown_pct, 2),
        "total_estimated_slowdown_pct": total_slowdown_pct,
        "course_summary": {
            "total_ascent_m": course_feats.get("total_ascent_m", 0.0),
            "total_descent_m": course_feats.get("total_descent_m", 0.0),
            "net_elevation_m": course_feats.get("net_elevation_m", 0.0),
            "course_difficulty_score": course_feats.get("course_difficulty_score", 0.0),
        },
    }
