"""
schemas.py — Pydantic Schemas for Stride Onboarding & Athlete Profile
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class PersonalInfoSchema(BaseModel):
    full_name: str
    date_of_birth: str  # YYYY-MM-DD
    age: Optional[int] = None
    sex_at_birth: Optional[str] = "male"
    gender: Optional[str] = None
    height_cm: float = 175.0
    weight_kg: float = 68.0
    country: Optional[str] = None
    location: Optional[str] = None
    timezone: Optional[str] = "UTC"

class RunningIdentitySchema(BaseModel):
    competitive_level: Optional[str] = "recreational"
    primary_race_distance: str = "marathon"
    secondary_race_distances: Optional[List[str]] = Field(default_factory=list)
    running_experience_years: Optional[float] = 2.0
    marathons_completed: Optional[int] = 0
    half_marathons_completed: Optional[int] = 0

class PerformanceBaselineSchema(BaseModel):
    # Personal Bests
    pb_5k_time: Optional[str] = None
    pb_5k_date: Optional[str] = None
    pb_5k_race_name: Optional[str] = None
    
    pb_10k_time: Optional[str] = None
    pb_10k_date: Optional[str] = None
    pb_10k_race_name: Optional[str] = None
    
    pb_half_marathon_time: Optional[str] = None
    pb_half_marathon_date: Optional[str] = None
    pb_half_marathon_race_name: Optional[str] = None
    
    pb_marathon_time: Optional[str] = None
    pb_marathon_date: Optional[str] = None
    pb_marathon_race_name: Optional[str] = None

    # Most Recent Race
    recent_race_distance: Optional[str] = None
    recent_race_date: Optional[str] = None
    recent_race_name: Optional[str] = None
    recent_race_finish_time: Optional[str] = None

    # Distinct Standalone Half vs Marathon Halfway Split
    recent_half_marathon_time: Optional[str] = None
    recent_marathon_half_split: Optional[str] = None

    race_results: Optional[List[Dict[str, Any]]] = Field(default_factory=list)

class TrainingBaselineSchema(BaseModel):
    baseline_weekly_distance_km: float = 40.0
    baseline_runs_per_week: int = 4
    recent_longest_run_km: float = 16.0
    baseline_weekly_duration_min: Optional[float] = 240.0
    baseline_avg_training_pace_minkm: Optional[float] = 5.5
    training_intensity_distribution: Optional[Dict[str, Any]] = None
    training_phase: Optional[str] = "base"
    training_plan_type: Optional[str] = "self_designed"
    coach_supported: Optional[bool] = False

class PhysiologyBaselineSchema(BaseModel):
    resting_hr_bpm: Optional[int] = 52
    max_hr_bpm: Optional[int] = 188
    vo2max_ml_kg_min: Optional[float] = None
    vo2max_source: Optional[str] = "unknown"
    body_fat_pct: Optional[float] = None
    ffm_kg: Optional[float] = None
    lt_hr_bpm: Optional[int] = None
    lt_pace_minkm: Optional[float] = None
    threshold_pace_minkm: Optional[float] = None
    lab_running_economy: Optional[float] = None
    lab_running_economy_date: Optional[str] = None

class RecoveryBaselineSchema(BaseModel):
    baseline_sleep_hours: Optional[float] = 7.5
    sleep_quality: Optional[str] = "good"
    typical_recovery_score: Optional[int] = 4
    typical_fatigue_score: Optional[int] = 2
    typical_stress_score: Optional[int] = 2
    typical_motivation_score: Optional[int] = 4

class GoalsSchema(BaseModel):
    target_race_name: Optional[str] = None
    target_race_distance_km: Optional[float] = 42.195
    target_race_date: Optional[str] = None
    target_finish_time: Optional[str] = None
    primary_performance_goal: Optional[str] = "finish"

class PreferencesSchema(BaseModel):
    primary_surface: Optional[str] = "road"
    surface_distribution: Optional[Dict[str, Any]] = None
    typical_terrain: Optional[str] = "rolling"
    average_weekly_elevation_gain_m: Optional[float] = None
    preferred_race_course: Optional[str] = "flat"
    preferred_race_environment: Optional[str] = "cool"

class NutritionProfileSchema(BaseModel):
    dietary_pattern: Optional[str] = "no_preference"
    dietary_restrictions: Optional[str] = None
    fueling_experience: Optional[str] = "sometimes"
    typical_race_carbs_g_per_h: Optional[float] = None
    typical_race_hydration: Optional[str] = "water_and_electrolytes"

class HealthReadinessSchema(BaseModel):
    managing_injury: Optional[str] = "no"
    training_modified_by_injury: Optional[str] = "no"

class OnboardingPayload(BaseModel):
    athlete_id: str
    email: Optional[str] = ""
    personal: PersonalInfoSchema
    running_identity: RunningIdentitySchema
    performance: PerformanceBaselineSchema
    training_baseline: TrainingBaselineSchema
    physiology: Optional[PhysiologyBaselineSchema] = Field(default_factory=PhysiologyBaselineSchema)
    recovery: Optional[RecoveryBaselineSchema] = Field(default_factory=RecoveryBaselineSchema)
    goals: Optional[GoalsSchema] = Field(default_factory=GoalsSchema)
    preferences: Optional[PreferencesSchema] = Field(default_factory=PreferencesSchema)
    nutrition: Optional[NutritionProfileSchema] = Field(default_factory=NutritionProfileSchema)
    health: Optional[HealthReadinessSchema] = Field(default_factory=HealthReadinessSchema)
