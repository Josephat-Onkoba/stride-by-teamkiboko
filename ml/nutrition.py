"""
nutrition.py — Nutrition Advisor (Task 1B Output Layer)

Receives inputs from:
  - User profile (body mass, height, age, sex, HR)
  - Task 1A (predicted finish time, target race pace)
  - Physiology module (VO2max, RER, substrate oxidation, glycogen)

Produces:
  - Daily carbohydrate requirement
  - Pre-race carbohydrate loading plan
  - In-race carbohydrate target (g/h)
  - Post-race recovery targets (CHO + protein)
  - Modeled glycogen deficit / balance

References:
  - Burke et al. (2011): CHO loading 10-12 g/kg/day
  - Jeukendrup (2014): In-race CHO 30-90 g/h depending on duration
  - Thomas et al. (2016): Protein 0.25-0.3 g/kg post-exercise
"""

from physiology import (
    build_physiology_profile,
    estimate_glycogen_capacity,
    estimate_ffm,
)


# ===================================================================
# 1. Daily Carbohydrate Requirement
# ===================================================================
def calculate_daily_cho(weight_kg: float, training_hours_per_week: float) -> dict:
    """
    Daily CHO requirement based on training volume.
    
    Guidelines (Burke et al., 2011):
      Light (1h/day):       3-5 g/kg/day
      Moderate (1-3h/day):  5-7 g/kg/day
      High (3-4.5h/day):    6-10 g/kg/day
      Very high (4.5+h/day): 8-12 g/kg/day
    """
    hours_per_day = training_hours_per_week / 7
    
    if hours_per_day < 1:
        rate_low, rate_high = 3, 5
        category = "Light"
    elif hours_per_day < 3:
        rate_low, rate_high = 5, 7
        category = "Moderate"
    elif hours_per_day < 4.5:
        rate_low, rate_high = 6, 10
        category = "High"
    else:
        rate_low, rate_high = 8, 12
        category = "Very High"
    
    return {
        "category": category,
        "cho_g_kg_low": rate_low,
        "cho_g_kg_high": rate_high,
        "cho_g_day_low": round(weight_kg * rate_low),
        "cho_g_day_high": round(weight_kg * rate_high),
        "cho_g_day_recommended": round(weight_kg * (rate_low + rate_high) / 2),
    }


# ===================================================================
# 2. Pre-Race Carbohydrate Loading
# ===================================================================
def calculate_pre_race_cho(weight_kg: float) -> dict:
    """
    Pre-race CHO loading protocol.
    
    36-48 hour carb-loading: 10-12 g/kg/day (Burke et al., 2011)
    Last meal (3-4h pre-race): 1-4 g/kg
    """
    loading_rate = 10  # g/kg/day (conservative estimate)
    loading_total = round(weight_kg * loading_rate)
    pre_race_meal = round(weight_kg * 2)  # 2 g/kg for last meal
    
    return {
        "loading_g_kg_day": loading_rate,
        "loading_total_g_day": loading_total,
        "loading_duration_hours": 36,
        "pre_race_meal_g": pre_race_meal,
        "pre_race_meal_timing": "3-4 hours before start",
    }


# ===================================================================
# 3. In-Race Carbohydrate Target
# ===================================================================
def calculate_in_race_cho(
    race_duration_hours: float,
    cho_oxidation_g_hr: float,
) -> dict:
    """
    In-race CHO intake based on duration and oxidation rate.
    
    Guidelines (Jeukendrup, 2014):
      <1h:        Not needed (water only)
      1-2h:       30 g/h (single CHO source)
      2-3h:       60 g/h (single or dual CHO)
      >3h:        Up to 90 g/h (dual CHO: glucose + fructose)
    
    Capped by gut absorption limits:
      Single CHO transport (SGLT1): ~60 g/h max
      Dual transport (SGLT1 + GLUT5): ~90 g/h max
    """
    if race_duration_hours < 1:
        recommended = 0
        strategy = "Water only — no CHO needed"
    elif race_duration_hours < 2:
        recommended = 30
        strategy = "Small amounts — mouth rinse or light intake"
    elif race_duration_hours < 3:
        recommended = 60
        strategy = "Single CHO source (glucose polymer)"
    else:
        recommended = min(90, round(cho_oxidation_g_hr * 1.2))
        # Don't exceed gut limit
        recommended = min(recommended, 90)
        strategy = "Dual CHO source (glucose:fructose 2:1 ratio)"
    
    total_cho = round(recommended * race_duration_hours)
    
    # Gel/drink estimates (assuming 25g CHO per gel, 60g CHO per 750ml drink)
    gels_needed = round(total_cho / 25)
    gel_interval_min = round((race_duration_hours * 60) / gels_needed) if gels_needed > 0 else 0
    
    return {
        "recommended_g_hr": recommended,
        "total_cho_g": total_cho,
        "strategy": strategy,
        "gels_needed": gels_needed,
        "gel_interval_min": gel_interval_min,
        "hard_limit_g_hr": 90,
        "cho_oxidation_g_hr": round(cho_oxidation_g_hr, 1),
    }


