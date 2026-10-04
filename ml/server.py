"""
server.py — Stride FastAPI Backend v3

Architecture:
  Task 1A: Marathon Performance Model (VanderPlas MLP)
    → Predicted finish time, target pace, training recommendation
    → v2: Environment & course-aware prediction
  
  Task 1B: Physiology + Nutrition Engine (PhysioNet-calibrated)
    → VO2max, RER, substrate oxidation, glycogen model, nutrition plan

Endpoints:
  POST /predict/marathon       — Task 1A prediction
  POST /predict/marathon/v2    — Environment + course-aware prediction
  POST /predict/full-plan      — Full pipeline (Task 1A → 1B)
  POST /predict/full-plan/v2   — Full pipeline with course + weather
  GET  /courses                — List course presets
  GET  /courses/{id}/profile   — Get course elevation profile
  POST /weather/calculate      — Calculate derived weather features
  POST /physiology/profile     — Standalone physiology profile
  GET  /physiology/calibration — PhysioNet calibration report
  POST /fuel                   — Legacy fuel endpoint
  GET  /coaches                — Coach listing
  POST /coaches/request        — Coach request
"""

import os
import shutil
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import torch
import numpy as np
import joblib
from fastapi.middleware.cors import CORSMiddleware
from train import CombinedStrideModel, time_to_seconds
from physiology import build_physiology_profile, run_physionet_calibration
from nutrition import build_nutrition_plan
from course_utils import COURSE_PRESETS, compute_course_features, list_courses, compute_remaining_difficulty
from weather_utils import compute_weather_features
import activity_utils

