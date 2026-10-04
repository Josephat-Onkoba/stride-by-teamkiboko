import React, { useState, useEffect } from "react";
import { ShieldAlert, ShieldCheck, Activity, Info, Flame, AlertTriangle } from "lucide-react";

export interface AcwrGaugeProps {
  athleteId?: string;
  reloadKey?: number;
  acwr?: number;
  acwrZone?: "undertraining" | "optimal" | "caution" | "high_risk" | string;
  acuteDistanceKm?: number;
  chronicWeeklyAvgKm?: number;
  trainingMonotony?: number;
  trainingStrain?: number;
  featureSource?: "hybrid_baseline" | "fully_wearable" | string;
  compact?: boolean;
}

export function AcwrGauge({
  athleteId,
  reloadKey,
  acwr: propAcwr,
  acwrZone: propAcwrZone,
  acuteDistanceKm: propAcuteDist,
  chronicWeeklyAvgKm: propChronicAvg,
  trainingMonotony: propMonotony,
  trainingStrain: propStrain,
  featureSource: propSource,
  compact = false,
}: AcwrGaugeProps) {
  const [fetchedData, setFetchedData] = useState<any>(null);

  useEffect(() => {
    if (!athleteId) return;
    fetch(`/api/athlete/acwr/${athleteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.acwr !== undefined) {
          setFetchedData(data);
        }
      })
      .catch(console.error);
  }, [athleteId, reloadKey]);

  const acwr = propAcwr !== undefined ? propAcwr : (fetchedData?.acwr ?? 1.0);
  const acwrZone = propAcwrZone || fetchedData?.acwr_zone || "optimal";
  const acuteDistanceKm = propAcuteDist !== undefined ? propAcuteDist : fetchedData?.acute_distance_7d_km;
  const chronicWeeklyAvgKm = propChronicAvg !== undefined ? propChronicAvg : fetchedData?.chronic_weekly_avg_km;
  const trainingMonotony = propMonotony !== undefined ? propMonotony : fetchedData?.training_monotony;
  const trainingStrain = propStrain !== undefined ? propStrain : fetchedData?.training_strain;
  const featureSource = propSource || fetchedData?.feature_source || "hybrid_baseline";

  // Normalize ACWR position on a 0 to 2.0 scale (percentage 0 to 100%)
  const percentage = Math.min(100, Math.max(0, (acwr / 2.0) * 100));

  const zoneConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    undertraining: {
      label: "Undertraining / Detraining",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      icon: <Info className="size-4 text-blue-500" />,
    },
    optimal: {
      label: "Optimal Sweet Spot",
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/30",
      icon: <ShieldCheck className="size-4 text-success" />,
    },
    caution: {
      label: "Elevated Fatigue / Caution",
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/30",
      icon: <AlertTriangle className="size-4 text-warning" />,
    },
    high_risk: {
      label: "Workload Spike / High Risk",
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/30",
      icon: <ShieldAlert className="size-4 text-destructive" />,
    },
  };

  const defaultZone = zoneConfig["optimal"]!;
  const currentZone = (zoneConfig[acwrZone]) ? zoneConfig[acwrZone]! : defaultZone;


  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${currentZone.border} ${currentZone.bg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {currentZone.icon}
            <span className="font-mono text-xs font-semibold uppercase">{currentZone.label}</span>
          </div>
          <span className="font-mono text-base font-bold">{acwr.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Workload Engine · Acute:Chronic Workload Ratio
            </h3>
          </div>
          <p className="mt-1 text-sm font-semibold">Gabbett Training Load & Readiness</p>
        </div>

        <div className="flex items-center gap-2">
          {featureSource === "hybrid_baseline" ? (
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase" title="Bootstrapped from onboarding baseline until 7+ days of continuous activities accumulate">
              Hybrid Baseline
            </span>
          ) : (
            <span className="rounded bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success uppercase">
              Empirical Wearable Data
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium font-mono ${currentZone.bg} ${currentZone.color}`}>
            {currentZone.icon}
            {currentZone.label}
          </span>
        </div>
      </div>

      {/* Main Gauge Graphic */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="font-mono text-4xl font-bold tracking-tight text-foreground">{acwr.toFixed(2)}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">ACWR (7d : 28d)</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">Safe Zone: 0.80 – 1.30</span>
        </div>

        {/* 4-Zone Segmented Bar with Pointer */}
        <div className="relative mt-3">
          {/* Track segments */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/40">
            {/* 0.0 to 0.8: Undertraining (40% width) */}
            <div className="w-[40%] bg-blue-500/40 border-r border-background" title="< 0.80 Undertraining" />
            {/* 0.8 to 1.3: Sweet spot (25% width) */}
            <div className="w-[25%] bg-success/70 border-r border-background" title="0.80 - 1.30 Sweet Spot" />
            {/* 1.3 to 1.5: Caution (10% width) */}
            <div className="w-[10%] bg-warning/70 border-r border-background" title="1.30 - 1.50 Caution" />
            {/* 1.5 to 2.0+: High Risk (25% width) */}
            <div className="w-[25%] bg-destructive/70" title="> 1.50 High Risk" />
          </div>

          {/* Needle / Indicator */}
          <div
            className="absolute -top-1.5 transition-all duration-500 ease-out"
            style={{ left: `calc(${percentage}% - 6px)` }}
          >
            <div className="size-6 rounded-full border-2 border-background bg-foreground shadow-md flex items-center justify-center">
              <div className="size-1.5 rounded-full bg-background" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2.5 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0.0 (Detraining)</span>
          <span className="text-success font-semibold">0.80</span>
          <span className="text-success font-semibold">1.30</span>
          <span className="text-warning">1.50</span>
          <span className="text-destructive font-semibold">2.0+ (Spike)</span>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-4">
        <div className="rounded border border-border/40 bg-muted/20 p-2.5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Acute Load (7d)</p>
          <p className="mt-1 font-mono text-base font-semibold">
            {acuteDistanceKm !== undefined ? `${acuteDistanceKm} km` : "—"}
          </p>
        </div>
        <div className="rounded border border-border/40 bg-muted/20 p-2.5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Chronic Avg (28d)</p>
          <p className="mt-1 font-mono text-base font-semibold">
            {chronicWeeklyAvgKm !== undefined ? `${chronicWeeklyAvgKm} km/wk` : "—"}
          </p>
        </div>
        <div className="rounded border border-border/40 bg-muted/20 p-2.5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Monotony (Foster)</p>
          <p className="mt-1 font-mono text-base font-semibold text-primary">
            {trainingMonotony !== undefined ? trainingMonotony.toFixed(2) : "—"}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">Target &lt; 2.0</p>
        </div>
        <div className="rounded border border-border/40 bg-muted/20 p-2.5">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Training Strain</p>
          <p className="mt-1 font-mono text-base font-semibold text-warning">
            {trainingStrain !== undefined ? Math.round(trainingStrain) : "—"}
          </p>
          <p className="font-mono text-[9px] text-muted-foreground">Weekly Strain AU</p>
        </div>
      </div>
    </div>
  );
}
