"""
weather_utils.py — Weather Feature Engineering

Provides:
  - Dew point calculation from temperature + relative humidity
  - WBGT (Wet Bulb Globe Temperature) estimation
  - Wind decomposition into headwind / crosswind / tailwind
  - Per-segment weather features
  - Complete weather feature vector for model input

References:
  - Liljegren et al. (2008): WBGT estimation
  - Ely et al. (2007, 2008): Marathon performance and temperature
  - El Helou et al. (2012): Weather effects on marathon performance
  - Vihma (2010): NYC Marathon weather analysis (1.28M finishers)
"""

import math
import numpy as np
from typing import Optional


# ===================================================================
# 1. Dew Point Calculation (Magnus formula)
# ===================================================================
def calculate_dew_point(temperature_c: float, relative_humidity_pct: float) -> float:
    """
    Calculate dew point using the Magnus-Tetens approximation.
    
    Dew point indicates atmospheric moisture content more reliably
    than relative humidity alone.
    
    Td = (b * α) / (a - α)
    where α = (a * T) / (b + T) + ln(RH/100)
    a = 17.27, b = 237.7
    """
    a = 17.27
    b = 237.7
    rh = max(1, min(relative_humidity_pct, 100))  # clamp
    
    alpha = (a * temperature_c) / (b + temperature_c) + math.log(rh / 100)
    dew_point = (b * alpha) / (a - alpha)
    
    return round(dew_point, 1)


# ===================================================================
# 2. WBGT Estimation (Simplified Liljegren)
# ===================================================================
def calculate_wbgt(
    temperature_c: float,
    relative_humidity_pct: float,
    wind_speed_mps: float = 1.0,
    solar_radiation_wm2: Optional[float] = None,
) -> float:
    """
    Estimate Wet Bulb Globe Temperature.
    
    Full WBGT = 0.7×Tw + 0.2×Tg + 0.1×Td
    
    Simplified (no globe thermometer):
    WBGT ≈ 0.567×T + 0.393×e + 3.94
    where e = vapor pressure (hPa)
    
    Risk categories:
      <18°C: Low risk
      18-23°C: Moderate risk
      23-28°C: High risk (performance impact expected)
      >28°C: Extreme risk (consider cancellation)
    """
    # Calculate vapor pressure
    rh = max(1, min(relative_humidity_pct, 100))
    # Saturation vapor pressure (Tetens formula)
    es = 6.112 * math.exp((17.67 * temperature_c) / (temperature_c + 243.5))
    # Actual vapor pressure
    e = es * (rh / 100)
    
    # Simplified WBGT
    wbgt = 0.567 * temperature_c + 0.393 * e + 3.94
    
    return round(wbgt, 1)


def get_wbgt_risk_category(wbgt: float) -> str:
    """Return heat risk category from WBGT."""
    if wbgt < 18:
        return "LOW"
    elif wbgt < 23:
        return "MODERATE"
    elif wbgt < 28:
        return "HIGH"
    else:
        return "EXTREME"


# ===================================================================
# 3. Wind Decomposition (Headwind / Crosswind / Tailwind)
# ===================================================================
def decompose_wind(
    wind_speed_mps: float,
    wind_direction_deg: float,
    course_heading_deg: float,
) -> dict:
    """
    Decompose wind into headwind, crosswind, and tailwind components
    relative to the runner's course heading.
    
    Args:
        wind_speed_mps: Wind speed in m/s
        wind_direction_deg: Direction wind is COMING FROM (meteorological convention)
                           0 = from north, 90 = from east, etc.
        course_heading_deg: Direction the runner is HEADING TOWARDS
                           0 = north, 90 = east, etc.
    
    Returns:
        Dictionary with headwind, crosswind, tailwind in m/s.
        headwind > 0 means runner faces wind resistance.
    
    The angle θ between the runner's heading and where the wind comes from:
    If θ < 90°: headwind (wind opposing runner)
    If θ > 90°: tailwind (wind assisting runner)
    """
    # Convert to radians
    wind_rad = math.radians(wind_direction_deg)
    course_rad = math.radians(course_heading_deg)
    
    # Relative angle: the wind is coming FROM wind_direction,
    # so the wind vector points in the opposite direction.
    # The effective wind relative to the runner:
    relative_angle = math.radians(wind_direction_deg - course_heading_deg)
    
    # Headwind component: positive = wind opposing the runner
    # cos(0°) = 1 → full headwind when wind comes from runner's heading
    headwind = wind_speed_mps * math.cos(relative_angle)
    
    # Crosswind component: magnitude of sidewind
    crosswind = abs(wind_speed_mps * math.sin(relative_angle))
    
    # Tailwind is negative headwind
    tailwind = max(0, -headwind)
    headwind = max(0, headwind)
    
    return {
        "headwind_mps": round(headwind, 2),
        "crosswind_mps": round(crosswind, 2),
        "tailwind_mps": round(tailwind, 2),
        "wind_angle_deg": round(math.degrees(relative_angle) % 360, 1),
        "wind_effect": (
            "Strong headwind" if headwind > 5 else
            "Moderate headwind" if headwind > 2 else
            "Light headwind" if headwind > 0.5 else
            "Strong tailwind" if tailwind > 5 else
            "Moderate tailwind" if tailwind > 2 else
            "Light tailwind" if tailwind > 0.5 else
            "Crosswind / calm"
        ),
    }