app = FastAPI(
    title="Stride ML API",
    description="Marathon performance prediction and physiology-driven nutrition planning",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")

# Load the Task 1A model and scalers globally
model = CombinedStrideModel()
model.load_state_dict(torch.load(os.path.join(OUTPUT_DIR, "combined_stride_model.pth")))
model.eval()

scaler_mar_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_X.pkl'))
scaler_mar_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_y.pkl'))
scaler_phy_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_X.pkl'))
scaler_phy_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_y.pkl'))

# Cache calibration report (expensive, run once)
_calibration_cache = None


# ===================================================================
# Request/Response Models
# ===================================================================

class MarathonRequest(BaseModel):
    age: int
    gender: str
    split_hhmmss: str

class PhysioRequest(BaseModel):
    age: int
    weight: float
    height: float
    sex: int
    speed: float
    hr: float
    rr: float
    ve: float

class FullPlanRequest(BaseModel):
    # User profile
    age: int
    weight_kg: float
    height_cm: float
    sex: int  # 1 = male, 0 = female
    hr_rest: float
    hr_max: float
    training_hours_per_week: Optional[float] = 7.0
    # Marathon split for Task 1A
    gender: str  # 'M' or 'W'
    split_hhmmss: str
    # Options
    is_carb_loaded: Optional[bool] = True

class PhysiologyProfileRequest(BaseModel):
    age: int
    weight_kg: float
    height_cm: float
    sex: int
    hr_rest: float
    hr_max: float
    target_pace_kmh: float

class CourseWeatherRequest(BaseModel):
    # Course
    course_id: Optional[str] = None
    custom_ascent_m: Optional[float] = None
    custom_descent_m: Optional[float] = None
    custom_net_elevation_m: Optional[float] = None
    # Weather
    temperature_c: float = 12.0
    relative_humidity_pct: float = 50.0
    wind_speed_mps: float = 2.0
    wind_direction_deg: float = 0.0
    course_heading_deg: Optional[float] = None
    precipitation_mm: float = 0.0
    pressure_hpa: float = 1013.25
    cloud_cover_pct: float = 50.0

class MarathonV2Request(BaseModel):
    # Task 1A inputs
    age: int
    gender: str
    split_hhmmss: str
    # Course
    course_id: Optional[str] = None
    # Weather
    temperature_c: float = 12.0
    relative_humidity_pct: float = 50.0
    wind_speed_mps: float = 2.0
    wind_direction_deg: float = 0.0
    precipitation_mm: float = 0.0
    pressure_hpa: float = 1013.25

class FullPlanV2Request(BaseModel):
    # User profile
    age: int
    weight_kg: float
    height_cm: float
    sex: int
    hr_rest: float
    hr_max: float
    training_hours_per_week: Optional[float] = 7.0
    # Task 1A
    gender: str
    split_hhmmss: str
    # Course
    course_id: Optional[str] = None
    # Weather
    temperature_c: float = 12.0
    relative_humidity_pct: float = 50.0
    wind_speed_mps: float = 2.0
    wind_direction_deg: float = 0.0
    precipitation_mm: float = 0.0
    pressure_hpa: float = 1013.25
    # Options
    is_carb_loaded: Optional[bool] = True

class FuelRequest(BaseModel):
    body_mass: float

class CoachRequest(BaseModel):
    coach_id: int


# ===================================================================
# Helper: Run Task 1A prediction
# ===================================================================
def _predict_marathon(age: int, gender: str, split_hhmmss: str) -> dict:
    """Run the VanderPlas MLP and return finish time + derived outputs."""
    split_sec = time_to_seconds(split_hhmmss)
    gender_M = 1.0 if gender == 'M' else 0.0
    gender_W = 1.0 if gender == 'W' else 0.0
    
    X_input = np.array([[age, gender_M, gender_W, split_sec]])
    X_scaled = scaler_mar_X.transform(X_input)
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
    
    with torch.no_grad():
        pred_scaled = model.forward_marathon(X_tensor).detach().numpy()
    
    pred_sec = float(scaler_mar_y.inverse_transform(pred_scaled)[0][0])
    
    hours = int(pred_sec // 3600)
    minutes = int((pred_sec % 3600) // 60)
    seconds = int(pred_sec % 60)
    
    # Derived outputs
    marathon_distance_km = 42.195
    pace_sec_per_km = pred_sec / marathon_distance_km
    pace_min = int(pace_sec_per_km // 60)
    pace_s = int(pace_sec_per_km % 60)
    target_pace_kmh = marathon_distance_km / (pred_sec / 3600) if pred_sec > 0 else 0
    
    # Simple training recommendation based on target pace
    easy_pace_kmh = target_pace_kmh * 0.75
    tempo_pace_kmh = target_pace_kmh * 0.90
    
    return {
        "final_seconds": int(pred_sec),
        "final_time": f"{hours:02d}:{minutes:02d}:{seconds:02d}",
        "target_pace": f"{pace_min}:{pace_s:02d} /km",
        "target_pace_kmh": round(target_pace_kmh, 2),
        "training_recommendation": {
            "easy_pace": f"{int(60/easy_pace_kmh)}:{int((60/easy_pace_kmh % 1)*60):02d} /km",
            "tempo_pace": f"{int(60/tempo_pace_kmh)}:{int((60/tempo_pace_kmh % 1)*60):02d} /km",
            "long_run_pace": f"{int(60/(target_pace_kmh*0.80))}:{int((60/(target_pace_kmh*0.80) % 1)*60):02d} /km",
            "weekly_volume_km": round(marathon_distance_km * 1.5, 0),
        },
    }


# ===================================================================
# Endpoints
# ===================================================================

@app.post("/predict/marathon")
def predict_marathon(req: MarathonRequest):
    """
    Task 1A: Marathon finish time prediction.
    Uses VanderPlas-trained MLP.
    Returns predicted finish time, target pace, and training recommendations.
    """
    return _predict_marathon(req.age, req.gender, req.split_hhmmss)


@app.post("/predict/full-plan")
def predict_full_plan(req: FullPlanRequest):
    """
    Full Stride Pipeline: Task 1A → Task 1B.
    
    1. Predicts marathon finish time (Task 1A)
    2. Derives target pace
    3. Builds physiology profile at that pace
    4. Generates complete nutrition plan
    5. Models glycogen balance
    """
    # Stage 1: Task 1A
    marathon = _predict_marathon(req.age, req.gender, req.split_hhmmss)
    
    # Stage 2: Task 1B (Nutrition plan receives Task 1A output)
    plan = build_nutrition_plan(
        age=req.age,
        weight_kg=req.weight_kg,
        height_cm=req.height_cm,
        sex=req.sex,
        hr_rest=req.hr_rest,
        hr_max=req.hr_max,
        training_hours_per_week=req.training_hours_per_week or 7.0,
        predicted_finish_seconds=marathon["final_seconds"],
        target_pace_kmh=marathon["target_pace_kmh"],
        is_carb_loaded=req.is_carb_loaded if req.is_carb_loaded is not None else True,
    )
    
    return {
        "task_1a": marathon,
        "task_1b": plan,
    }


@app.post("/physiology/profile")
def get_physiology_profile(req: PhysiologyProfileRequest):
    """
    Standalone physiology profile.
    Estimates VO2max, RER, substrate oxidation, FFM, and glycogen capacity.
    """
    profile = build_physiology_profile(
        age=req.age,
        weight_kg=req.weight_kg,
        height_cm=req.height_cm,
        sex=req.sex,
        hr_rest=req.hr_rest,
        hr_max=req.hr_max,
        target_pace_kmh=req.target_pace_kmh,
    )
    return profile


@app.get("/physiology/calibration")
def get_calibration_report():
    """
    PhysioNet calibration report.
    Shows how our VO2 estimation equations compare against
    measured lab data from the PhysioNet treadmill dataset.
    """
    global _calibration_cache
    if _calibration_cache is None:
        _calibration_cache = run_physionet_calibration()
    return _calibration_cache


@app.post("/predict/vo2")
def predict_vo2(req: PhysioRequest):
    """Legacy: Direct VO2 prediction from the PhysioNet-trained MLP."""
    X_input = np.array([[req.age, req.weight, req.height, req.sex, req.speed, req.hr, req.rr, req.ve]])
    X_scaled = scaler_phy_X.transform(X_input)
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
    
    with torch.no_grad():
        pred_scaled = model.forward_physio(X_tensor).detach().numpy()
    
    pred_vo2 = scaler_phy_y.inverse_transform(pred_scaled)[0][0]
    return {"vo2_prediction": float(pred_vo2)}


@app.post("/fuel")
def get_fuel(req: FuelRequest):
    """Legacy fuel endpoint — backward compatible."""
    return {
        "pre_race_carb": round(10.0 * req.body_mass),
        "post_race_carb": round(1.2 * req.body_mass),
        "post_race_protein": round(0.3 * req.body_mass)
    }


# ===================================================================
# Course & Weather Endpoints
# ===================================================================

@app.get("/courses")
def get_courses():
    """List all available marathon course presets."""
    return list_courses()


@app.get("/courses/{course_id}/profile")
def get_course_profile(course_id: str):
    """Get detailed elevation profile and features for a course."""
    if course_id not in COURSE_PRESETS:
        return {"error": f"Course '{course_id}' not found"}
    preset = COURSE_PRESETS[course_id]
    features = compute_course_features(preset["elevation_profile"])
    return {
        "id": course_id,
        "name": preset["name"],
        "city": preset["city"],
        "characteristics": preset["characteristics"],
        "general_heading_deg": preset["general_heading_deg"],
        **features,
    }


@app.post("/weather/calculate")
def calculate_weather(req: CourseWeatherRequest):
    """Calculate derived weather features (WBGT, dew point, headwind)."""
    heading = req.course_heading_deg
    if heading is None and req.course_id and req.course_id in COURSE_PRESETS:
        heading = COURSE_PRESETS[req.course_id]["general_heading_deg"]
    elif heading is None:
        heading = 0.0
    
    return compute_weather_features(
        temperature_c=req.temperature_c,
        relative_humidity_pct=req.relative_humidity_pct,
        wind_speed_mps=req.wind_speed_mps,
        wind_direction_deg=req.wind_direction_deg,
        course_heading_deg=heading,
        precipitation_mm=req.precipitation_mm,
        pressure_hpa=req.pressure_hpa,
        cloud_cover_pct=req.cloud_cover_pct,
    )


# ===================================================================
# v2 Environment-Aware Endpoints
# ===================================================================

@app.post("/predict/marathon/v2")
def predict_marathon_v2(req: MarathonV2Request):
    """
    Environment + course-aware marathon prediction.
    Applies estimated performance impacts from temperature, humidity,
    headwind, and course difficulty to the base MLP prediction.
    """
    # Base prediction from MLP
    base = _predict_marathon(req.age, req.gender, req.split_hhmmss)
    
    # Course features
    course_info = None
    course_heading = 0.0
    if req.course_id and req.course_id in COURSE_PRESETS:
        preset = COURSE_PRESETS[req.course_id]
        course_info = compute_course_features(preset["elevation_profile"])
        course_heading = preset["general_heading_deg"]
    
    # Weather features
    weather = compute_weather_features(
        req.temperature_c, req.relative_humidity_pct,
        req.wind_speed_mps, req.wind_direction_deg, course_heading,
        req.precipitation_mm, req.pressure_hpa,
    )
    
    # Apply estimated slowdowns
    slowdown_pct = weather["total_estimated_slowdown_pct"]
    adjusted_seconds = int(base["final_seconds"] * (1 + slowdown_pct / 100))
    
    adj_h = adjusted_seconds // 3600
    adj_m = (adjusted_seconds % 3600) // 60
    adj_s = adjusted_seconds % 60
    
    marathon_distance = 42.195
    adj_pace_sec = adjusted_seconds / marathon_distance
    adj_pace_min = int(adj_pace_sec // 60)
    adj_pace_s = int(adj_pace_sec % 60)
    
    return {
        "base_prediction": base,
        "adjusted_prediction": {
            "final_seconds": adjusted_seconds,
            "final_time": f"{adj_h:02d}:{adj_m:02d}:{adj_s:02d}",
            "target_pace": f"{adj_pace_min}:{adj_pace_s:02d} /km",
            "slowdown_pct": slowdown_pct,
            "time_added_seconds": adjusted_seconds - base["final_seconds"],
            "time_added_formatted": f"+{(adjusted_seconds - base['final_seconds']) // 60}:{(adjusted_seconds - base['final_seconds']) % 60:02d}",
        },
        "course": course_info,
        "weather": weather,
    }


@app.post("/predict/full-plan/v2")
def predict_full_plan_v2(req: FullPlanV2Request):
    """
    Full pipeline with course + weather adjustment.
    Task 1A (adjusted for environment) → Task 1B (nutrition with weather context).
    """
    # Get course heading
    course_heading = 0.0
    course_info = None
    if req.course_id and req.course_id in COURSE_PRESETS:
        preset = COURSE_PRESETS[req.course_id]
        course_heading = preset["general_heading_deg"]
        course_info = compute_course_features(preset["elevation_profile"])
    
    # Weather features
    weather = compute_weather_features(
        req.temperature_c, req.relative_humidity_pct,
        req.wind_speed_mps, req.wind_direction_deg, course_heading,
        req.precipitation_mm, req.pressure_hpa,
    )
    
    # Base prediction
    base_marathon = _predict_marathon(req.age, req.gender, req.split_hhmmss)
    
    # Adjusted prediction
    slowdown_pct = weather["total_estimated_slowdown_pct"]
    adjusted_seconds = int(base_marathon["final_seconds"] * (1 + slowdown_pct / 100))
    adjusted_pace_kmh = 42.195 / (adjusted_seconds / 3600) if adjusted_seconds > 0 else 0
    
    adj_h = adjusted_seconds // 3600
    adj_m = (adjusted_seconds % 3600) // 60
    adj_s = adjusted_seconds % 60
    adj_pace_sec = adjusted_seconds / 42.195
    
    adjusted_marathon = {
        **base_marathon,
        "adjusted_final_seconds": adjusted_seconds,
        "adjusted_final_time": f"{adj_h:02d}:{adj_m:02d}:{adj_s:02d}",
        "adjusted_target_pace": f"{int(adj_pace_sec // 60)}:{int(adj_pace_sec % 60):02d} /km",
        "slowdown_pct": slowdown_pct,
    }
    
    # Nutrition plan uses adjusted time
    plan = build_nutrition_plan(
        age=req.age,
        weight_kg=req.weight_kg,
        height_cm=req.height_cm,
        sex=req.sex,
        hr_rest=req.hr_rest,
        hr_max=req.hr_max,
        training_hours_per_week=req.training_hours_per_week or 7.0,
        predicted_finish_seconds=adjusted_seconds,
        target_pace_kmh=adjusted_pace_kmh,
        is_carb_loaded=req.is_carb_loaded if req.is_carb_loaded is not None else True,
    )
    
    return {
        "task_1a": adjusted_marathon,
        "task_1b": plan,
        "course": course_info,
        "weather": weather,
    }


@app.get("/coaches")
def get_coaches():
    return [
        {"id": 1, "email": "elite.coach@stride.app", "status": "available"},
        {"id": 2, "email": "marathon.pro@stride.app", "status": "available"}
    ]


@app.post("/coaches/request")
def request_coach(req: CoachRequest):
    return {"status": "success"}

@app.get("/coaches/dashboard")
def get_coach_dashboard():
    return {
        "status": "success",
        "roster": [
            {"id": 1, "athlete_id": 101, "athlete_email": "john.doe@example.com"}
        ],
        "pending": [
            {"id": 2, "athlete_email": "new.runner@example.com"}
        ]
    }

@app.get("/coaches/athlete/{athlete_id}/plan")
def get_athlete_plan(athlete_id: int):
    return {"plan_text": "Monday: 8km Easy\nTuesday: 6x1000m Intervals"}

@app.post("/coaches/athlete/{athlete_id}/plan")
def set_athlete_plan(athlete_id: int, plan: dict):
    return {"status": "success"}

@app.post("/coaches/respond")
def respond_request(req: dict):
    return {"status": "success"}

@app.post("/activities/upload")
def upload_activity(athlete_id: str, file: UploadFile = File(...)):
    # Save the file temporarily
    file_location = f"data/temp_{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process it
    result = activity_utils.process_activity_upload(file_location, athlete_id)
    os.remove(file_location) # Clean up
    return result

@app.get("/activities/{athlete_id}")
def get_athlete_activities(athlete_id: str):
    activities = [a for a in activity_utils.athlete_activities if a['athlete_id'] == athlete_id]
    return {"activities": activities}

@app.post("/nutrition/log")
def log_nutrition(req: dict):
    # Expects athlete_id and nutrition payload
    return activity_utils.add_nutrition_log(req.get("athlete_id", "default"), req)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
