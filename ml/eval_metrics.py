import os
import torch
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

from train import load_marathon_data, load_physio_data, CombinedStrideModel

def evaluate():
    print("--- Dataset Information ---")
    X_mar_train, X_mar_val, y_mar_train, y_mar_val = load_marathon_data()
    X_phy_train, X_phy_val, y_phy_train, y_phy_val = load_physio_data()
    
    print(f"Marathon Dataset: {X_mar_train.shape[0] + X_mar_val.shape[0]} total samples")
    print(f"  Training samples: {X_mar_train.shape[0]}, Validation samples: {X_mar_val.shape[0]}")
    print(f"  Features: {X_mar_train.shape[1]}")
    
    print(f"Physiology Dataset: {X_phy_train.shape[0] + X_phy_val.shape[0]} total samples")
    print(f"  Training samples: {X_phy_train.shape[0]}, Validation samples: {X_phy_val.shape[0]}")
    print(f"  Features: {X_phy_train.shape[1]}")
    
    print("\n--- Model Evaluation ---")
    OUTPUT_DIR = "artifacts"
    model = CombinedStrideModel()
    model.load_state_dict(torch.load(os.path.join(OUTPUT_DIR, "combined_stride_model.pth")))
    model.eval()
    
    scaler_mar_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_X.pkl'))
    scaler_mar_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_mar_y.pkl'))
    scaler_phy_X = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_X.pkl'))
    scaler_phy_y = joblib.load(os.path.join(OUTPUT_DIR, 'scaler_phy_y.pkl'))
    
    # Evaluate Marathon
    X_mar_val_scaled = scaler_mar_X.transform(X_mar_val)
    X_mar_val_tensor = torch.tensor(X_mar_val_scaled, dtype=torch.float32)
    with torch.no_grad():
        preds_mar_scaled = model.forward_marathon(X_mar_val_tensor).numpy()
    preds_mar = scaler_mar_y.inverse_transform(preds_mar_scaled)
    
    mae_mar = mean_absolute_error(y_mar_val, preds_mar)
    rmse_mar = np.sqrt(mean_squared_error(y_mar_val, preds_mar))
    r2_mar = r2_score(y_mar_val, preds_mar)
    
    print("Marathon Validation Results:")
    print(f"  MAE:  {mae_mar:.4f}")
    print(f"  RMSE: {rmse_mar:.4f}")
    print(f"  R2:   {r2_mar:.4f}")
    
    # Evaluate Physio
    X_phy_val_scaled = scaler_phy_X.transform(X_phy_val)
    X_phy_val_tensor = torch.tensor(X_phy_val_scaled, dtype=torch.float32)
    with torch.no_grad():
        preds_phy_scaled = model.forward_physio(X_phy_val_tensor).numpy()
    preds_phy = scaler_phy_y.inverse_transform(preds_phy_scaled)
    
    mae_phy = mean_absolute_error(y_phy_val, preds_phy)
    rmse_phy = np.sqrt(mean_squared_error(y_phy_val, preds_phy))
    r2_phy = r2_score(y_phy_val, preds_phy)
    
    print("\nPhysiology Validation Results:")
    print(f"  MAE:  {mae_phy:.4f}")
    print(f"  RMSE: {rmse_phy:.4f}")
    print(f"  R2:   {r2_phy:.4f}")

if __name__ == '__main__':
    evaluate()