# ===================================================================
# 4. Performance Impact Estimation
# ===================================================================
def estimate_temperature_impact(temperature_c: float) -> dict:
    """
    Estimate performance impact of temperature on marathon time.
    
    Based on Ely et al. (2007): optimal marathon temperature ~10-12°C.
    Performance degrades ~0.3-0.5% per degree above optimal.
    
    Returns estimated slowdown as a percentage.
    """
    optimal_temp = 11.0  # °C
    
    if temperature_c <= optimal_temp:
        # Slightly slower in cold, but minimal
        slowdown_pct = max(0, (optimal_temp - temperature_c) * 0.1)
        category = "COLD" if temperature_c < 5 else "COOL-OPTIMAL"
    elif temperature_c <= 15:
        slowdown_pct = 0  # Near optimal
        category = "OPTIMAL"
    elif temperature_c <= 20:
        slowdown_pct = (temperature_c - 15) * 0.3
        category = "WARM"
    elif temperature_c <= 25:
        slowdown_pct = 1.5 + (temperature_c - 20) * 0.5
        category = "HOT"
    else:
        slowdown_pct = 4.0 + (temperature_c - 25) * 0.8
        category = "EXTREME HEAT"
    
    return {
        "slowdown_pct": round(slowdown_pct, 1),
        "category": category,
        "optimal_temp_c": optimal_temp,
    }


def estimate_humidity_impact(relative_humidity_pct: float, temperature_c: float) -> dict:
    """
    Estimate additional impact of humidity on performance.
    High humidity impairs thermoregulation, especially in heat.
    """
    if temperature_c < 15:
        # Humidity has minimal impact in cool conditions
        impact_pct = 0
        category = "NEGLIGIBLE"
    elif relative_humidity_pct < 40:
        impact_pct = 0
        category = "DRY — LOW IMPACT"
    elif relative_humidity_pct < 60:
        impact_pct = 0.5
        category = "MODERATE"
    elif relative_humidity_pct < 80:
        impact_pct = 1.5
        category = "HIGH — IMPAIRED COOLING"
    else:
        impact_pct = 3.0
        category = "VERY HIGH — SIGNIFICANT RISK"
    
    return {
        "additional_slowdown_pct": round(impact_pct, 1),
        "category": category,
    }


def estimate_headwind_impact(headwind_mps: float) -> dict:
    """
    Estimate impact of headwind on running performance.
    
    Aerodynamic drag increases with wind speed. A sustained headwind
    of ~4 m/s can cost ~2-4% in finishing time.
    
    Based on Pugh (1971) and Davies (1980) drag models.
    """
    if headwind_mps < 1:
        slowdown_pct = 0
        category = "CALM"
    elif headwind_mps < 3:
        slowdown_pct = headwind_mps * 0.5
        category = "LIGHT HEADWIND"
    elif headwind_mps < 6:
        slowdown_pct = 1.5 + (headwind_mps - 3) * 0.8
        category = "MODERATE HEADWIND"
    else:
        slowdown_pct = 3.9 + (headwind_mps - 6) * 1.2
        category = "STRONG HEADWIND"
    
    return {
        "slowdown_pct": round(slowdown_pct, 1),
        "category": category,
    }


