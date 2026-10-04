import React, { useState } from "react";
import { X, Plus, Calendar, Clock, Gauge, Heart, Activity, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LogActivityModalProps {
  athleteId: string;
  isOpen: boolean;
  onClose: () => void;
  onActivityLogged?: () => void;
}

export function LogActivityModal({
  athleteId,
  isOpen,
  onClose,
  onActivityLogged,
}: LogActivityModalProps) {
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split("T")[0]);
  const [activityType, setActivityType] = useState("easy_run");
  const [distanceKm, setDistanceKm] = useState("10.0");
  const [durationMin, setDurationMin] = useState("50");
  const [averageHr, setAverageHr] = useState("");
  const [perceivedExertion, setPerceivedExertion] = useState(5);
  const [feelingScore, setFeelingScore] = useState(4);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const dist = parseFloat(distanceKm) || 0;
  const dur = parseFloat(durationMin) || 0;
  const paceSec = dist > 0 && dur > 0 ? (dur * 60) / dist : 0;
  const paceMin = Math.floor(paceSec / 60);
  const paceRemSec = Math.round(paceSec % 60);
  const formattedPace = dist > 0 && dur > 0 ? `${paceMin}:${String(paceRemSec).padStart(2, "0")} /km` : "—";
  const rpeLoad = dur > 0 ? Math.round(dur * perceivedExertion) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dist <= 0 || dur <= 0) {
      setError("Please enter valid distance and duration.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athlete_id: athleteId,
          activity_date: activityDate,
          activity_type: activityType,
          distance_km: dist,
          duration_min: dur,
          average_hr: averageHr ? parseFloat(averageHr) : null,
          perceived_exertion: perceivedExertion,
          session_rpe_load: rpeLoad,
          feeling_score: feelingScore,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to log activity in SQLite database");
      }

      if (onActivityLogged) {
        onActivityLogged();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving the activity.");
    } finally {
      setLoading(false);
    }
  };

  const RPE_LABELS: Record<number, string> = {
    1: "Very light / recovery",
    2: "Easy conversational",
    3: "Moderate aerobic",
    4: "Steady endurance",
    5: "Comfortably hard (Marathon pace)",
    6: "Threshold / Half Marathon",
    7: "Vigorous / 10K pace",
    8: "Hard / 5K interval",
    9: "Very hard / sprint finish",
    10: "Maximal exhaustion",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Log Training Activity</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Type</Label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono"
              >
                <option value="easy_run">Easy Run</option>
                <option value="tempo_run">Tempo / Threshold</option>
                <option value="interval">Track / Intervals</option>
                <option value="long_run">Long Run</option>
                <option value="race">Race</option>
                <option value="recovery_run">Recovery Jog</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Distance (km)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Duration (min)</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="mt-1 font-mono text-sm"
                required
              />
            </div>
          </div>

          {/* Computed Metrics Preview */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Calculated Pace</span>
              <p className="mt-0.5 font-mono text-base font-bold text-primary">{formattedPace}</p>
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">Session RPE Load</span>
              <p className="mt-0.5 font-mono text-base font-bold text-warning">{rpeLoad} AU</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Average HR (bpm)</Label>
              <Input
                type="number"
                placeholder="Optional"
                value={averageHr}
                onChange={(e) => setAverageHr(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase text-muted-foreground">Feeling (1–5)</Label>
              <select
                value={feelingScore}
                onChange={(e) => setFeelingScore(Number(e.target.value))}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm font-mono"
              >
                <option value={1}>1 - Terrible / Sluggish</option>
                <option value={2}>2 - Heavy legs</option>
                <option value={3}>3 - Normal / Average</option>
                <option value={4}>4 - Strong & Smooth</option>
                <option value={5}>5 - Excellent / Flying</option>
              </select>
            </div>
          </div>

          {/* Perceived Exertion (RPE 1-10) */}
          <div>
            <div className="flex justify-between text-xs">
              <Label className="font-mono uppercase text-muted-foreground">Perceived Exertion (RPE)</Label>
              <span className="font-mono font-semibold text-primary">{perceivedExertion} / 10</span>
            </div>
            <div className="mt-2 grid grid-cols-10 gap-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPerceivedExertion(level)}
                  className={`flex h-8 items-center justify-center rounded border font-mono text-xs transition-colors ${
                    perceivedExertion === level
                      ? "border-primary bg-primary text-primary-foreground font-bold"
                      : "border-border/60 bg-muted/10 hover:border-primary/50"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground text-center">
              {RPE_LABELS[perceivedExertion]}
            </p>
          </div>

          <div>
            <Label className="text-xs font-mono uppercase text-muted-foreground">Notes (Optional)</Label>
            <Input
              placeholder="Weather, terrain, shoes, pacing notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 text-sm"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-primary-foreground font-semibold">
              {loading ? "Recording..." : "Save Activity & Update ACWR"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
