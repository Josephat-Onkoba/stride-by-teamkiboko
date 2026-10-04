import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

# -------------------------------------------------------------------
# Configuration
# -------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _find_path(*candidates):
    for c in candidates:
        full = os.path.normpath(os.path.join(BASE_DIR, c))
        if os.path.exists(full):
            return full
    return os.path.normpath(os.path.join(BASE_DIR, candidates[0]))

_TREADMILL_DIR = "treadmill-maximal-exercise-tests-from-the-exercise-physiology-and-human-performance-lab-of-the-university-of-malaga-1.0.1"
VANDERPLAS_PATH = _find_path("../data/VanderPlas.csv", "../../VanderPlas.csv", "VanderPlas.csv")
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
OUTPUT_DIR = os.path.join(BASE_DIR, "artifacts")
EPOCHS = 30
BATCH_SIZE = 128
LEARNING_RATE = 0.001

os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------------------------------------------------------------------
# 1. Data Loading & Preprocessing
# -------------------------------------------------------------------
def time_to_seconds(t_str):
    if pd.isna(t_str): return np.nan
    parts = str(t_str).split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return np.nan

def load_marathon_data():
    print("Loading Marathon Dataset (VanderPlas)...")
    df = pd.read_csv(VANDERPLAS_PATH)
    df['split_sec'] = df['split'].apply(time_to_seconds)
    df['final_sec'] = df['final'].apply(time_to_seconds)
    df = df.dropna(subset=['age', 'gender', 'split_sec', 'final_sec'])
    
    # Encode gender
    df['gender_M'] = (df['gender'] == 'M').astype(float)
    df['gender_W'] = (df['gender'] == 'W').astype(float)
    
    X = df[['age', 'gender_M', 'gender_W', 'split_sec']].values
    y = df['final_sec'].values.reshape(-1, 1)
    return train_test_split(X, y, test_size=0.2, random_state=42)

def load_physio_data():
    print("Loading PhysioNet Datasets...")
    sub_df = pd.read_csv(PHYSIO_SUB_PATH)
    meas_df = pd.read_csv(PHYSIO_MEAS_PATH)
    
    # Merge on ID_test
    df = pd.merge(meas_df, sub_df, on="ID_test", suffixes=("", "_sub"))
    
    # Features: Age, Weight, Height, Sex, Speed, HR, RR, VE
    # Target: VO2
    features = ['Age', 'Weight', 'Height', 'Sex', 'Speed', 'HR', 'RR', 'VE']
    target = 'VO2'
    
    df = df.dropna(subset=features + [target])
    
    X = df[features].values
    y = df[target].values.reshape(-1, 1)
    return train_test_split(X, y, test_size=0.2, random_state=42)

class StrideDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)
    def __len__(self): return len(self.X)
    def __getitem__(self, idx): return self.X[idx], self.y[idx]