# ===================================================================
# 5. Complete Weather Feature Set
# ===================================================================
def compute_weather_features(
    temperature_c: float,
    relative_humidity_pct: float,
    wind_speed_mps: float,
    wind_direction_deg: float,
    course_heading_deg: float,
    precipitation_mm: float = 0.0,
    pressure_hpa: float = 1013.25,
    cloud_cover_pct: float = 50.0,
) -> dict:
    """
    Compute all derived weather features from raw inputs.
    This is the main entry point for the weather feature pipeline.
    """
    dew_point = calculate_dew_point(temperature_c, relative_humidity_pct)
    wbgt = calculate_wbgt(temperature_c, relative_humidity_pct, wind_speed_mps)
    wbgt_risk = get_wbgt_risk_category(wbgt)
    wind = decompose_wind(wind_speed_mps, wind_direction_deg, course_heading_deg)
    
    temp_impact = estimate_temperature_impact(temperature_c)
    humidity_impact = estimate_humidity_impact(relative_humidity_pct, temperature_c)
    headwind_impact = estimate_headwind_impact(wind["headwind_mps"])
    
    total_slowdown = (
        temp_impact["slowdown_pct"] +
        humidity_impact["additional_slowdown_pct"] +
        headwind_impact["slowdown_pct"]
    )
    
    return {
        # Raw inputs
        "temperature_c": temperature_c,
        "relative_humidity_pct": relative_humidity_pct,
        "wind_speed_mps": wind_speed_mps,
        "wind_direction_deg": wind_direction_deg,
        "precipitation_mm": precipitation_mm,
        "pressure_hpa": pressure_hpa,
        "cloud_cover_pct": cloud_cover_pct,
        # Derived
        "dew_point_c": dew_point,
        "wbgt_c": wbgt,
        "wbgt_risk": wbgt_risk,
        # Wind decomposition
        "headwind_mps": wind["headwind_mps"],
        "crosswind_mps": wind["crosswind_mps"],
        "tailwind_mps": wind["tailwind_mps"],
        "wind_effect": wind["wind_effect"],
        # Performance impact estimates
        "temperature_impact": temp_impact,
        "humidity_impact": humidity_impact,
        "headwind_impact": headwind_impact,
        "total_estimated_slowdown_pct": round(total_slowdown, 1),
    }


# ===================================================================
# 6. Weather Feature Vector for Model Input
# ===================================================================
def get_weather_feature_vector(
    temperature_c: float,
    relative_humidity_pct: float,
    wind_speed_mps: float,
    wind_direction_deg: float,
    course_heading_deg: float,
    precipitation_mm: float = 0.0,
    pressure_hpa: float = 1013.25,
) -> list[float]:
    """
    Get a flat feature vector suitable for model input.
    
    Returns 10 features:
      [temperature_c, relative_humidity_pct, dew_point_c, wbgt_c,
       wind_speed_mps, headwind_mps, crosswind_mps, tailwind_mps,
       precipitation_mm, pressure_hpa]
    """
    features = compute_weather_features(
        temperature_c, relative_humidity_pct,
        wind_speed_mps, wind_direction_deg, course_heading_deg,
        precipitation_mm, pressure_hpa,
    )
    
    return [
        features["temperature_c"],
        features["relative_humidity_pct"],
        features["dew_point_c"],
        features["wbgt_c"],
        features["wind_speed_mps"],
        features["headwind_mps"],
        features["crosswind_mps"],
        features["tailwind_mps"],
        features["precipitation_mm"],
        features["pressure_hpa"],
    ]


if __name__ == "__main__":
    print("=== Weather Feature Examples ===\n")
    
    scenarios = [
        ("Perfect conditions (Berlin)", 12, 45, 2, 180, 90, 0),
        ("Hot & humid (Singapore)", 30, 85, 3, 90, 0, 0),
        ("Strong headwind (Chicago)", 15, 55, 8, 180, 180, 0),
        ("Cold & rainy (Boston)", 5, 90, 5, 270, 90, 3),
        ("Tailwind bonus (London)", 18, 60, 6, 90, 270, 0),
    ]
    
    for name, temp, rh, ws, wd, ch, precip in scenarios:
        print(f"--- {name} ---")
        features = compute_weather_features(temp, rh, ws, wd, ch, precip)
        print(f"  Temp: {temp}°C | RH: {rh}% | Dew Point: {features['dew_point_c']}°C | WBGT: {features['wbgt_c']}°C ({features['wbgt_risk']})")
        print(f"  Wind: {ws} m/s from {wd}° | Headwind: {features['headwind_mps']} | Crosswind: {features['crosswind_mps']} | Tailwind: {features['tailwind_mps']}")
        print(f"  Effect: {features['wind_effect']}")
        print(f"  Est. Slowdown: {features['total_estimated_slowdown_pct']}%")
        print(f"    Temperature: +{features['temperature_impact']['slowdown_pct']}% ({features['temperature_impact']['category']})")
        print(f"    Humidity:    +{features['humidity_impact']['additional_slowdown_pct']}% ({features['humidity_impact']['category']})")
        print(f"    Headwind:    +{features['headwind_impact']['slowdown_pct']}% ({features['headwind_impact']['category']})")
        print()
