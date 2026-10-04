import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  User, Award, Activity, Heart, Zap, Shield, Flame, 
  MapPin, Calendar, Clock, Gauge, BedDouble, AlertCircle, Edit, RefreshCw, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/stride/evidence-badge";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Athlete Profile — Stride" },
      { name: "description", content: "View your verified Stride athlete profile and physiological baseline." },
    ],
  }),
  component: AthleteProfilePage,
});

function MetricTile({
  label,
  value,
  subtext,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  badge?: string;
}) {
  return (
    <div className="rounded border border-border/70 bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {badge && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-primary uppercase">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tracking-tight text-foreground">{value || "—"}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function RatingBar({ value, label, max = 5 }: { value: number; label: string; max?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-primary">{value} / {max}</span>
      </div>
      <div className="flex gap-1 h-2">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${
              i < value ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function formatSeconds(sec?: number | null): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function AthleteProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setError("User session not found.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/athlete/profile/${user.id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setProfile(null);
          } else {
            throw new Error("Failed to load profile.");
          }
        } else {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load athlete profile.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
          <RefreshCw className="size-6 animate-spin text-primary" />
          <p className="font-mono text-sm text-muted-foreground">Loading Athlete Profile…</p>
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">No Athlete Profile Found</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            You haven't completed your Stride onboarding baseline yet. Set up your profile now to enable personalized pacing projections, metabolic profiling, and fueling plans.
          </p>
          <div className="mt-6">
            <Button asChild className="bg-primary text-primary-foreground font-semibold">
              <Link to="/onboarding">Start 6-Step Onboarding</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const p = profile.personal || {};
  const r = profile.running_identity || {};
  const perf = profile.performance || {};
  const train = profile.training_baseline || {};
  const phys = profile.physiology || {};
  const rec = profile.recovery || {};
  const goals = profile.goals || {};
  const pref = profile.preferences || {};
  const nut = profile.nutrition || {};
  const health = profile.health || {};

  // Compute BMI
  const heightM = p.height_cm ? p.height_cm / 100 : 1.75;
  const bmi = p.weight_kg && heightM ? (p.weight_kg / (heightM * heightM)).toFixed(1) : "—";

  // Parse secondary distances
  let secondaryList: string[] = [];
  try {
    if (r.secondary_race_distances) {
      secondaryList = typeof r.secondary_race_distances === "string" 
        ? JSON.parse(r.secondary_race_distances) 
        : r.secondary_race_distances;
    }
  } catch {
    secondaryList = [];
  }

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header Hero Card */}
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-mono text-2xl font-bold">
                {p.full_name ? p.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "AT"}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
                    {p.full_name || "Athlete Profile"}
                  </h1>
                  <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs font-semibold capitalize text-primary">
                    {r.competitive_level ? r.competitive_level.replace("_", " ") : "Athlete"}
                  </span>
                  <EvidenceBadge kind="V" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                  {p.location && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{p.location}{p.country ? `, ${p.country}` : ""}</span>}
                  {p.age && <span>Age: {p.age}</span>}
                  {p.sex_at_birth && <span className="capitalize">Sex: {p.sex_at_birth}</span>}
                  {p.height_cm && <span>{p.height_cm} cm</span>}
                  {p.weight_kg && <span>{p.weight_kg} kg (BMI: {bmi})</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="font-mono text-xs gap-1.5">
                <Link to="/onboarding">
                  <Edit className="size-3.5" /> Recalibrate Baseline
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 6 Structured Baseline Sections */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* 1. Running Identity */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Award className="size-4" /> 1. Running Identity
              </h2>
              <span className="font-mono text-xs text-muted-foreground">{r.running_experience_years || 0} years experience</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile 
                label="Primary Distance" 
                value={r.primary_race_distance ? r.primary_race_distance.replace("_", " ").toUpperCase() : "MARATHON"} 
                badge="Target"
              />
              <MetricTile 
                label="Marathons Done" 
                value={r.marathons_completed ?? 0} 
                subtext="Official finishes"
              />
              <MetricTile 
                label="Half Marathons" 
                value={r.half_marathons_completed ?? 0} 
                subtext="Official finishes"
              />
            </div>

            {secondaryList.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">Secondary Event Distances</span>
                <div className="flex flex-wrap gap-1.5">
                  {secondaryList.map((dist) => (
                    <span key={dist} className="rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs capitalize">
                      {dist.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 2. Target Goal & Current Phase */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Activity className="size-4" /> 2. Target Goal & Phase
              </h2>
              <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-xs font-medium text-accent-foreground capitalize">
                Phase: {train.training_phase ? train.training_phase.replace("_", " ") : "Base"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTile 
                label="Target Race" 
                value={goals.target_race_name || "Upcoming Event"} 
                subtext={goals.target_race_date ? `Race Date: ${goals.target_race_date}` : "Date TBD"}
              />
              <MetricTile 
                label="Goal Finish Time" 
                value={formatSeconds(goals.target_finish_time_sec)} 
                subtext={`Goal: ${goals.primary_performance_goal ? goals.primary_performance_goal.replace("_", " ") : "Finish"}`}
                badge="Target Pace"
              />
            </div>

            <div className="rounded border border-border/60 bg-muted/20 p-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Training Plan: <strong className="capitalize text-foreground">{train.training_plan_type ? train.training_plan_type.replace("_", " ") : "Self-designed"}</strong></span>
              <span className="font-mono text-muted-foreground">Coach Supported: <strong className="text-foreground">{train.coach_supported ? "Yes" : "No"}</strong></span>
            </div>
          </section>

          {/* 3. Performance Baseline & PBs */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Gauge className="size-4" /> 3. Performance Baseline & Personal Bests
              </h2>
              <span className="text-xs text-muted-foreground font-mono">Separated Benchmark Records</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricTile 
                label="Marathon PB" 
                value={formatSeconds(perf.pb_marathon_sec)} 
                subtext={perf.pb_marathon_race_name || (perf.pb_marathon_date ? `Date: ${perf.pb_marathon_date}` : "")}
              />
              <MetricTile 
                label="Half Marathon PB" 
                value={formatSeconds(perf.pb_half_marathon_sec)} 
                subtext={perf.pb_half_marathon_race_name || (perf.pb_half_marathon_date ? `Date: ${perf.pb_half_marathon_date}` : "")}
              />
              <MetricTile 
                label="10K PB" 
                value={formatSeconds(perf.pb_10k_sec)} 
                subtext={perf.pb_10k_race_name || ""}
              />
              <MetricTile 
                label="5K PB" 
                value={formatSeconds(perf.pb_5k_sec)} 
                subtext={perf.pb_5k_race_name || ""}
              />
            </div>

            {/* Recent Race vs Half Split Comparison */}
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              <div className="rounded border border-primary/20 bg-primary/5 p-4 space-y-1">
                <span className="font-mono text-[10px] uppercase font-semibold text-primary tracking-wider">
                  Recent Standalone Half Marathon
                </span>
                <p className="font-mono text-xl font-bold text-foreground">
                  {formatSeconds(perf.recent_half_marathon_time_sec)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dedicated 21.1 km race performance benchmark.
                </p>
              </div>

              <div className="rounded border border-border bg-muted/20 p-4 space-y-1">
                <span className="font-mono text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Recent Marathon Halfway Split (21.1 km mark)
                </span>
                <p className="font-mono text-xl font-bold text-foreground">
                  {formatSeconds(perf.recent_marathon_half_split_sec)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Split registered halfway through a 42.2 km marathon.
                </p>
              </div>
            </div>
          </section>

          {/* 4. Current Training Routine */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Clock className="size-4" /> 4. Current Training Baseline
              </h2>
              <span className="text-xs text-muted-foreground font-mono">{train.baseline_runs_per_week || 0} runs/week</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile 
                label="Weekly Volume" 
                value={`${train.baseline_weekly_distance_km || 0} km`} 
                subtext="Weekly running total"
              />
              <MetricTile 
                label="Longest Run" 
                value={`${train.recent_longest_run_km || 0} km`} 
                subtext="In last 4 weeks"
              />
              <MetricTile 
                label="Training Time" 
                value={`${((train.baseline_weekly_duration_min || 0) / 60).toFixed(1)} hrs`} 
                subtext="Weekly duration"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <MetricTile 
                label="Typical Easy Pace" 
                value={train.baseline_avg_training_pace_minkm ? `${train.baseline_avg_training_pace_minkm.toFixed(2)} /km` : "—"} 
              />
              <MetricTile 
                label="Runs per Week" 
                value={`${train.baseline_runs_per_week || 0} days`} 
              />
            </div>
          </section>

          {/* 5. Physiological Profile */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Heart className="size-4 text-destructive" /> 5. Physiological Baseline
              </h2>
              <span className="font-mono text-xs text-muted-foreground">Cardiac & Gas Profile</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile 
                label="Resting HR" 
                value={phys.resting_hr_bpm ? `${phys.resting_hr_bpm} bpm` : "—"} 
              />
              <MetricTile 
                label="Maximum HR" 
                value={phys.max_hr_bpm ? `${phys.max_hr_bpm} bpm` : "—"} 
              />
              <MetricTile 
                label="VO₂max" 
                value={phys.vo2max_ml_kg_min ? `${phys.vo2max_ml_kg_min} mL` : "—"} 
                badge={phys.vo2max_source ? phys.vo2max_source.replace("_", " ") : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTile 
                label="Body Fat %" 
                value={phys.body_fat_pct ? `${phys.body_fat_pct}%` : "—"} 
              />
              <MetricTile 
                label="Running Economy" 
                value={phys.lab_running_economy ? `${phys.lab_running_economy} mL/kg/km` : "Estimated"} 
              />
            </div>
          </section>

          {/* 6. Recovery & Wellness Ratings */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <BedDouble className="size-4" /> 6. Recovery & Wellness Baseline
              </h2>
              <span className="font-mono text-xs text-muted-foreground">{rec.baseline_sleep_hours || 7.5}h avg sleep</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTile 
                label="Average Sleep" 
                value={`${rec.baseline_sleep_hours || 7.5} hrs`} 
                subtext={`Quality: ${rec.sleep_quality ? rec.sleep_quality.replace("_", " ") : "Good"}`}
              />
              <div className="rounded border border-border/70 bg-card p-4 space-y-3">
                <RatingBar label="Pre-Training Recovery" value={rec.typical_recovery_score || 4} />
                <RatingBar label="Fatigue Level" value={rec.typical_fatigue_score || 2} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded border border-border/50 bg-muted/20 p-4">
              <RatingBar label="Non-Training Stress" value={rec.typical_stress_score || 2} />
              <RatingBar label="Training Motivation" value={rec.typical_motivation_score || 4} />
            </div>
          </section>

          {/* 7. Environment, Nutrition & Readiness */}
          <section className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                <Flame className="size-4 text-orange-500" /> 7. Environment & Nutrition
              </h2>
              <span className="font-mono text-xs text-muted-foreground">Task 1B Foundation</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile 
                label="Primary Surface" 
                value={pref.primary_surface ? pref.primary_surface.toUpperCase() : "ROAD"} 
              />
              <MetricTile 
                label="Typical Terrain" 
                value={pref.typical_terrain ? pref.typical_terrain.toUpperCase() : "ROLLING"} 
              />
              <MetricTile 
                label="Elevation Gain" 
                value={`${pref.average_weekly_elevation_gain_m || 0} m`} 
                subtext="Weekly gain"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MetricTile 
                label="Dietary Pattern" 
                value={nut.dietary_pattern ? nut.dietary_pattern.replace("_", " ").toUpperCase() : "OMNIVORE"} 
                subtext={nut.dietary_restrictions || "No restrictions"}
              />
              <MetricTile 
                label="In-Race Carbs" 
                value={nut.typical_race_carbs_g_per_h ? `${nut.typical_race_carbs_g_per_h} g/hr` : "60 g/hr"} 
                subtext={`Experience: ${nut.fueling_experience || "Usually"}`}
              />
            </div>

            <div className="rounded border border-border/60 bg-muted/20 p-3.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hydration: <strong className="text-foreground capitalize">{nut.typical_race_hydration ? nut.typical_race_hydration.replace(/_/g, " ") : "Water & Electrolytes"}</strong></span>
              <span className="text-muted-foreground">Injury Status: <strong className="text-foreground capitalize">{health.managing_injury === "yes" ? "Managing issue" : "Healthy"}</strong></span>
            </div>
          </section>

        </div>
      </div>
    </AppShell>
  );
}
