import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { Activity, Heart, Zap, Flame, ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/train")({
  head: () => ({ meta: [{ title: "AI Model Lab — Stride" }] }),
  component: Train,
});

function Train() {
  // Task 1A inputs
  const [halfSplit, setHalfSplit] = useState("95");
  const [age, setAge] = useState("28");
  const [category, setCategory] = useState("M");
  
  // Task 1B inputs
  const [weightKg, setWeightKg] = useState("70");
  const [heightCm, setHeightCm] = useState("178");
  const [sex, setSex] = useState("1");
  const [hrRest, setHrRest] = useState("52");
  const [hrMax, setHrMax] = useState("188");
  const [trainingHours, setTrainingHours] = useState("8");
  
  // Course & Weather
  const [courseId, setCourseId] = useState("boston");
  const [temperature, setTemperature] = useState("20");
  const [humidity, setHumidity] = useState("70");
  const [windSpeed, setWindSpeed] = useState("4.5");
  const [windDirection, setWindDirection] = useState("90");
  
  // Results
  const [result, setResult] = useState<any>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPhysio, setShowPhysio] = useState(false);

  const runPrediction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const h = Math.floor(parseInt(halfSplit, 10) / 60);
      const m = parseInt(halfSplit, 10) % 60;
      const split_hhmmss = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;

      const res = await fetch('/api/predict/full-plan/v2', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          split_hhmmss,
          age: parseInt(age, 10),
          gender: category,
          weight_kg: parseFloat(weightKg),
          height_cm: parseFloat(heightCm),
          sex: parseInt(sex, 10),
          hr_rest: parseFloat(hrRest),
          hr_max: parseFloat(hrMax),
          training_hours_per_week: parseFloat(trainingHours),
          is_carb_loaded: true,
          course_id: courseId,
          temperature_c: parseFloat(temperature),
          relative_humidity_pct: parseFloat(humidity),
          wind_speed_mps: parseFloat(windSpeed),
          wind_direction_deg: parseFloat(windDirection),
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.task_1a) {
        setResult(data);
        setSource("Stride Full Pipeline (Task 1A → 1B)");
      } else {
        setError("Prediction failed.");
      }
    } catch {
      setError("Failed to connect to the prediction API.");
    } finally {
      setLoading(false);
    }
  };

  const t1a = result?.task_1a;
  const t1b = result?.task_1b;
  const physio = t1b?.physiology;
  const substrates = physio?.substrates;

  return (
    <AppShell>
      <p className="font-mono text-xs uppercase text-primary">Model Lab</p>
      <h1 className="mt-2 text-3xl font-semibold">AI Prediction Lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">Run the full Stride pipeline: Task 1A (Marathon MLP) → Task 1B (Physiology Engine)</p>
      
      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        {/* Input Panel */}
        <section className="border border-border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Athlete Parameters</h2>
            <EvidenceBadge kind="P" />
          </div>
          <form onSubmit={runPrediction} className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Task 1A — Performance</p>
            <div className="space-y-2">
              <Label>Half-Marathon Split (minutes)</Label>
              <Input type="number" value={halfSplit} onChange={e => setHalfSplit(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Age</Label>
                <Input type="number" value={age} onChange={e => setAge(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <select className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm rounded-md" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="M">Male (M)</option>
                  <option value="W">Female (W)</option>
                </select>
              </div>
            </div>
            
            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-widest mb-3">Task 1B — Physiology</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Resting HR</Label>
                  <Input type="number" value={hrRest} onChange={e => setHrRest(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Max HR</Label>
                  <Input type="number" value={hrMax} onChange={e => setHrMax(e.target.value)} required />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-widest mb-3">Task 1B — Environment & Course</p>
              <div className="space-y-2 mb-3">
                <Label>Course Profile</Label>
                <select className="flex h-10 w-full border border-input bg-background px-3 py-2 text-sm rounded-md" value={courseId} onChange={e => setCourseId(e.target.value)}>
                  <option value="boston">Boston Marathon</option>
                  <option value="new_york">New York City Marathon</option>
                  <option value="berlin">Berlin Marathon</option>
                  <option value="chicago">Chicago Marathon</option>
                  <option value="london">London Marathon</option>
                  <option value="tokyo">Tokyo Marathon</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Temp (°C)</Label>
                  <Input type="number" value={temperature} onChange={e => setTemperature(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Humidity (%)</Label>
                  <Input type="number" value={humidity} onChange={e => setHumidity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Wind (m/s)</Label>
                  <Input type="number" step="0.1" value={windSpeed} onChange={e => setWindSpeed(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Wind Dir (°)</Label>
                  <Input type="number" value={windDirection} onChange={e => setWindDirection(e.target.value)} required />
                </div>
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="w-full mt-4">
              {loading ? "Running Full Pipeline..." : "Run Full Pipeline"}
            </Button>
            {error && <p className="text-sm text-warning">{error}</p>}
          </form>
        </section>
        
        {/* Results Panel */}
        <div className="space-y-5">
          {/* Task 1A Result */}
          <section className="border border-border bg-card p-6 flex flex-col justify-center items-center text-center min-h-[200px]">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Task 1A · Projected Finish Time</p>
            {t1a ? (
              <div className="mt-4">
                {t1a.adjusted_final_time ? (
                  <>
                    <p className="font-mono text-6xl font-bold text-warning">{t1a.adjusted_final_time}</p>
                    <p className="font-mono text-lg text-muted-foreground mt-2 line-through">{t1a.final_time} base</p>
                    <p className="mt-2 text-sm text-warning">Environment Adjusted (+{t1a.slowdown_pct}%)</p>
                    <p className="font-mono text-lg text-muted-foreground mt-2">Adjusted Pace: {t1a.adjusted_target_pace}</p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-6xl font-bold text-primary">{t1a.final_time}</p>
                    <p className="font-mono text-lg text-muted-foreground mt-2">Pace: {t1a.target_pace}</p>
                  </>
                )}
                <div className="mt-4 flex flex-col items-center gap-2">
                  <EvidenceBadge kind="V" />
                  <p className="text-xs text-muted-foreground">Source: {source}</p>
                </div>
              </div>
            ) : (
              <p className="mt-6 font-mono text-4xl text-muted-foreground">--:--:--</p>
            )}
          </section>

          {/* Task 1B Result */}
          {physio && (
            <section className="border border-border bg-card p-6">
              <button 
                className="w-full flex justify-between items-center"
                onClick={() => setShowPhysio(!showPhysio)}
              >
                <p className="text-sm font-semibold">Task 1B · Physiology + Nutrition</p>
                {showPhysio ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              
              {showPhysio && (
                <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Heart className="size-3" /> VO₂max</p>
                      <p className="font-mono text-xl font-semibold mt-1">{physio.vo2max_ml_kg_min} <span className="text-xs text-muted-foreground">mL/kg/min</span></p>
                    </div>
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Activity className="size-3" /> Intensity</p>
                      <p className="font-mono text-xl font-semibold mt-1">{physio.pct_vo2max}% <span className="text-xs text-muted-foreground">VO₂max</span></p>
                    </div>
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="size-3" /> RER</p>
                      <p className="font-mono text-xl font-semibold mt-1">{physio.rer}</p>
                    </div>
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="size-3" /> FFM</p>
                      <p className="font-mono text-xl font-semibold mt-1">{physio.ffm_kg} <span className="text-xs text-muted-foreground">kg</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground">CHO oxidation</p>
                      <p className="font-mono text-lg font-semibold text-primary">{substrates?.cho_oxidation_g_hr} g/hr</p>
                      <p className="text-xs text-muted-foreground">{substrates?.cho_contribution_pct}% of energy</p>
                    </div>
                    <div className="bg-muted/30 p-3 border border-border">
                      <p className="text-xs text-muted-foreground">Fat oxidation</p>
                      <p className="font-mono text-lg font-semibold text-warning">{substrates?.fat_oxidation_g_hr} g/hr</p>
                      <p className="text-xs text-muted-foreground">{substrates?.fat_contribution_pct}% of energy</p>
                    </div>
                  </div>
                  {t1a?.training_recommendation && (
                    <div className="border-t border-border pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Training zones</p>
                      <div className="flex justify-between"><span className="text-muted-foreground">Easy</span><span className="font-mono">{t1a.training_recommendation.easy_pace}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Tempo</span><span className="font-mono">{t1a.training_recommendation.tempo_pace}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Long run</span><span className="font-mono">{t1a.training_recommendation.long_run_pace}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Weekly km</span><span className="font-mono">{t1a.training_recommendation.weekly_volume_km}</span></div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}