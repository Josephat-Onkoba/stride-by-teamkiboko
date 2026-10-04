# Stride v3: Comprehensive System Architecture & Functionality Report

## 1. Executive Summary
Stride v3 is an advanced, decision-support system designed for endurance athletes. It transcends standard pace calculators by seamlessly integrating a **Machine Learning Performance Engine (Task 1A)** with a **Biomathematical Physiology & Nutrition Engine (Task 1B)**. 

The system treats marathon performance as a multifactorial equation—accounting not just for an athlete's age and splits, but for the precise biomechanical difficulty of the specific race course, real-time environmental heat stress, aerodynamic wind drag, and internal glycogen depletion.

---

## 2. Core Architecture

The system operates on a decoupled but sequentially integrated two-stage architecture.

### Task 1A: The Performance Engine
The goal of Task 1A is to accurately predict an athlete's marathon finish time. 

*   **Baseline (VanderPlas MLP):** The foundational model takes the runner's Age, Gender, and Half-Marathon Split to estimate a baseline finish time.
*   **Environment & Course Adjuster:** The v3 API applies advanced sports-science heuristics over the baseline model. It parses the elevation profile of the chosen race (e.g., Boston, Berlin) and real-time weather (Temperature, Humidity, Wind). It then calculates a dynamic **Penalty/Slowdown Percentage** which alters the projected finish time and target pace.
*   **Ablation Study Framework:** The system includes a fully functional ML pipeline (`train_ablation.py`) capable of training five distinct models (Model A through E) to mathematically prove the value of adding course and weather features to the baseline prediction.

### Task 1B: The Physiology Engine
The goal of Task 1B is to generate a personalized fueling and recovery protocol based on the projected finish time from Task 1A.

*   **PhysioNet Calibration:** The engine uses physiological curves derived from massive PhysioNet treadmill datasets to map an athlete's resting and max heart rates to their estimated VO₂max and submaximal oxygen demand.
*   **Substrate Oxidation:** It calculates the Respiratory Exchange Ratio (RER) at the target race pace to determine exactly how many grams of Carbohydrates (CHO) versus Fat the athlete is burning per minute.
*   **Glycogen Balance Model:** It constructs a literal "fuel tank" for the athlete, estimating starting glycogen (accounting for carb-loading protocols), subtracting the CHO burned over the adjusted race duration, and adding the CHO ingested via race nutrition (e.g., gels). It outputs a **Wall Risk** score (Low/Moderate/High) if remaining glycogen dips dangerously low.

---

## 3. Feature Engineering & Data Pipelines

The intelligence of the system relies on three robust feature generation pipelines (`ml/data/`):

### A. Course Engineering (`course_utils.py`)
*   **Presets:** Contains pre-loaded elevation matrices and global headings for Major Marathons (Boston, NYC, Berlin, Chicago, London, Tokyo).
*   **Metrics Generated:** Total Ascent/Descent, Mean Grade, Max Uphill/Downhill Grade, and a composite **Course Difficulty Score**.

### B. Weather Engineering (`weather_utils.py`)
*   **Data Source:** Integrates with the NOAA / Open-Meteo historical climate APIs to fetch race-day conditions.
*   **Metrics Generated:** 
    *   **WBGT (Wet-Bulb Globe Temperature) & Dew Point:** Calculates severe heat-stress impacts on the cardiovascular system.
    *   **Wind Decomposition:** Uses vector math against the runner's heading and the course's global heading to split raw wind speed into precise **Headwind**, **Crosswind**, and **Tailwind** vectors.

### C. The ML Dataset Merge
The system ingests the **Boston Marathon Results (2013-2014)**, merges it with historical **NOAA weather data** from those exact race days, and synthesizes training volumes based on distributions found in the **Afonseca dataset**. This creates a 47,000+ row dataset with 11 distinct features for advanced model training.

---

## 4. API Backend (FastAPI)

The backend (`ml/server.py`) exposes several endpoints to serve the frontend:

*   `POST /predict/marathon/v2`: Returns the base MLP prediction alongside the environment-adjusted prediction, including detailed course and weather penalty breakdowns.
*   `POST /predict/full-plan/v2`: The master endpoint. It chains Task 1A (adjusted for environment) directly into Task 1B, returning the complete physiological profile and nutrition plan tailored to the *slower/faster* adjusted race pace.
*   `GET /courses`: Returns available course presets.
*   `POST /weather/calculate`: A utility endpoint to test WBGT and Wind Decomposition math.

---

## 5. Frontend Interfaces (React/Vite)

The user interface translates complex biomathematics into actionable insights.

*   **Athlete Dashboard (`app.tsx`)**: The central hub. Athletes input their physiological metrics and select their target race and forecast weather. The dashboard visualizes the Base Pace vs the Environment-Adjusted Pace, alongside their VO₂max, RER, and real-time CHO burn rates.
*   **Fuel Lab (`fuel.tsx`)**: An interactive fueling simulator. As the athlete adjusts their intended Gel intake (e.g., from 30g/hr to 60g/hr), the Glycogen Balance Model dynamically updates to show if they will "hit the wall" before the finish line. It also provides exact pre-race carb-loading targets.
*   **AI Prediction Lab (`train.tsx`)**: An educational sandbox designed to showcase the system's underlying capabilities. Users can manually tweak weather variables (like turning a 2m/s tailwind into a 10m/s headwind) and watch the predicted finish time and slowdown percentages react instantly.
