import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Info, Zap, Flame, Battery, AlertTriangle, ArrowRight, Activity, Cpu, ShieldCheck, User, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/stride/app-shell";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/fuel")({
  head: () => ({ meta: [
    { title: "Physiology Profile & Fuel Lab — Stride" },
    { name: "description", content: "Evidence-based pre-race, in-race and post-race nutrition plans driven by your physiology profile." },
  ] }),
  component: Fuel,
});

function Fuel() {
  const [plan, setPlan] = useState<any>(null);
  const [athleteProfile, setAthleteProfile] = useState<any>(null);
  const [intake, setIntake] = useState([75]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch authenticated athlete's baseline profile from SQLite
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      const athleteId = user?.id || "101";

      let profileData: any = null;
      try {
        const profRes = await fetch(`/api/athlete/profile/${athleteId}`);
        if (profRes.ok) {
          profileData = await profRes.json();
          setAthleteProfile(profileData);
        }
      } catch (e) {
        console.error("Could not load profile baseline", e);
      }

      // Map real profile fields to Task 1A -> Task 1B pipeline payload
      const p = profileData?.personal || {};
      const perf = profileData?.performance || {};
      const phys = profileData?.physiology || {};
      const train = profileData?.training_baseline || {};
      const goals = profileData?.goals || {};

      // Convert half marathon seconds to HH:MM:SS
      const halfSec = perf.recent_half_marathon_sec || perf.half_marathon_pb_sec || 5700;
      const h = Math.floor(halfSec / 3600);
      const m = Math.floor((halfSec % 3600) / 60);
      const s = halfSec % 60;
      const splitHms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

      const payload = {
        age: p.age || 28,
        gender: p.sex_at_birth === "female" ? "F" : "M",
        sex: p.sex_at_birth === "female" ? 0 : 1,
        weight_kg: p.weight_kg || 70,
        height_cm: p.height_cm || 178,
        split_hhmmss: splitHms,
        hr_rest: phys.resting_hr_bpm || 52,
        hr_max: phys.max_hr_bpm || 188,
        training_hours_per_week: train.typical_runs_per_week ? train.typical_runs_per_week * 1.5 : 8,
        is_carb_loaded: true,
        course_id: goals.target_race_name?.toLowerCase().includes("boston") ? "boston" : "berlin",
        temperature_c: 18,
        relative_humidity_pct: 65,
        wind_speed_mps: 3.5,
        wind_direction_deg: 90,
      };

      // 2. Call the unified pipeline: Task 1A ML Hand-off -> Task 1B Metabolic Deterministic Engine
      fetch("/api/predict/full-plan/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => res.json())
        .then((data) => {
          setPlan(data.task_1b);
          if (data.task_1b?.in_race?.recommended_g_hr) {
            setIntake([data.task_1b.in_race.recommended_g_hr]);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, []);


  const preRace = plan?.pre_race;
  const inRace = plan?.in_race;
  const postRace = plan?.post_race;
  const daily = plan?.daily_cho;
  const glycogen = plan?.glycogen_balance;
  const physio = plan?.physiology;
  const substrates = physio?.substrates;
  const raceDuration = plan?.race_duration_hours ?? 3.5;

  const totalProjected = Math.round((intake[0] ?? 75) * raceDuration);
  const gelsNeeded = Math.round(totalProjected / 25);
  const gelInterval = gelsNeeded > 0 ? Math.round((raceDuration * 60) / gelsNeeded) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-1.5">
            <Flame className="size-3.5" /> Task 1B · Nutrition Engine & Physiology
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Physiology Profile & Fuel Lab</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Deterministic substrate partitioning, glycogen kinetics, and individualized fueling driven by Task 1A marathon pace outputs.
          </p>
        </div>

        {/* Task 1A -> Task 1B Architectural Pipeline Flow Bridge */}
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
            <span className="font-mono text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
              <Cpu className="size-4 text-primary" /> Architectural Pipeline Boundary
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">Deterministic Physics Engine</span>
          </div>

          <div className="grid gap-4 md:grid-cols-7 items-center">
            {/* Task 1A Stage */}
            <div className="md:col-span-3 rounded-lg border border-border/60 bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-semibold text-primary">Task 1A · ML Hand-Off</span>
                <span className="text-[10px] font-mono text-muted-foreground">Predictive</span>
              </div>
              <h4 className="font-semibold text-sm">Pace & Finish Time Output</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Task 1A estimates total race duration ({raceDuration.toFixed(2)} hrs) and average velocity ({plan?.runner_pace_kmh ? `${plan.runner_pace_kmh} km/h` : "12.0 km/h"}) from baseline history.
              </p>
            </div>

            {/* Bridge Hand-off Indicator */}
            <div className="md:col-span-1 flex flex-col items-center justify-center text-primary font-mono text-xs">
              <span className="hidden md:inline"><ArrowRight className="size-5" /></span>
              <span className="md:hidden">↓</span>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">Velocity Hand-Off</span>
            </div>

            {/* Task 1B Stage */}
            <div className="md:col-span-3 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-semibold text-primary">Task 1B · Metabolic Engine</span>
                <span className="text-[10px] font-mono text-emerald-500 font-semibold">Deterministic</span>
              </div>
              <h4 className="font-semibold text-sm">Péronnet-Massicotte Kinetics</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Computes non-protein RER ({physio?.rer ?? "0.93"}), CHO oxidation rate ({substrates?.cho_oxidation_g_hr ?? "180"} g/hr), and dual-transport absorption limits ({inRace?.absorption_ceiling_g_hr ?? "90"} g/hr).
              </p>
            </div>
          </div>

          {/* Profile Biometric Anchor Info */}
          {athleteProfile && (
            <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="text-foreground font-semibold flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" /> {athleteProfile.personal?.full_name || "Athlete Profile"}
                </span>
                <span>Weight: {athleteProfile.personal?.weight_kg || 70} kg</span>
                <span>Rest HR: {athleteProfile.physiology?.resting_hr_bpm || 52} bpm</span>
                <span>Max HR: {athleteProfile.physiology?.max_hr_bpm || 188} bpm</span>
              </div>
              <Link to="/profile" className="text-primary hover:underline text-[11px] flex items-center gap-1">
                View Ground Truth Profile →
              </Link>
            </div>
          )}
        </div>

        <Tabs defaultValue="race" className="mt-4">
          <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="pre">Pre-race</TabsTrigger>
          <TabsTrigger value="race">In-race</TabsTrigger>
          <TabsTrigger value="post">Post-race</TabsTrigger>
          <TabsTrigger value="glycogen">Glycogen</TabsTrigger>
        </TabsList>

        {/* Daily CHO */}
        <TabsContent value="daily" className="mt-5 border border-border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Daily carbohydrate requirement</h2>
            <EvidenceBadge kind="V" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Based on training volume: {daily?.category ?? "–"} load</p>
          <div className="mt-6 flex gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Range</p>
              <p className="font-mono text-4xl font-semibold text-primary mt-1">
                {daily ? `${daily.cho_g_day_low}–${daily.cho_g_day_high}` : "–"} <span className="text-lg text-muted-foreground">g/day</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recommended</p>
              <p className="font-mono text-4xl font-semibold mt-1">
                {daily?.cho_g_day_recommended ?? "–"} <span className="text-lg text-muted-foreground">g/day</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Rate: {daily?.cho_g_kg_low ?? "–"}–{daily?.cho_g_kg_high ?? "–"} g/kg/day · Burke et al. (2011)
          </p>
        </TabsContent>

        {/* Pre-race */}
        <TabsContent value="pre" className="mt-5 border border-border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Carbohydrate loading protocol</h2>
            <EvidenceBadge kind="V" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {preRace?.loading_duration_hours ?? 36}-hour schedule at {preRace?.loading_g_kg_day ?? 10} g/kg/day
          </p>
          <div className="mt-6 flex gap-8">
            <div>
              <p className="text-xs text-muted-foreground">Loading target</p>
              <p className="font-mono text-4xl font-semibold text-primary mt-1">
                {preRace?.loading_total_g_day ?? "–"} <span className="text-lg text-muted-foreground">g/day</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last meal (3-4h pre)</p>
              <p className="font-mono text-4xl font-semibold mt-1">
                {preRace?.pre_race_meal_g ?? "–"} <span className="text-lg text-muted-foreground">g</span>
              </p>
            </div>
          </div>
        </TabsContent>

        {/* In-race */}
        <TabsContent value="race" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="border border-border bg-card p-6">
              <div className="flex justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">In-race intake</h2>
                  <TooltipProvider><Tooltip><TooltipTrigger aria-label="Why intake is capped"><Info className="size-4 text-muted-foreground"/></TooltipTrigger><TooltipContent className="max-w-xs">SGLT1 transports glucose while GLUT5 transports fructose. Using both can raise oxidation, but intake above 90 g/h often increases gut distress. Your CHO oxidation rate is {substrates?.cho_oxidation_g_hr ?? "–"} g/hr.</TooltipContent></Tooltip></TooltipProvider>
                </div>
                <EvidenceBadge kind="V" />
              </div>
              <div className="mt-10 flex items-end gap-2">
                <span className="font-mono text-6xl font-semibold">{intake[0]}</span>
                <span className="mb-2 text-muted-foreground">g/h</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {inRace?.strategy ?? "Loading..."}
              </p>
              <Slider className="mt-8" min={30} max={90} step={5} value={intake} onValueChange={setIntake}/>
              <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>30 g/h</span>
                <span className="text-warning">HARD LIMIT · 90 g/h</span>
              </div>
              <div className="mt-8 h-3 overflow-hidden bg-muted rounded-full">
                <div className="h-full bg-primary transition-[width] rounded-full" style={{width:`${((intake[0]??30)-30)/60*100}%`}}/>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                <div><span className="text-xs text-muted-foreground block">CHO oxidation</span><span className="font-mono">{substrates?.cho_oxidation_g_hr ?? "–"} g/hr</span></div>
                <div><span className="text-xs text-muted-foreground block">Absorption limit</span><span className="font-mono text-warning">90 g/hr (dual CHO)</span></div>
              </div>
            </section>
            <section className="border border-border bg-primary p-6 text-primary-foreground">
              <p className="font-mono text-xs uppercase text-primary-foreground/60">Race supply</p>
              <p className="mt-5 text-3xl font-semibold">{gelsNeeded} gels</p>
              <p className="mt-2 text-sm text-primary-foreground/65">25 g each · one every {gelInterval} minutes</p>
              <div className="mt-10 border-t border-primary-foreground/20 pt-5">
                <p className="text-sm">Projected intake</p>
                <p className="mt-2 font-mono text-2xl">{totalProjected} g total</p>
              </div>
              <div className="mt-5 border-t border-primary-foreground/20 pt-5">
                <p className="text-sm">Race duration</p>
                <p className="mt-2 font-mono text-2xl">{raceDuration.toFixed(1)} hrs</p>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* Post-race */}
        <TabsContent value="post" className="mt-5 border border-border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Recovery window</h2>
            <EvidenceBadge kind="V" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Targets for the first four hours post-race.</p>
          <div className="mt-6 grid grid-cols-3 gap-6">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Zap className="size-3"/> Carbohydrates</span>
              <span className="font-mono text-3xl font-semibold text-primary">{postRace?.cho_g ?? "–"} g</span>
              <span className="text-xs text-muted-foreground mt-1">{postRace?.cho_timing ?? ""}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Flame className="size-3"/> Protein</span>
              <span className="font-mono text-3xl font-semibold text-warning">{postRace?.protein_g ?? "–"} g</span>
              <span className="text-xs text-muted-foreground mt-1">{postRace?.protein_timing ?? ""}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Fluid</span>
              <span className="font-mono text-3xl font-semibold">{postRace?.fluid_l ?? "–"} L</span>
              <span className="text-xs text-muted-foreground mt-1">{postRace?.fluid_note ?? ""}</span>
            </div>
          </div>
        </TabsContent>

        {/* Glycogen Model */}
        <TabsContent value="glycogen" className="mt-5 border border-border bg-card p-6">
          <div className="flex justify-between">
            <h2 className="font-semibold">Glycogen depletion model</h2>
            {glycogen && <span className={`font-mono text-xs px-2 py-1 rounded-sm ${glycogen.wall_risk === 'LOW' ? 'bg-success-soft text-success' : glycogen.wall_risk === 'MODERATE' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
              <AlertTriangle className="size-3 inline mr-1" />WALL RISK: {glycogen.wall_risk}
            </span>}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{glycogen?.scenario ?? "Loading..."}</p>
          
          {glycogen && <>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-muted/30 p-4 border border-border text-center">
                <p className="text-xs text-muted-foreground">Starting</p>
                <p className="font-mono text-2xl font-semibold mt-1">{glycogen.starting_glycogen_g}g</p>
              </div>
              <div className="bg-muted/30 p-4 border border-border text-center">
                <p className="text-xs text-muted-foreground">Burned</p>
                <p className="font-mono text-2xl font-semibold mt-1 text-destructive">−{glycogen.total_cho_burned_g}g</p>
              </div>
              <div className="bg-muted/30 p-4 border border-border text-center">
                <p className="text-xs text-muted-foreground">Ingested</p>
                <p className="font-mono text-2xl font-semibold mt-1 text-success">+{glycogen.total_cho_ingested_g}g</p>
              </div>
              <div className="bg-muted/30 p-4 border border-border text-center">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-mono text-2xl font-semibold mt-1">{glycogen.remaining_glycogen_g}g</p>
              </div>
              <div className="bg-muted/30 p-4 border border-border text-center">
                <p className="text-xs text-muted-foreground">% Left</p>
                <p className="font-mono text-2xl font-semibold mt-1">{glycogen.remaining_pct}%</p>
              </div>
            </div>
            <div className="mt-4 h-4 overflow-hidden bg-muted rounded-full">
              <div className={`h-full transition-[width] rounded-full ${glycogen.remaining_pct > 30 ? 'bg-success' : glycogen.remaining_pct > 15 ? 'bg-warning' : 'bg-destructive'}`} style={{width: `${glycogen.remaining_pct}%`}} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Glycogen capacity (loaded)</span>
                <span className="font-mono">{physio?.glycogen?.total_loaded_g ?? "–"} g ({physio?.glycogen?.total_loaded_kcal ?? "–"} kcal)</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Net depletion</span>
                <span className="font-mono">{glycogen.net_depletion_g} g</span>
              </div>
            </div>
          </>}
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}