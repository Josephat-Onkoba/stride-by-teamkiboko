"""
physiology.py — Physiology Calibration Module (Task 1B Foundation)

Uses the PhysioNet Treadmill dataset as a LABORATORY REFERENCE to
calibrate and validate the physiological estimation equations used
by the Stride metabolic engine.

PhysioNet provides measured VO2, VCO2, HR, and speed breath-by-breath.
We use this to answer: "How accurate is our VO2-estimation approach
compared with real cardiorespiratory exercise data?"

This module does NOT train a model on PhysioNet to predict VO2 for
new users. Instead, it:
  1. Estimates VO2max from user-supplied HR data (Uth et al. equation)
  2. Estimates VO2 demand from pace/speed (ACSM running equation)
  3. Calculates RER from VO2 and VCO2
  4. Derives CHO and fat oxidation rates from RER
  5. Validates these equations against PhysioNet measured values

References:
  - Uth et al. (2004): VO2max ≈ 15.3 × (HRmax / HRrest)
  - ACSM Running VO2 equation: VO2 = 0.2*S + 0.9*S*G + 3.5
  - Péronnet & Massicotte (1991): substrate oxidation from RER
"""

import os
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# -------------------------------------------------------------------
# Paths
# -------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _find_path(*candidates):
    for c in candidates:
        full = os.path.normpath(os.path.join(BASE_DIR, c))
        if os.path.exists(full):
            return full
    return os.path.normpath(os.path.join(BASE_DIR, candidates[0]))

_TREADMILL_DIR = "treadmill-maximal-exercise-tests-from-the-exercise-physiology-and-human-performance-lab-of-the-university-of-malaga-1.0.1"
PHYSIO_SUB_PATH = _find_path(
    f"../data/{_TREADMILL_DIR}/subject-info.csv",
    f"../../{_TREADMILL_DIR}/subject-info.csv",
    f"../../archive/{_TREADMILL_DIR}/subject-info.csv",
)
PHYSIO_MEAS_PATH = _find_path(
    f"../data/{_TREADMILL_DIR}/test_measure.csv",
    f"../../{_TREADMILL_DIR}/test_measure.csv",
    f"../../archive/{_TREADMILL_DIR}/test_measure.csv",
)


# ===================================================================
# 1. VO2max Estimation from HR (Uth et al. 2004)
# ===================================================================
def estimate_vo2max_hr_ratio(hr_max: float, hr_rest: float) -> float:
    """
    Estimate VO2max using the HR-ratio method.
    VO2max (mL/kg/min) ≈ 15.3 × (HRmax / HRrest)
    
    This is a widely-cited non-exercise VO2max estimation.
    """
    if hr_rest <= 0:
        raise ValueError("Resting HR must be positive")
    return 15.3 * (hr_max / hr_rest)


# ===================================================================
# 2. VO2 Demand from Running Speed (ACSM equation)
# ===================================================================
def estimate_vo2_demand(speed_kmh: float, grade: float = 0.0) -> float:
    """
    Estimate oxygen demand for running using the ACSM equation.
    
    VO2 (mL/kg/min) = 0.2 * S + 0.9 * S * G + 3.5
    where S = speed in m/min, G = fractional grade (0.0 = flat)
    
    Returns VO2 in mL/kg/min.
    """
    speed_m_min = speed_kmh * 1000 / 60  # km/h → m/min
    vo2 = 0.2 * speed_m_min + 0.9 * speed_m_min * grade + 3.5
    return vo2


# ===================================================================
# 3. RER Calculation
# ===================================================================
def calculate_rer(vo2: float, vco2: float) -> float:
    """
    Respiratory Exchange Ratio = VCO2 / VO2
    
    RER ~0.70 → predominantly fat oxidation
    RER ~0.85 → mixed substrate
    RER ~1.00 → predominantly CHO oxidation
    RER >1.00 → anaerobic threshold exceeded
    """
    if vo2 <= 0:
        return 0.0
    return vco2 / vo2