# -------------------------------------------------------------------
# 2. Combined Model Architecture
# -------------------------------------------------------------------
class CombinedStrideModel(nn.Module):
    def __init__(self):
        super(CombinedStrideModel, self).__init__()
        
        # Task 1A: Marathon MLP (Inputs: 4)
        self.marathon_net = nn.Sequential(
            nn.Linear(4, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )
        
        # Task 1B: Physiology MLP (Inputs: 8)
        self.physio_net = nn.Sequential(
            nn.Linear(8, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1)
        )

    def forward_marathon(self, x):
        return self.marathon_net(x)
        
    def forward_physio(self, x):
        return self.physio_net(x)

# -------------------------------------------------------------------
# 3. Training Script
# -------------------------------------------------------------------
def train():
    # Load Data
    X_mar_train, X_mar_val, y_mar_train, y_mar_val = load_marathon_data()
    X_phy_train, X_phy_val, y_phy_train, y_phy_val = load_physio_data()
    
    # Scalers
    scaler_mar_X = StandardScaler().fit(X_mar_train)
    scaler_mar_y = StandardScaler().fit(y_mar_train)
    scaler_phy_X = StandardScaler().fit(X_phy_train)
    scaler_phy_y = StandardScaler().fit(y_phy_train)
    
    joblib.dump(scaler_mar_X, os.path.join(OUTPUT_DIR, 'scaler_mar_X.pkl'))
    joblib.dump(scaler_mar_y, os.path.join(OUTPUT_DIR, 'scaler_mar_y.pkl'))
    joblib.dump(scaler_phy_X, os.path.join(OUTPUT_DIR, 'scaler_phy_X.pkl'))
    joblib.dump(scaler_phy_y, os.path.join(OUTPUT_DIR, 'scaler_phy_y.pkl'))
    
    # Datasets
    ds_mar_train = StrideDataset(scaler_mar_X.transform(X_mar_train), scaler_mar_y.transform(y_mar_train))
    ds_mar_val = StrideDataset(scaler_mar_X.transform(X_mar_val), scaler_mar_y.transform(y_mar_val))
    
    ds_phy_train = StrideDataset(scaler_phy_X.transform(X_phy_train), scaler_phy_y.transform(y_phy_train))
    ds_phy_val = StrideDataset(scaler_phy_X.transform(X_phy_val), scaler_phy_y.transform(y_phy_val))
    
    dl_mar_train = DataLoader(ds_mar_train, batch_size=BATCH_SIZE, shuffle=True)
    dl_mar_val = DataLoader(ds_mar_val, batch_size=BATCH_SIZE, shuffle=False)
    
    dl_phy_train = DataLoader(ds_phy_train, batch_size=BATCH_SIZE, shuffle=True)
    dl_phy_val = DataLoader(ds_phy_val, batch_size=BATCH_SIZE, shuffle=False)

    model = CombinedStrideModel()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    history = {'train_loss_mar': [], 'val_loss_mar': [], 'train_loss_phy': [], 'val_loss_phy': []}
    
    print(f"Starting Training for {EPOCHS} Epochs...")
    for epoch in range(EPOCHS):
        model.train()
        
        # Train Marathon
        train_mar_loss = 0
        for X_batch, y_batch in dl_mar_train:
            optimizer.zero_grad()
            preds = model.forward_marathon(X_batch)
            loss = criterion(preds, y_batch)
            loss.backward()
            optimizer.step()
            train_mar_loss += loss.item() * len(X_batch)
            
        # Train Physio
        train_phy_loss = 0
        for X_batch, y_batch in dl_phy_train:
            optimizer.zero_grad()
            preds = model.forward_physio(X_batch)
            loss = criterion(preds, y_batch)
            loss.backward()
            optimizer.step()
            train_phy_loss += loss.item() * len(X_batch)
            
        train_mar_loss /= len(ds_mar_train)
        train_phy_loss /= len(ds_phy_train)
        
        # Validation
        model.eval()
        val_mar_loss = 0
        with torch.no_grad():
            for X_batch, y_batch in dl_mar_val:
                preds = model.forward_marathon(X_batch)
                val_mar_loss += criterion(preds, y_batch).item() * len(X_batch)
        val_mar_loss /= len(ds_mar_val)
        
        val_phy_loss = 0
        with torch.no_grad():
            for X_batch, y_batch in dl_phy_val:
                preds = model.forward_physio(X_batch)
                val_phy_loss += criterion(preds, y_batch).item() * len(X_batch)
        val_phy_loss /= len(ds_phy_val)
        
        history['train_loss_mar'].append(train_mar_loss)
        history['val_loss_mar'].append(val_mar_loss)
        history['train_loss_phy'].append(train_phy_loss)
        history['val_loss_phy'].append(val_phy_loss)
        
        print(f"Epoch {epoch+1:02d}/{EPOCHS} | Mar Loss (T/V): {train_mar_loss:.4f}/{val_mar_loss:.4f} | Phy Loss (T/V): {train_phy_loss:.4f}/{val_phy_loss:.4f}")

    # Save Model
    torch.save(model.state_dict(), os.path.join(OUTPUT_DIR, "combined_stride_model.pth"))
    print("\nModel saved to artifacts/combined_stride_model.pth")
    
    # Plotting
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(history['train_loss_mar'], label='Train')
    plt.plot(history['val_loss_mar'], label='Validation')
    plt.title('Marathon Time Prediction Loss (MSE)')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history['train_loss_phy'], label='Train')
    plt.plot(history['val_loss_phy'], label='Validation')
    plt.title('Physiological VO2 Prediction Loss (MSE)')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.tight_layout()
    plot_path = os.path.join(OUTPUT_DIR, "training_curves.png")
    plt.savefig(plot_path)
    print(f"Training graphs saved to {plot_path}")

if __name__ == "__main__":
    train()
