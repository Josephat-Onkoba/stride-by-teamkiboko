import os
import torch
import numpy as np
import joblib
from train import CombinedStrideModel, time_to_seconds

OUTPUT_DIR = "artifacts"

def load_model():
    model = CombinedStrideModel()
    model.load_state_dict(torch.load(os.path.join(OUTPUT_DIR, "combined_stride_model.pth")))
    model.eval()
    return model

def predict_marathon_finish(age, gender, split_hhmmss):
    """
    Predict final marathon time given age, gender, and half-split.
    gender: 'M' or 'W'
    split_hhmmss: e.g. '01:30:00'
    """
    model = load_model()
    scaler_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_X.pkl'))
    scaler_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_y.pkl'))
    
    split_sec = time_to_seconds(split_hhmmss)
    gender_M = 1.0 if gender == 'M' else 0.0
    gender_W = 1.0 if gender == 'W' else 0.0
    
    X_input = np.array([[age, gender_M, gender_W, split_sec]])
    X_scaled = scaler_X.transform(X_input)
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
    
    with torch.no_grad():
        pred_scaled = model.forward_marathon(X_tensor).numpy()
        
    pred_sec = scaler_y.inverse_transform(pred_scaled)[0][0]
    
    hours = int(pred_sec // 3600)
    minutes = int((pred_sec % 3600) // 60)
    seconds = int(pred_sec % 60)
    
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

def predict_vo2(age, weight, height, sex, speed, hr, rr, ve):
    """
    Predict VO2 consumption given physiological markers.
    """
    model = load_model()
    scaler_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_X.pkl'))
    scaler_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_y.pkl'))
    
    X_input = np.array([[age, weight, height, sex, speed, hr, rr, ve]])
    X_scaled = scaler_X.transform(X_input)
    X_tensor = torch.tensor(X_scaled, dtype=torch.float32)
    
    with torch.no_grad():
        pred_scaled = model.forward_physio(X_tensor).numpy()
        
    pred_vo2 = scaler_y.inverse_transform(pred_scaled)[0][0]
    return pred_vo2

if __name__ == "__main__":
    print("--- Inference Tests ---")
    
    if not os.path.exists(os.path.join(OUTPUT_DIR, "combined_stride_model.pth")):
        print("Model not found. Please run train.py first to generate the artifacts.")
        exit(1)
        
    # Test Marathon
    test_age = 30
    test_gender = 'M'
    test_split = '01:25:00'
    final_pred = predict_marathon_finish(test_age, test_gender, test_split)
    print(f"Marathon Prediction for {test_age}yo {test_gender} with split {test_split} -> Final: {final_pred}")
    
    # Test Physio
    # Features: Age, Weight, Height, Sex, Speed, HR, RR, VE
    t_age, t_weight, t_height, t_sex, t_speed, t_hr, t_rr, t_ve = 25, 70, 175, 1, 10, 150, 30, 40
    vo2_pred = predict_vo2(t_age, t_weight, t_height, t_sex, t_speed, t_hr, t_rr, t_ve)
    print(f"VO2 Prediction for {t_age}yo, {t_weight}kg, {t_hr} BPM -> {vo2_pred:.2f} mL/min")