# ===================================================================
# 4. Substrate Oxidation from RER (Péronnet & Massicotte, 1991)
# ===================================================================
def calculate_substrate_oxidation(vo2_l_min: float, rer: float) -> dict:
    """
    Estimate CHO and fat oxidation rates using stoichiometric equations.
    
    CHO oxidation (g/min) = 4.585 * VCO2 - 3.226 * VO2
    Fat oxidation (g/min) = 1.695 * VO2 - 1.701 * VCO2
    
    Where VO2 and VCO2 are in L/min.
    Energy from CHO ≈ 4.07 kcal/g, from Fat ≈ 9.75 kcal/g
    
    Args:
        vo2_l_min: VO2 in L/min
        rer: Respiratory Exchange Ratio
    
    Returns:
        Dictionary with oxidation rates and energy contributions.
    """
    vco2_l_min = vo2_l_min * rer
    
    # Clamp RER to physiological range for substrate calculation
    rer_clamped = max(0.70, min(rer, 1.00))
    vco2_clamped = vo2_l_min * rer_clamped
    
    cho_oxidation = max(0, 4.585 * vco2_clamped - 3.226 * vo2_l_min)  # g/min
    fat_oxidation = max(0, 1.695 * vo2_l_min - 1.701 * vco2_clamped)  # g/min
    
    cho_energy = cho_oxidation * 4.07   # kcal/min
    fat_energy = fat_oxidation * 9.75   # kcal/min
    total_energy = cho_energy + fat_energy
    
    cho_pct = (cho_energy / total_energy * 100) if total_energy > 0 else 0
    fat_pct = (fat_energy / total_energy * 100) if total_energy > 0 else 0
    
    return {
        "cho_oxidation_g_min": round(cho_oxidation, 3),
        "fat_oxidation_g_min": round(fat_oxidation, 3),
        "cho_oxidation_g_hr": round(cho_oxidation * 60, 1),
        "fat_oxidation_g_hr": round(fat_oxidation * 60, 1),
        "cho_energy_kcal_min": round(cho_energy, 2),
        "fat_energy_kcal_min": round(fat_energy, 2),
        "total_energy_kcal_min": round(total_energy, 2),
        "cho_contribution_pct": round(cho_pct, 1),
        "fat_contribution_pct": round(fat_pct, 1),
    }


# ===================================================================
# 5. RER Estimation from % VO2max (Romijn et al. 1993 approximation)
# ===================================================================
def estimate_rer_from_intensity(pct_vo2max: float) -> float:
    """
    Estimate RER from exercise intensity (% VO2max).
    Based on Romijn et al. (1993) approximation:
    
    ~25% VO2max → RER ~0.73
    ~65% VO2max → RER ~0.83
    ~85% VO2max → RER ~0.91
    ~100% VO2max → RER ~1.00
    
    Linear interpolation within the 0.70-1.00 range.
    """
    # Clamp to 0-100%
    pct = max(0, min(pct_vo2max, 100))
    # Linear approximation: RER = 0.70 + 0.30 * (pct / 100)
    rer = 0.70 + 0.30 * (pct / 100)
    return round(rer, 3)


# ===================================================================
# 6. Fat-Free Mass Estimation (Boer equation)
# ===================================================================
def estimate_ffm(weight_kg: float, height_cm: float, sex: int) -> float:
    """
    Estimate Fat-Free Mass using the Boer equation.
    
    Male:   FFM = 0.407 * weight + 0.267 * height - 19.2
    Female: FFM = 0.252 * weight + 0.473 * height - 48.3
    
    sex: 1 = male, 0 = female
    """
    if sex == 1:
        ffm = 0.407 * weight_kg + 0.267 * height_cm - 19.2
    else:
        ffm = 0.252 * weight_kg + 0.473 * height_cm - 48.3
    return round(max(0, ffm), 1)


# ===================================================================
# 7. Glycogen Capacity
# ===================================================================
def estimate_glycogen_capacity(ffm_kg: float) -> dict:
    """
    Estimate muscle and liver glycogen stores.
    
    Muscle glycogen: ~15 g/kg FFM (normal), ~35-40 g/kg FFM (supercompensated)
    Liver glycogen: ~80-100 g
    
    Returns normal and supercompensated scenarios.
    """
    muscle_glycogen_normal = round(ffm_kg * 15, 0)
    muscle_glycogen_loaded = round(ffm_kg * 38, 0)
    liver_glycogen = 90  # grams, average
    
    return {
        "muscle_glycogen_normal_g": muscle_glycogen_normal,
        "muscle_glycogen_loaded_g": muscle_glycogen_loaded,
        "liver_glycogen_g": liver_glycogen,
        "total_normal_g": muscle_glycogen_normal + liver_glycogen,
        "total_loaded_g": muscle_glycogen_loaded + liver_glycogen,
        "total_normal_kcal": round((muscle_glycogen_normal + liver_glycogen) * 4, 0),
        "total_loaded_kcal": round((muscle_glycogen_loaded + liver_glycogen) * 4, 0),
    }