# ===================================================================
# 4. Post-Race Recovery Targets
# ===================================================================
def calculate_post_race(weight_kg: float, race_duration_hours: float) -> dict:
    """
    Post-race recovery nutrition targets.
    
    CHO: 1.0-1.2 g/kg within first 4 hours (Burke et al., 2011)
    Protein: 0.25-0.3 g/kg within 2 hours (Thomas et al., 2016)
    Fluid: 1.5 L per kg body mass lost (estimated 2-3% loss)
    """
    cho_rate = 1.2  # g/kg
    protein_rate = 0.3  # g/kg
    
    estimated_sweat_loss_kg = weight_kg * 0.025 * race_duration_hours  # rough estimate
    fluid_target_l = round(estimated_sweat_loss_kg * 1.5, 1)
    
    return {
        "cho_g": round(weight_kg * cho_rate),
        "cho_timing": "Within first 4 hours, split across 2-3 meals",
        "protein_g": round(weight_kg * protein_rate),
        "protein_timing": "Within 2 hours post-race",
        "fluid_l": fluid_target_l,
        "fluid_note": "1.5 L per kg body mass lost",
    }


# ===================================================================
# 5. Glycogen Deficit Model
# ===================================================================
def calculate_glycogen_balance(
    glycogen_capacity: dict,
    cho_oxidation_g_hr: float,
    race_duration_hours: float,
    in_race_cho_g_hr: float,
    is_carb_loaded: bool = True,
) -> dict:
    """
    Model glycogen depletion during the race.
    
    Starting glycogen depends on carb-loading status.
    Net depletion = CHO oxidation - in-race intake
    """
    if is_carb_loaded:
        starting_glycogen = glycogen_capacity["total_loaded_g"]
        scenario = "Carb-loaded (supercompensated)"
    else:
        starting_glycogen = glycogen_capacity["total_normal_g"]
        scenario = "Normal glycogen stores"
    
    total_cho_burned = cho_oxidation_g_hr * race_duration_hours
    total_cho_ingested = in_race_cho_g_hr * race_duration_hours
    net_depletion = total_cho_burned - total_cho_ingested
    
    remaining = max(0, starting_glycogen - net_depletion)
    pct_remaining = round((remaining / starting_glycogen) * 100, 1) if starting_glycogen > 0 else 0
    
    # Wall risk: typically hits when glycogen drops below ~20%
    wall_risk = "HIGH" if pct_remaining < 15 else "MODERATE" if pct_remaining < 30 else "LOW"
    
    return {
        "scenario": scenario,
        "starting_glycogen_g": round(starting_glycogen),
        "total_cho_burned_g": round(total_cho_burned),
        "total_cho_ingested_g": round(total_cho_ingested),
        "net_depletion_g": round(net_depletion),
        "remaining_glycogen_g": round(remaining),
        "remaining_pct": pct_remaining,
        "wall_risk": wall_risk,
    }


