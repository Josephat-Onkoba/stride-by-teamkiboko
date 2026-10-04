import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Data Loading
def time_to_seconds(t_str):
    if pd.isna(t_str): return np.nan
    parts = str(t_str).split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return np.nan

def load_marathon_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.normpath(os.path.join(base_dir, "../data/VanderPlas.csv")),
        os.path.normpath(os.path.join(base_dir, "../../VanderPlas.csv")),
        "VanderPlas.csv",
    ]
    path = next((c for c in candidates if os.path.exists(c)), candidates[0])
    df = pd.read_csv(path)
    df['split_sec'] = df['split'].apply(time_to_seconds)
    df['final_sec'] = df['final'].apply(time_to_seconds)
    df = df.dropna(subset=['age', 'gender', 'split_sec', 'final_sec'])
    df['gender_M'] = (df['gender'] == 'M').astype(float)
    df['gender_W'] = (df['gender'] == 'W').astype(float)
    X = df[['age', 'gender_M', 'gender_W', 'split_sec']].values
    y = df['final_sec'].values.reshape(-1, 1)
    return train_test_split(X, y, test_size=0.2, random_state=42)

class StrideDataset(Dataset):
    def __init__(self, X, y):
        self.X = torch.tensor(X, dtype=torch.float32)
        self.y = torch.tensor(y, dtype=torch.float32)
    def __len__(self): return len(self.X)
    def __getitem__(self, idx): return self.X[idx], self.y[idx]

class MarathonMLP(nn.Module):
    def __init__(self):
        super(MarathonMLP, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(4, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )
    def forward(self, x):
        return self.net(x)

def run_experiments():
    print("Loading Data...")
    X_train, X_val, y_train, y_val = load_marathon_data()
    
    scaler_X = StandardScaler().fit(X_train)
    scaler_y = StandardScaler().fit(y_train)
    
    X_train_s = scaler_X.transform(X_train)
    X_val_s = scaler_X.transform(X_val)
    y_train_s = scaler_y.transform(y_train)
    y_val_s = scaler_y.transform(y_val)
    
    ds_train = StrideDataset(X_train_s, y_train_s)
    dl_train = DataLoader(ds_train, batch_size=128, shuffle=True)
    
    print("\n--- 1. BASELINE MODEL: Linear Regression ---")
    lr_model = LinearRegression()
    lr_model.fit(X_train_s, y_train)
    preds_lr = lr_model.predict(X_val_s)
    
    print(f"MAE:  {mean_absolute_error(y_val, preds_lr):.4f}")
    print(f"RMSE: {np.sqrt(mean_squared_error(y_val, preds_lr)):.4f}")
    print(f"R2:   {r2_score(y_val, preds_lr):.4f}")
    
    print("\n--- 2. EXPERIMENTAL VARIABLE: Learning Rate ---")
    learning_rates = [0.01, 0.001, 0.0001]
    
    for lr in learning_rates:
        print(f"\nCondition: Learning Rate = {lr}")
        model = MarathonMLP()
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=lr)
        
        # Train for 10 epochs for quick comparison
        epochs = 10
        for epoch in range(epochs):
            model.train()
            for X_batch, y_batch in dl_train:
                optimizer.zero_grad()
                preds = model(X_batch)
                loss = criterion(preds, y_batch)
                loss.backward()
                optimizer.step()
                
        # Eval
        model.eval()
        X_val_tensor = torch.tensor(X_val_s, dtype=torch.float32)
        with torch.no_grad():
            preds_s = model(X_val_tensor).numpy()
        
        preds_real = scaler_y.inverse_transform(preds_s)
        print(f"MAE:  {mean_absolute_error(y_val, preds_real):.4f}")
        print(f"RMSE: {np.sqrt(mean_squared_error(y_val, preds_real)):.4f}")
        print(f"R2:   {r2_score(y_val, preds_real):.4f}")

if __name__ == '__main__':
    run_experiments()