# ===================================================================
# 8. PhysioNet Calibration Report
# ===================================================================
def run_physionet_calibration() -> dict:
    """
    Compare our ACSM VO2-demand estimates against PhysioNet measured VO2.
    This validates whether our equations are behaving reasonably.
    
    Returns calibration statistics (bias, MAE, RMSE, R²).
    """
    sub_df = pd.read_csv(PHYSIO_SUB_PATH)
    meas_df = pd.read_csv(PHYSIO_MEAS_PATH)
    
    df = pd.merge(meas_df, sub_df, on="ID_test", suffixes=("", "_sub"))
    df = df.dropna(subset=["Speed", "VO2", "VCO2", "Weight"])
    
    # Filter out resting / zero-speed rows
    df = df[df["Speed"] > 0].copy()
    
    # Measured VO2 is in mL/min → convert to mL/kg/min
    df["vo2_measured_ml_kg_min"] = df["VO2"] / df["Weight"]
    
    # Our ACSM estimate at each measured speed
    df["vo2_estimated_ml_kg_min"] = df["Speed"].apply(
        lambda s: estimate_vo2_demand(s)
    )
    
    # Measured RER
    df["rer_measured"] = df["VCO2"] / df["VO2"]
    
    # Filter physiological range
    df = df[(df["rer_measured"] > 0.6) & (df["rer_measured"] < 1.3)]
    df = df[(df["vo2_measured_ml_kg_min"] > 5) & (df["vo2_measured_ml_kg_min"] < 100)]
    
    measured = df["vo2_measured_ml_kg_min"].values
    estimated = df["vo2_estimated_ml_kg_min"].values
    
    bias = np.mean(estimated - measured)
    mae = mean_absolute_error(measured, estimated)
    rmse = np.sqrt(mean_squared_error(measured, estimated))
    r2 = r2_score(measured, estimated)
    
    n_subjects = df["ID_test"].nunique()
    n_measurements = len(df)
    
    # RER distribution summary
    rer_mean = df["rer_measured"].mean()
    rer_std = df["rer_measured"].std()
    
    return {
        "n_subjects": n_subjects,
        "n_measurements": n_measurements,
        "vo2_estimation": {
            "method": "ACSM Running VO2 Equation",
            "bias_ml_kg_min": round(bias, 2),
            "mae_ml_kg_min": round(mae, 2),
            "rmse_ml_kg_min": round(rmse, 2),
            "r2": round(r2, 4),
            "interpretation": (
                "GOOD: Equations track measured values well"
                if r2 > 0.5 else
                "FAIR: Moderate agreement — calibration offset may help"
                if r2 > 0.2 else
                "POOR: Significant discrepancy — use with caution"
            )
        },
        "rer_reference": {
            "mean": round(rer_mean, 3),
            "std": round(rer_std, 3),
        },
    }


# ===================================================================
# 9. Full Physiology Profile from User Inputs
# ===================================================================
def build_physiology_profile(
    age: int,
    weight_kg: float,
    height_cm: float,
    sex: int,
    hr_rest: float,
    hr_max: float,
    target_pace_kmh: float,
) -> dict:
    """
    Build a complete physiology profile for an athlete.
    Combines all estimation equations into a single coherent output.
    
    This is the main entry point for Task 1B.
    """
    # VO2max estimation
    vo2max = estimate_vo2max_hr_ratio(hr_max, hr_rest)
    
    # VO2 demand at target pace
    vo2_demand = estimate_vo2_demand(target_pace_kmh)
    
    # Exercise intensity as % VO2max
    pct_vo2max = min((vo2_demand / vo2max) * 100, 100) if vo2max > 0 else 0
    
    # RER at this intensity
    rer = estimate_rer_from_intensity(pct_vo2max)
    
    # Absolute VO2 in L/min for oxidation calculations
    vo2_absolute_l_min = (vo2_demand * weight_kg) / 1000
    
    # Substrate oxidation
    substrates = calculate_substrate_oxidation(vo2_absolute_l_min, rer)
    
    # Fat-free mass
    ffm = estimate_ffm(weight_kg, height_cm, sex)
    
    # Glycogen stores
    glycogen = estimate_glycogen_capacity(ffm)
    
    return {
        "vo2max_ml_kg_min": round(vo2max, 1),
        "vo2_demand_ml_kg_min": round(vo2_demand, 1),
        "pct_vo2max": round(pct_vo2max, 1),
        "rer": rer,
        "substrates": substrates,
        "ffm_kg": ffm,
        "glycogen": glycogen,
    }


if __name__ == "__main__":
    print("=== PhysioNet Calibration Report ===")
    report = run_physionet_calibration()
    print(f"Subjects: {report['n_subjects']}")
    print(f"Measurements: {report['n_measurements']}")
    print(f"VO2 Estimation Bias: {report['vo2_estimation']['bias_ml_kg_min']} mL/kg/min")
    print(f"VO2 Estimation MAE:  {report['vo2_estimation']['mae_ml_kg_min']} mL/kg/min")
    print(f"VO2 Estimation RMSE: {report['vo2_estimation']['rmse_ml_kg_min']} mL/kg/min")
    print(f"VO2 Estimation R²:   {report['vo2_estimation']['r2']}")
    print(f"Interpretation: {report['vo2_estimation']['interpretation']}")
    print(f"\nRER Reference: {report['rer_reference']['mean']} ± {report['rer_reference']['std']}")
    
    print("\n=== Sample Athlete Profile ===")
    profile = build_physiology_profile(
        age=30, weight_kg=70, height_cm=178,
        sex=1, hr_rest=52, hr_max=188,
        target_pace_kmh=11.5,  # ~5:13/km marathon pace
    )
    for k, v in profile.items():
        print(f"  {k}: {v}")