# ===================================================================
# 6. Full Nutrition Plan (Combined Pipeline)
# ===================================================================
def build_nutrition_plan(
    # User inputs
    age: int,
    weight_kg: float,
    height_cm: float,
    sex: int,
    hr_rest: float,
    hr_max: float,
    training_hours_per_week: float,
    # From Task 1A
    predicted_finish_seconds: float,
    target_pace_kmh: float,
    # Options
    is_carb_loaded: bool = True,
) -> dict:
    """
    Build the complete nutrition plan by combining Task 1A output
    with the physiology module.
    
    This is the main entry point for the nutrition advisor.
    """
    # Build physiology profile
    physio = build_physiology_profile(
        age=age,
        weight_kg=weight_kg,
        height_cm=height_cm,
        sex=sex,
        hr_rest=hr_rest,
        hr_max=hr_max,
        target_pace_kmh=target_pace_kmh,
    )
    
    race_duration_hours = predicted_finish_seconds / 3600
    
    # Daily CHO
    daily = calculate_daily_cho(weight_kg, training_hours_per_week)
    
    # Pre-race loading
    pre_race = calculate_pre_race_cho(weight_kg)
    
    # In-race CHO
    in_race = calculate_in_race_cho(
        race_duration_hours=race_duration_hours,
        cho_oxidation_g_hr=physio["substrates"]["cho_oxidation_g_hr"],
    )
    
    # Post-race recovery
    post_race = calculate_post_race(weight_kg, race_duration_hours)
    
    # Glycogen balance
    glycogen_balance = calculate_glycogen_balance(
        glycogen_capacity=physio["glycogen"],
        cho_oxidation_g_hr=physio["substrates"]["cho_oxidation_g_hr"],
        race_duration_hours=race_duration_hours,
        in_race_cho_g_hr=in_race["recommended_g_hr"],
        is_carb_loaded=is_carb_loaded,
    )
    
    return {
        "physiology": physio,
        "race_duration_hours": round(race_duration_hours, 2),
        "daily_cho": daily,
        "pre_race": pre_race,
        "in_race": in_race,
        "post_race": post_race,
        "glycogen_balance": glycogen_balance,
    }


if __name__ == "__main__":
    # Example: 30yo male, 70kg, 178cm, RHR 52, MHR 188
    # Task 1A predicts 3:30:00 finish at ~12 km/h pace
    plan = build_nutrition_plan(
        age=30, weight_kg=70, height_cm=178, sex=1,
        hr_rest=52, hr_max=188,
        training_hours_per_week=8,
        predicted_finish_seconds=3.5 * 3600,  # 3:30:00
        target_pace_kmh=12.06,  # 42.195 km / 3.5 h
    )
    
    print("=== FULL NUTRITION PLAN ===\n")
    
    print("--- Physiology ---")
    p = plan["physiology"]
    print(f"  VO2max: {p['vo2max_ml_kg_min']} mL/kg/min")
    print(f"  VO2 demand: {p['vo2_demand_ml_kg_min']} mL/kg/min")
    print(f"  Intensity: {p['pct_vo2max']}% VO2max")
    print(f"  RER: {p['rer']}")
    print(f"  CHO oxidation: {p['substrates']['cho_oxidation_g_hr']} g/hr")
    print(f"  Fat oxidation: {p['substrates']['fat_oxidation_g_hr']} g/hr")
    print(f"  FFM: {p['ffm_kg']} kg")
    
    print(f"\n--- Daily CHO ({plan['daily_cho']['category']}) ---")
    print(f"  {plan['daily_cho']['cho_g_day_low']}-{plan['daily_cho']['cho_g_day_high']} g/day")
    
    print(f"\n--- Pre-Race ---")
    print(f"  Loading: {plan['pre_race']['loading_total_g_day']} g/day for {plan['pre_race']['loading_duration_hours']}h")
    print(f"  Last meal: {plan['pre_race']['pre_race_meal_g']} g")
    
    print(f"\n--- In-Race ---")
    print(f"  Target: {plan['in_race']['recommended_g_hr']} g/hr")
    print(f"  Total: {plan['in_race']['total_cho_g']} g")
    print(f"  Strategy: {plan['in_race']['strategy']}")
    print(f"  Gels: {plan['in_race']['gels_needed']} (every {plan['in_race']['gel_interval_min']} min)")
    
    print(f"\n--- Post-Race ---")
    print(f"  CHO: {plan['post_race']['cho_g']} g")
    print(f"  Protein: {plan['post_race']['protein_g']} g")
    print(f"  Fluid: {plan['post_race']['fluid_l']} L")
    
    print(f"\n--- Glycogen Balance ---")
    gb = plan["glycogen_balance"]
    print(f"  Scenario: {gb['scenario']}")
    print(f"  Starting: {gb['starting_glycogen_g']} g")
    print(f"  Burned: {gb['total_cho_burned_g']} g")
    print(f"  Ingested: {gb['total_cho_ingested_g']} g")
    print(f"  Remaining: {gb['remaining_glycogen_g']} g ({gb['remaining_pct']}%)")
    print(f"  Wall Risk: {gb['wall_risk']}")
