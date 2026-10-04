import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Activity, Flame, Zap, Heart } from "lucide-react";
import { AppShell } from "@/components/stride/app-shell";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({ head: () => ({ meta: [{ title: "Today — Stride" },{ name: "description", content: "Your latest marathon projection, weekly training load, and attention items." },{ property: "og:title", content: "Today — Stride" },{ property: "og:description", content: "Athlete decision-support dashboard." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" }] }), component: Today });

const attentionItems = [
  { title: "Body mass is 18 days old", copy: "Update before the next fuel calculation", action: "Update data", Icon: AlertCircle },
  { title: "Coach review pending", copy: "Berlin taper proposal · submitted yesterday", action: "View review", Icon: CheckCircle2 },
];

function Today() { 
  const [email, setEmail] = useState("Athlete");
  const [fullPlan, setFullPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Task 1A inputs
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState("M");
  const [split, setSplit] = useState("01:35:00");
  
  // Task 1B physiology inputs
  const [weightKg, setWeightKg] = useState(70);
  const [heightCm, setHeightCm] = useState(178);
  const [sex, setSex] = useState(1);
  const [hrRest, setHrRest] = useState(52);
  const [hrMax, setHrMax] = useState(188);
  const [trainingHours, setTrainingHours] = useState(8);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email.split('@')[0] || "Athlete");
      }
    }).catch(console.error);
  }, []);

  // Course & Weather
  const [courseId, setCourseId] = useState("boston");
  const [temperature, setTemperature] = useState(20);
  const [humidity, setHumidity] = useState(70);
  const [windSpeed, setWindSpeed] = useState(4.5);
  const [windDirection, setWindDirection] = useState(90);

  useEffect(() => {
    setLoading(true);
    fetch('/api/predict/full-plan/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age, gender, split_hhmmss: split,
        weight_kg: weightKg, height_cm: heightCm, sex,
        hr_rest: hrRest, hr_max: hrMax,
        training_hours_per_week: trainingHours,
        is_carb_loaded: true,
        course_id: courseId,
        temperature_c: temperature,
        relative_humidity_pct: humidity,
        wind_speed_mps: windSpeed,
        wind_direction_deg: windDirection,
      })
    })
    .then(res => res.json())
    .then(data => { setFullPlan(data); setLoading(false); })
    .catch(() => setLoading(false));
  }, [age, gender, split, weightKg, heightCm, sex, hrRest, hrMax, trainingHours, courseId, temperature, humidity, windSpeed, windDirection]);

  const t1a = fullPlan?.task_1a;
  const t1b = fullPlan?.task_1b;
  const physio = t1b?.physiology;
  const substrates = physio?.substrates;
  const glycogen = t1b?.glycogen_balance;
  const weather = fullPlan?.weather;
  const course = fullPlan?.course;

  return <AppShell><div className="mb-8"><p className="font-mono text-xs uppercase text-primary">Monday · 28 September</p><h1 className="mt-2 text-3xl font-semibold capitalize">Good morning, {email}.</h1><p className="mt-1 text-sm text-muted-foreground">Full pipeline active — Task 1A → 1B synced.</p></div><div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">

  {/* Task 1A: Marathon Projection */}
  <section className="border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-6"><div className="flex justify-between"><p className="text-sm font-semibold">Task 1A · Marathon Projection</p><EvidenceBadge kind="V" /></div><div className="mt-7 flex items-end justify-between gap-4"><div>
    {t1a?.adjusted_final_time ? (
      <>
        <p className="font-mono text-5xl font-semibold text-warning">{t1a.adjusted_final_time}</p>
        <p className="mt-2 text-sm text-muted-foreground line-through decoration-muted-foreground/50">{t1a.final_time} base</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-warning"><ArrowUp className="size-3" /> +{t1a.slowdown_pct}% Environment Penalty</p>
      </>
    ) : (
      <>
        <p className="font-mono text-5xl font-semibold">{t1a?.final_time ?? "..."}</p>
        <p className="mt-2 flex items-center gap-1 text-xs text-success"><ArrowDown className="size-3" /> VanderPlas MLP · Live</p>
      </>
    )}
  </div><svg viewBox="0 0 260 80" className="h-20 w-1/2"><path d="M0 64 C30 60 45 70 70 50 S110 54 135 36 S180 43 205 23 S235 25 260 10" fill="none" stroke="var(--primary)" strokeWidth="3"/><path d="M0 65 C30 60 45 70 70 50 S110 54 135 36 S180 43 205 23 S235 25 260 10 L260 80 L0 80Z" fill="color-mix(in oklab, var(--primary) 10%, transparent)"/></svg></div>
  <div className="mt-7 grid grid-cols-3 border-t border-border pt-4 text-sm">
    <div><p className="text-xs text-muted-foreground">Adjusted Pace</p><p className="mt-1 font-mono">{t1a?.adjusted_target_pace ?? "–"}</p></div>
    <div><p className="text-xs text-muted-foreground">WBGT Risk</p><p className="mt-1 font-mono">{weather?.wbgt_risk ?? "–"}</p></div>
    <div><p className="text-xs text-muted-foreground">Course Diff.</p><p className="mt-1 font-mono">{course?.course_difficulty_score ?? "–"}</p></div>
  </div></section>

  {/* Task 1B: Physiology Summary */}
  <section className="border border-border bg-card p-5 sm:p-6"><div className="flex justify-between"><p className="text-sm font-semibold">Task 1B · Physiology Profile</p><EvidenceBadge kind="C" /></div><div className="mt-6 space-y-4">
    <div className="flex items-center gap-3"><Heart className="size-4 text-destructive" /><div className="flex-1"><p className="text-xs text-muted-foreground">Estimated VO₂max</p><p className="mt-1 font-mono text-xl font-semibold">{physio?.vo2max_ml_kg_min ?? "–"} <span className="text-sm text-muted-foreground">mL/kg/min</span></p></div></div>
    <div className="flex items-center gap-3"><Activity className="size-4 text-primary" /><div className="flex-1"><p className="text-xs text-muted-foreground">Exercise Intensity</p><p className="mt-1 font-mono text-xl font-semibold">{physio?.pct_vo2max ?? "–"}% <span className="text-sm text-muted-foreground">VO₂max</span></p></div></div>
    <div className="flex items-center gap-3"><Zap className="size-4 text-warning" /><div className="flex-1"><p className="text-xs text-muted-foreground">RER</p><p className="mt-1 font-mono text-xl font-semibold">{physio?.rer ?? "–"}</p></div></div>
    <div className="flex items-center gap-3"><Flame className="size-4 text-orange-500" /><div className="flex-1"><p className="text-xs text-muted-foreground">Fat-Free Mass</p><p className="mt-1 font-mono text-xl font-semibold">{physio?.ffm_kg ?? "–"} <span className="text-sm text-muted-foreground">kg</span></p></div></div>
  </div></section>

  {/* Substrate Oxidation */}
  <section className="border border-border bg-card p-5 sm:p-6 xl:col-span-2"><div className="flex justify-between mb-5"><p className="text-sm font-semibold">Substrate Oxidation at Race Pace</p><EvidenceBadge kind="C" /></div>
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <div className="bg-muted/30 p-4 border border-border">
      <p className="text-xs text-muted-foreground">CHO Oxidation</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-primary">{substrates?.cho_oxidation_g_hr ?? "–"}<span className="text-sm text-muted-foreground ml-1">g/hr</span></p>
      <p className="text-xs text-muted-foreground mt-1">{substrates?.cho_contribution_pct ?? "–"}% of energy</p>
    </div>
    <div className="bg-muted/30 p-4 border border-border">
      <p className="text-xs text-muted-foreground">Fat Oxidation</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-warning">{substrates?.fat_oxidation_g_hr ?? "–"}<span className="text-sm text-muted-foreground ml-1">g/hr</span></p>
      <p className="text-xs text-muted-foreground mt-1">{substrates?.fat_contribution_pct ?? "–"}% of energy</p>
    </div>
    <div className="bg-muted/30 p-4 border border-border">
      <p className="text-xs text-muted-foreground">Total Energy</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{substrates?.total_energy_kcal_min ?? "–"}<span className="text-sm text-muted-foreground ml-1">kcal/min</span></p>
    </div>
    <div className="bg-muted/30 p-4 border border-border">
      <p className="text-xs text-muted-foreground">VO₂ Demand</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{physio?.vo2_demand_ml_kg_min ?? "–"}<span className="text-sm text-muted-foreground ml-1">mL/kg/min</span></p>
    </div>
  </div></section>

  {/* Glycogen Balance */}
  {glycogen && <section className="border border-border bg-card p-5 sm:p-6 xl:col-span-2"><div className="flex justify-between mb-5"><p className="text-sm font-semibold">Glycogen Balance Model</p><span className={`font-mono text-xs px-2 py-1 rounded-sm ${glycogen.wall_risk === 'LOW' ? 'bg-success-soft text-success' : glycogen.wall_risk === 'MODERATE' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>WALL RISK: {glycogen.wall_risk}</span></div>
  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
    <div><p className="text-xs text-muted-foreground">Starting</p><p className="font-mono text-lg font-semibold mt-1">{glycogen.starting_glycogen_g}g</p></div>
    <div><p className="text-xs text-muted-foreground">Burned</p><p className="font-mono text-lg font-semibold mt-1 text-destructive">−{glycogen.total_cho_burned_g}g</p></div>
    <div><p className="text-xs text-muted-foreground">Ingested</p><p className="font-mono text-lg font-semibold mt-1 text-success">+{glycogen.total_cho_ingested_g}g</p></div>
    <div><p className="text-xs text-muted-foreground">Remaining</p><p className="font-mono text-lg font-semibold mt-1">{glycogen.remaining_glycogen_g}g</p></div>
    <div><p className="text-xs text-muted-foreground">Remaining %</p><p className="font-mono text-lg font-semibold mt-1">{glycogen.remaining_pct}%</p></div>
  </div>
  <div className="mt-4 h-3 overflow-hidden bg-muted rounded-full"><div className={`h-full transition-[width] rounded-full ${glycogen.remaining_pct > 30 ? 'bg-success' : glycogen.remaining_pct > 15 ? 'bg-warning' : 'bg-destructive'}`} style={{width: `${glycogen.remaining_pct}%`}} /></div>
  <p className="text-xs text-muted-foreground mt-2">{glycogen.scenario}</p>
  </section>}

  {/* Training Recommendation */}
  {t1a?.training_recommendation && <section className="border border-border bg-card p-5 sm:p-6"><div className="flex justify-between mb-5"><p className="text-sm font-semibold">Training Recommendation</p><EvidenceBadge kind="P" /></div>
    <div className="space-y-3">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Easy pace</span><span className="font-mono">{t1a.training_recommendation.easy_pace}</span></div>
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tempo pace</span><span className="font-mono">{t1a.training_recommendation.tempo_pace}</span></div>
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Long run pace</span><span className="font-mono">{t1a.training_recommendation.long_run_pace}</span></div>
      <div className="flex justify-between text-sm border-t border-border pt-3"><span className="text-muted-foreground">Weekly volume</span><span className="font-mono">{t1a.training_recommendation.weekly_volume_km} km</span></div>
    </div>
  </section>}

  {/* Attention */}
  <section className="border border-border bg-card p-5 sm:p-6"><div className="flex justify-between"><p className="text-sm font-semibold">Attention</p><span className="font-mono text-xs text-muted-foreground">2 OPEN</span></div><div className="mt-4 divide-y divide-border">{attentionItems.map(({ title, copy, action, Icon })=><div key={title} className="flex flex-wrap items-center gap-4 py-4"><Icon className="size-5 text-warning"/><div className="min-w-[220px] flex-1"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{copy}</p></div><button className="text-sm font-medium text-primary hover:underline">{action}</button></div>)}</div></section>

  {/* Input Panel */}
  <section className="border border-border bg-card p-5 sm:p-6 xl:col-span-2">
    <p className="text-sm font-semibold mb-4">Athlete Profile (Syncs instantly to full pipeline)</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Age</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={age} onChange={(e) => setAge(parseInt(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Gender</label>
        <select className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="M">Male</option>
          <option value="W">Female</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Split (HH:MM:SS)</label>
        <input type="text" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={split} onChange={(e) => setSplit(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Weight (kg)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Height (cm)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={heightCm} onChange={(e) => setHeightCm(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Sex</label>
        <select className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={sex} onChange={(e) => setSex(parseInt(e.target.value))}>
          <option value={1}>Male</option>
          <option value={0}>Female</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Resting HR</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={hrRest} onChange={(e) => setHrRest(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Max HR</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={hrMax} onChange={(e) => setHrMax(parseFloat(e.target.value) || 0)} />
      </div>
    </div>
  </section>

  {/* Environment Panel */}
  <section className="border border-border bg-card p-5 sm:p-6 xl:col-span-2">
    <p className="text-sm font-semibold mb-4">Environment & Course</p>
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Course</label>
        <select className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="boston">Boston</option>
          <option value="new_york">New York</option>
          <option value="berlin">Berlin</option>
          <option value="chicago">Chicago</option>
          <option value="london">London</option>
          <option value="tokyo">Tokyo</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Temp (°C)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Humidity (%)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={humidity} onChange={(e) => setHumidity(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Wind (m/s)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={windSpeed} onChange={(e) => setWindSpeed(parseFloat(e.target.value) || 0)} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Wind Dir (°)</label>
        <input type="number" className="border border-border rounded px-2 py-1.5 bg-transparent text-sm w-full" value={windDirection} onChange={(e) => setWindDirection(parseFloat(e.target.value) || 0)} />
      </div>
    </div>
  </section>
  </div></AppShell>;
}