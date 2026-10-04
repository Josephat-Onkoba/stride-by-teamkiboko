import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { 
  ArrowLeft, ArrowRight, Check, Award, Activity, 
  Heart, Zap, Shield, Sparkles, AlertCircle 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — Stride" },
      { name: "description", content: "Build your comprehensive Stride athlete profile and baseline." },
    ],
  }),
  component: OnboardingWizard,
});

const STEPS = [
  { id: 1, title: "About You", subtitle: "Personal Information" },
  { id: 2, title: "Your Running", subtitle: "Running Identity & Experience" },
  { id: 3, title: "Performance", subtitle: "Personal Bests & Recent Races" },
  { id: 4, title: "Training", subtitle: "Current Training Baseline & Goal" },
  { id: 5, title: "Physiology", subtitle: "Biometrics & Recovery Profile" },
  { id: 6, title: "Preferences", subtitle: "Environment, Fueling & Health" },
];

function FieldTag({ type }: { type: "required" | "recommended" | "optional" }) {
  if (type === "required") {
    return <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-primary">Required</span>;
  }
  if (type === "recommended") {
    return <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase text-muted-foreground">Recommended</span>;
  }
  return <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase text-muted-foreground/80">Optional</span>;
}

function RatingSelector({
  value,
  onChange,
  labels,
}: {
  value: number;
  onChange: (v: number) => void;
  labels: Record<number, string>;
}) {
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => onChange(lvl)}
            className={`flex flex-col items-center justify-center rounded border p-2 text-center transition-all ${
              value === lvl
                ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                : "border-border bg-card hover:border-primary/50 text-foreground"
            }`}
          >
            <span className="font-mono text-base">{lvl}</span>
          </button>
        ))}
      </div>
      <p className="font-mono text-xs text-muted-foreground text-center">
        Level {value}: <span className="text-foreground font-medium">{labels[value] || ""}</span>
      </p>
    </div>
  );
}

function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // SECTION 1: Personal Information
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("1995-06-15");
  const [sexAtBirth, setSexAtBirth] = useState("male");
  const [gender, setGender] = useState("");
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(68);
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });

  // Calculate age automatically from DOB
  const derivedAge = useMemo(() => {
    if (!dob) return 30;
    try {
      const born = new Date(dob);
      const diff = Date.now() - born.getTime();
      const ageDate = new Date(diff);
      return Math.abs(ageDate.getUTCFullYear() - 1970) || 30;
    } catch {
      return 30;
    }
  }, [dob]);

  // SECTION 2: Running Identity
  const [primaryDistance, setPrimaryDistance] = useState("marathon");
  const [secondaryDistances, setSecondaryDistances] = useState<string[]>(["half_marathon"]);
  const [competitiveLevel, setCompetitiveLevel] = useState("competitive_amateur");
  const [runningExpYears, setRunningExpYears] = useState(4);
  const [marathonsCompleted, setMarathonsCompleted] = useState(2);
  const [halfMarathonsCompleted, setHalfMarathonsCompleted] = useState(4);

  const toggleSecondaryDistance = (dist: string) => {
    setSecondaryDistances((prev) =>
      prev.includes(dist) ? prev.filter((d) => d !== dist) : [...prev, dist]
    );
  };

  // SECTION 3: Performance Baseline
  const [pb5kTime, setPb5kTime] = useState("");
  const [pb5kDate, setPb5kDate] = useState("");
  const [pb5kRace, setPb5kRace] = useState("");

  const [pb10kTime, setPb10kTime] = useState("");
  const [pb10kDate, setPb10kDate] = useState("");
  const [pb10kRace, setPb10kRace] = useState("");

  const [pbHalfTime, setPbHalfTime] = useState("01:34:00");
  const [pbHalfDate, setPbHalfDate] = useState("");
  const [pbHalfRace, setPbHalfRace] = useState("");

  const [pbMarathonTime, setPbMarathonTime] = useState("03:25:00");
  const [pbMarathonDate, setPbMarathonDate] = useState("");
  const [pbMarathonRace, setPbMarathonRace] = useState("");

  const [recentRaceDist, setRecentRaceDist] = useState("half_marathon");
  const [recentRaceDate, setRecentRaceDate] = useState("");
  const [recentRaceName, setRecentRaceName] = useState("");
  const [recentRaceTime, setRecentRaceTime] = useState("01:35:10");

  const [recentHalfTime, setRecentHalfTime] = useState("01:35:10");
  const [recentMarathonHalfSplit, setRecentMarathonHalfSplit] = useState("01:38:40");

  // SECTION 4: Current Training Baseline
  const [weeklyDistKm, setWeeklyDistKm] = useState(65);
  const [runsPerWeek, setRunsPerWeek] = useState(5);
  const [longestRunKm, setLongestRunKm] = useState(24);
  const [weeklyDurationMin, setWeeklyDurationMin] = useState(330);
  const [avgTrainingPace, setAvgTrainingPace] = useState(5.25);
  const [trainingPhase, setTrainingPhase] = useState("build");

  const [targetRaceName, setTargetRaceName] = useState("Berlin Marathon");
  const [targetRaceDistKm, setTargetRaceDistKm] = useState(42.195);
  const [targetRaceDate, setTargetRaceDate] = useState("2026-09-27");
  const [targetFinishTime, setTargetFinishTime] = useState("03:15:00");
  const [primaryGoal, setPrimaryGoal] = useState("personal_best");

  const [trainingPlanType, setTrainingPlanType] = useState("self_designed");
  const [coachSupported, setCoachSupported] = useState(false);

  // SECTION 5: Physiological & Recovery Baseline
  const [restingHr, setRestingHr] = useState(50);
  const [maxHr, setMaxHr] = useState(188);
  const [vo2max, setVo2max] = useState<number | string>(56);
  const [vo2maxSource, setVo2maxSource] = useState("running_watch");
  const [bodyFatPct, setBodyFatPct] = useState<number | string>("");
  const [hasLabRe, setHasLabRe] = useState(false);
  const [labReValue, setLabReValue] = useState("");

  const [sleepHours, setSleepHours] = useState(7.5);
  const [sleepQuality, setSleepQuality] = useState("good");
  const [recoveryScore, setRecoveryScore] = useState(4);
  const [fatigueScore, setFatigueScore] = useState(2);
  const [stressScore, setStressScore] = useState(2);
  const [motivationScore, setMotivationScore] = useState(4);

  // SECTION 6: Preferences, Nutrition & Health
  const [primarySurface, setPrimarySurface] = useState("road");
  const [typicalTerrain, setTypicalTerrain] = useState("rolling");
  const [weeklyElevationGain, setWeeklyElevationGain] = useState(350);
  const [preferredCourse, setPreferredCourse] = useState("flat");
  const [preferredEnvironment, setPreferredEnvironment] = useState("cool");

  const [dietaryPattern, setDietaryPattern] = useState("no_preference");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [fuelingExperience, setFuelingExperience] = useState("usually");
  const [typicalRaceCarbs, setTypicalRaceCarbs] = useState(60);
  const [typicalHydration, setTypicalHydration] = useState("water_and_electrolytes");

  const [managingInjury, setManagingInjury] = useState("no");
  const [trainingModified, setTrainingModified] = useState("no");

  const validateCurrentStep = () => {
    setErrorMsg("");
    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMsg("Please enter your full name.");
        return false;
      }
      if (!dob) {
        setErrorMsg("Please provide your date of birth.");
        return false;
      }
      if (heightCm <= 50 || weightKg <= 30) {
        setErrorMsg("Please enter valid height and weight values.");
        return false;
      }
    }
    if (step === 4) {
      if (weeklyDistKm < 0 || longestRunKm < 0) {
        setErrorMsg("Please enter valid running distances.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((s) => Math.min(s + 1, 6));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setErrorMsg("");
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function finishSetup() {
    if (!validateCurrentStep()) return;
    setBusy(true);
    setErrorMsg("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setErrorMsg("User session expired. Please log in again.");
        setBusy(false);
        return;
      }

      const athleteId = authData.user.id;
      const email = authData.user.email || "";

      // 1. Prepare SQLite payload matching schemas.py
      const payload = {
        athlete_id: athleteId,
        email: email,
        personal: {
          full_name: fullName,
          date_of_birth: dob,
          age: derivedAge,
          sex_at_birth: sexAtBirth,
          gender: gender || null,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          country: country || null,
          location: location || null,
          timezone: timezone || "UTC",
        },
        running_identity: {
          competitive_level: competitiveLevel,
          primary_race_distance: primaryDistance,
          secondary_race_distances: secondaryDistances,
          running_experience_years: Number(runningExpYears),
          marathons_completed: Number(marathonsCompleted),
          half_marathons_completed: Number(halfMarathonsCompleted),
        },
        performance: {
          pb_5k_time: pb5kTime || null,
          pb_5k_date: pb5kDate || null,
          pb_5k_race_name: pb5kRace || null,
          pb_10k_time: pb10kTime || null,
          pb_10k_date: pb10kDate || null,
          pb_10k_race_name: pb10kRace || null,
          pb_half_marathon_time: pbHalfTime || null,
          pb_half_marathon_date: pbHalfDate || null,
          pb_half_marathon_race_name: pbHalfRace || null,
          pb_marathon_time: pbMarathonTime || null,
          pb_marathon_date: pbMarathonDate || null,
          pb_marathon_race_name: pbMarathonRace || null,
          recent_race_distance: recentRaceDist || null,
          recent_race_date: recentRaceDate || null,
          recent_race_name: recentRaceName || null,
          recent_race_finish_time: recentRaceTime || null,
          recent_half_marathon_time: recentHalfTime || null,
          recent_marathon_half_split: recentMarathonHalfSplit || null,
        },
        training_baseline: {
          baseline_weekly_distance_km: Number(weeklyDistKm),
          baseline_runs_per_week: Number(runsPerWeek),
          recent_longest_run_km: Number(longestRunKm),
          baseline_weekly_duration_min: Number(weeklyDurationMin),
          baseline_avg_training_pace_minkm: Number(avgTrainingPace),
          training_phase: trainingPhase,
          training_plan_type: trainingPlanType,
          coach_supported: coachSupported,
        },
        physiology: {
          resting_hr_bpm: restingHr ? Number(restingHr) : null,
          max_hr_bpm: maxHr ? Number(maxHr) : null,
          vo2max_ml_kg_min: vo2max ? Number(vo2max) : null,
          vo2max_source: vo2maxSource,
          body_fat_pct: bodyFatPct ? Number(bodyFatPct) : null,
          lab_running_economy: hasLabRe && labReValue ? Number(labReValue) : null,
        },
        recovery: {
          baseline_sleep_hours: Number(sleepHours),
          sleep_quality: sleepQuality,
          typical_recovery_score: Number(recoveryScore),
          typical_fatigue_score: Number(fatigueScore),
          typical_stress_score: Number(stressScore),
          typical_motivation_score: Number(motivationScore),
        },
        goals: {
          target_race_name: targetRaceName || null,
          target_race_distance_km: Number(targetRaceDistKm),
          target_race_date: targetRaceDate || null,
          target_finish_time: targetFinishTime || null,
          primary_performance_goal: primaryGoal,
        },
        preferences: {
          primary_surface: primarySurface,
          typical_terrain: typicalTerrain,
          average_weekly_elevation_gain_m: weeklyElevationGain ? Number(weeklyElevationGain) : null,
          preferred_race_course: preferredCourse,
          preferred_race_environment: preferredEnvironment,
        },
        nutrition: {
          dietary_pattern: dietaryPattern,
          dietary_restrictions: dietaryRestrictions || null,
          fueling_experience: fuelingExperience,
          typical_race_carbs_g_per_h: typicalRaceCarbs ? Number(typicalRaceCarbs) : null,
          typical_race_hydration: typicalHydration,
        },
        health: {
          managing_injury: managingInjury,
          training_modified_by_injury: trainingModified,
        },
      };

      // 2. Post to SQLite Backend
      const res = await fetch("/api/athlete/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to persist athlete profile in SQLite backend");
      }

      // 3. Mark Supabase profile onboarding_complete for sync
      await supabase.from("profiles").upsert({
        user_id: athleteId,
        age: derivedAge,
        body_mass_kg: weightKg,
        sex_category: sexAtBirth === "female" ? "female" : "male",
        onboarding_complete: true,
      });

      // 4. Ensure user role is recorded
      let role = (authData.user.user_metadata?.['role'] as string) || localStorage.getItem("stride_pending_role") || "athlete";
      sessionStorage.setItem("stride_role", role);
      localStorage.setItem("stride_role", role);
      localStorage.removeItem("stride_pending_role");

      // 5. Navigate to Athlete Workspace
      await navigate({ to: "/app" });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setErrorMsg(err.message || "An error occurred while saving your profile.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        {/* Header Branding & Step Counter */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center bg-primary text-primary-foreground font-mono font-bold text-sm">
              S
            </span>
            <span className="font-mono text-xl font-semibold tracking-wider">STRIDE</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs font-semibold text-primary">
              STEP {step} OF 6
            </span>
            <p className="font-mono text-[11px] text-muted-foreground">
              {STEPS[step - 1]?.subtitle || ""}
            </p>
          </div>
        </div>

        {/* 6-Segment Progress Bar */}
        <div className="mt-4 flex gap-1.5">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-sm transition-colors ${
                s.id <= step ? "bg-primary" : "bg-border/60"
              }`}
            />
          ))}
        </div>

        {/* Form Container Panel */}
        <section className="mt-8 border border-border bg-card p-6 shadow-sm sm:p-9">
          {/* Header of Section */}
          <div className="border-b border-border/50 pb-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">
                Section {step}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {STEPS[step - 1]?.title || ""}
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {step === 1 && "About You"}
              {step === 2 && "Your Running Identity"}
              {step === 3 && "Performance Baseline"}
              {step === 4 && "Current Training Baseline"}
              {step === 5 && "Physiological & Recovery Profile"}
              {step === 6 && "Preferences, Nutrition & Health"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1 && "Basic athlete demographics used for baseline calibration."}
              {step === 2 && "Help Stride calibrate training load and race capabilities."}
              {step === 3 && "Personal bests and recent race milestones."}
              {step === 4 && "Your current weekly routine, volume, and target goal."}
              {step === 5 && "Biometric baseline for cardiac and metabolic modeling."}
              {step === 6 && "Surface exposure, fueling background, and health readiness."}
            </p>
          </div>

          {errorMsg && (
            <div className="mt-6 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Personal Information */}
          {step === 1 && (
            <div className="mt-7 space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="full_name">Full Name</Label>
                    <FieldTag type="required" />
                  </div>
                  <Input
                    id="full_name"
                    placeholder="e.g. Eliud Kipchoge"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <FieldTag type="required" />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                    />
                    <div className="flex items-center justify-center rounded border border-border bg-muted/30 px-3 font-mono text-xs">
                      Age: <strong className="ml-1 text-primary">{derivedAge}</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sex_at_birth">Sex at Birth</Label>
                    <FieldTag type="required" />
                  </div>
                  <Select value={sexAtBirth} onValueChange={setSexAtBirth}>
                    <SelectTrigger id="sex_at_birth">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="intersex">Intersex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gender">Gender Identity</Label>
                    <FieldTag type="optional" />
                  </div>
                  <Input
                    id="gender"
                    placeholder="e.g. Man, Woman, Non-binary"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="country">Country</Label>
                    <FieldTag type="recommended" />
                  </div>
                  <Input
                    id="country"
                    placeholder="e.g. Kenya, United States"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="height">Height (cm)</Label>
                    <FieldTag type="required" />
                  </div>
                  <Input
                    id="height"
                    type="number"
                    min={100}
                    max={250}
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <FieldTag type="required" />
                  </div>
                  <Input
                    id="weight"
                    type="number"
                    min={30}
                    max={200}
                    step={0.5}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="location">City / Training Region</Label>
                    <FieldTag type="optional" />
                  </div>
                  <Input
                    id="location"
                    placeholder="e.g. Boulder, CO or Iten"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Running Identity */}
          {step === 2 && (
            <div className="mt-7 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Primary Race Distance</Label>
                  <FieldTag type="required" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: "5k", label: "5K" },
                    { id: "10k", label: "10K" },
                    { id: "half_marathon", label: "Half Marathon" },
                    { id: "marathon", label: "Marathon (42.2k)" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setPrimaryDistance(d.id)}
                      className={`flex h-14 items-center justify-center rounded border p-2 text-center text-sm font-medium transition-all ${
                        primaryDistance === d.id
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "border-border bg-card hover:bg-muted text-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Secondary Race Distances</Label>
                  <FieldTag type="recommended" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: "5k", label: "5K" },
                    { id: "10k", label: "10K" },
                    { id: "half_marathon", label: "Half Marathon" },
                    { id: "marathon", label: "Marathon" },
                  ].map((d) => {
                    const isSelected = secondaryDistances.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleSecondaryDistance(d.id)}
                        className={`flex h-10 items-center justify-center gap-2 rounded border px-3 text-xs transition-all ${
                          isSelected
                            ? "border-accent bg-accent/15 text-accent-foreground font-medium"
                            : "border-border bg-card text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <span className={`size-3 rounded-full border ${isSelected ? "bg-accent border-accent" : "border-muted-foreground"}`} />
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="competitive_level">Competitive Level</Label>
                  <FieldTag type="required" />
                </div>
                <Select value={competitiveLevel} onValueChange={setCompetitiveLevel}>
                  <SelectTrigger id="competitive_level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recreational">Recreational (Finishing & Fitness)</SelectItem>
                    <SelectItem value="competitive_amateur">Competitive Amateur (Age Group / PB focus)</SelectItem>
                    <SelectItem value="advanced">Advanced (Sub-3 Marathon / Boston Qualifier)</SelectItem>
                    <SelectItem value="elite">Elite (National level)</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="running_exp">Running Experience</Label>
                    <FieldTag type="recommended" />
                  </div>
                  <Input
                    id="running_exp"
                    type="number"
                    min={0}
                    step={0.5}
                    value={runningExpYears}
                    onChange={(e) => setRunningExpYears(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Years running regularly</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="half_completed">Half Marathons</Label>
                    <FieldTag type="recommended" />
                  </div>
                  <Input
                    id="half_completed"
                    type="number"
                    min={0}
                    value={halfMarathonsCompleted}
                    onChange={(e) => setHalfMarathonsCompleted(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Races completed</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="marathons_completed">Full Marathons</Label>
                    <FieldTag type="recommended" />
                  </div>
                  <Input
                    id="marathons_completed"
                    type="number"
                    min={0}
                    value={marathonsCompleted}
                    onChange={(e) => setMarathonsCompleted(Number(e.target.value))}
                  />
                  <span className="text-[11px] text-muted-foreground">Races completed</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Performance Baseline */}
          {step === 3 && (
            <div className="mt-7 space-y-7">
              <div className="rounded border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Why we separate these:</strong> Stride distinguishes your lifetime personal bests from recent race performance and separates standalone Half Marathon race times from 21.1 km splits inside a marathon.
              </div>

              {/* Personal Bests */}
              <div className="space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Personal Bests (All-Time)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>Marathon PB</Label>
                    <Input
                      placeholder="HH:MM:SS (e.g. 03:22:15)"
                      value={pbMarathonTime}
                      onChange={(e) => setPbMarathonTime(e.target.value)}
                    />
                    <Input
                      placeholder="Race name & year (e.g. Chicago 2024)"
                      value={pbMarathonRace}
                      onChange={(e) => setPbMarathonRace(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>Half Marathon PB</Label>
                    <Input
                      placeholder="HH:MM:SS (e.g. 01:34:00)"
                      value={pbHalfTime}
                      onChange={(e) => setPbHalfTime(e.target.value)}
                    />
                    <Input
                      placeholder="Race name & year"
                      value={pbHalfRace}
                      onChange={(e) => setPbHalfRace(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>10K PB</Label>
                    <Input
                      placeholder="MM:SS (e.g. 42:30)"
                      value={pb10kTime}
                      onChange={(e) => setPb10kTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>5K PB</Label>
                    <Input
                      placeholder="MM:SS (e.g. 20:15)"
                      value={pb5kTime}
                      onChange={(e) => setPb5kTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Recent Performance Benchmark */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Most Recent Race Performance (Crucial for Baseline)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recent_race_dist">Recent Race Distance</Label>
                    <Select value={recentRaceDist} onValueChange={setRecentRaceDist}>
                      <SelectTrigger id="recent_race_dist">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5k">5K</SelectItem>
                        <SelectItem value="10k">10K</SelectItem>
                        <SelectItem value="half_marathon">Half Marathon</SelectItem>
                        <SelectItem value="marathon">Marathon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recent_race_time">Recent Finish Time</Label>
                    <Input
                      id="recent_race_time"
                      placeholder="HH:MM:SS (e.g. 01:35:10)"
                      value={recentRaceTime}
                      onChange={(e) => setRecentRaceTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="recent_race_name">Race Name & Date</Label>
                    <div className="flex gap-2">
                      <Input
                        id="recent_race_name"
                        placeholder="e.g. London Half Marathon"
                        value={recentRaceName}
                        onChange={(e) => setRecentRaceName(e.target.value)}
                      />
                      <Input
                        type="date"
                        value={recentRaceDate}
                        onChange={(e) => setRecentRaceDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Distinct Standalone Half vs Marathon Half Split */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Half Marathon vs. Marathon Halfway Split
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>Recent Standalone Half Marathon Time</Label>
                    <Input
                      placeholder="HH:MM:SS (21.1 km race)"
                      value={recentHalfTime}
                      onChange={(e) => setRecentHalfTime(e.target.value)}
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      A standalone all-out 21.1 km race.
                    </span>
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label>Recent Marathon Halfway Split (21.1 km mark)</Label>
                    <Input
                      placeholder="HH:MM:SS (split during marathon)"
                      value={recentMarathonHalfSplit}
                      onChange={(e) => setRecentMarathonHalfSplit(e.target.value)}
                    />
                    <span className="text-[11px] text-muted-foreground block">
                      Recorded halfway through a 42.2 km race.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Current Training Baseline */}
          {step === 4 && (
            <div className="mt-7 space-y-7">
              <div className="space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Current Training Volume & Habits
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="weekly_dist">Weekly Distance (km)</Label>
                      <FieldTag type="required" />
                    </div>
                    <Input
                      id="weekly_dist"
                      type="number"
                      min={0}
                      value={weeklyDistKm}
                      onChange={(e) => setWeeklyDistKm(Number(e.target.value))}
                      required
                    />
                    <span className="text-[11px] text-muted-foreground">Typical km/week</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="runs_per_week">Runs Per Week</Label>
                      <FieldTag type="required" />
                    </div>
                    <Select value={String(runsPerWeek)} onValueChange={(v) => setRunsPerWeek(Number(v))}>
                      <SelectTrigger id="runs_per_week">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 1 ? "day" : "days"} / week
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="longest_run">Longest Run (km)</Label>
                      <FieldTag type="required" />
                    </div>
                    <Input
                      id="longest_run"
                      type="number"
                      min={0}
                      value={longestRunKm}
                      onChange={(e) => setLongestRunKm(Number(e.target.value))}
                      required
                    />
                    <span className="text-[11px] text-muted-foreground">In the last 4 weeks</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekly_dur">Weekly Training Time (hrs)</Label>
                    <Input
                      id="weekly_dur"
                      type="number"
                      min={0}
                      step={0.5}
                      value={(weeklyDurationMin / 60).toFixed(1)}
                      onChange={(e) => setWeeklyDurationMin(Number(e.target.value) * 60)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="training_pace">Typical Easy Pace (min/km)</Label>
                    <Input
                      id="training_pace"
                      type="number"
                      step={0.05}
                      value={avgTrainingPace}
                      onChange={(e) => setAvgTrainingPace(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="training_phase">Current Training Phase</Label>
                    <Select value={trainingPhase} onValueChange={setTrainingPhase}>
                      <SelectTrigger id="training_phase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base Building</SelectItem>
                        <SelectItem value="build">Build</SelectItem>
                        <SelectItem value="peak">Peak</SelectItem>
                        <SelectItem value="race_prep">Race Preparation</SelectItem>
                        <SelectItem value="taper">Taper</SelectItem>
                        <SelectItem value="recovery">Recovery</SelectItem>
                        <SelectItem value="off_season">Off-Season</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Target Event */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Target Event & Goal
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="target_race">Race Name</Label>
                    <Input
                      id="target_race"
                      placeholder="e.g. Boston Marathon"
                      value={targetRaceName}
                      onChange={(e) => setTargetRaceName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_date">Race Date</Label>
                    <Input
                      id="target_date"
                      type="date"
                      value={targetRaceDate}
                      onChange={(e) => setTargetRaceDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_finish">Goal Finish Time</Label>
                    <Input
                      id="target_finish"
                      placeholder="HH:MM:SS (e.g. 03:15:00)"
                      value={targetFinishTime}
                      onChange={(e) => setTargetFinishTime(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primary_goal">Primary Goal</Label>
                    <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
                      <SelectTrigger id="primary_goal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="finish">Finish the race safely</SelectItem>
                        <SelectItem value="personal_best">Set a new personal best (PB)</SelectItem>
                        <SelectItem value="target_time">Achieve a specific target time</SelectItem>
                        <SelectItem value="qualify">Qualify for an event (e.g. Boston)</SelectItem>
                        <SelectItem value="pacing">Improve even pacing execution</SelectItem>
                        <SelectItem value="endurance">Build endurance resilience</SelectItem>
                        <SelectItem value="consistency">Maintain training consistency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Coaching & Training Plan */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Training Plan & Guidance
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan_type">Training Plan Structure</Label>
                    <Select value={trainingPlanType} onValueChange={setTrainingPlanType}>
                      <SelectTrigger id="plan_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self_designed">Self-designed</SelectItem>
                        <SelectItem value="coach">1-on-1 Coach</SelectItem>
                        <SelectItem value="club">Running Club / Group</SelectItem>
                        <SelectItem value="online_programme">Online Programme / App</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="coach_supp"
                      checked={coachSupported}
                      onChange={(e) => setCoachSupported(e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    <Label htmlFor="coach_supp" className="cursor-pointer text-sm">
                      I work with a personal coach on Stride
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Physiological & Recovery Baseline */}
          {step === 5 && (
            <div className="mt-7 space-y-7">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                    Physiological Parameters (Optional / Calibrated)
                  </h3>
                  <FieldTag type="optional" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="resting_hr">Resting Heart Rate (bpm)</Label>
                    <Input
                      id="resting_hr"
                      type="number"
                      value={restingHr}
                      onChange={(e) => setRestingHr(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max_hr">Maximum Heart Rate (bpm)</Label>
                    <Input
                      id="max_hr"
                      type="number"
                      value={maxHr}
                      onChange={(e) => setMaxHr(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vo2max">VO₂max (mL/kg/min)</Label>
                    <Input
                      id="vo2max"
                      type="number"
                      step={0.5}
                      placeholder="e.g. 54"
                      value={vo2max}
                      onChange={(e) => setVo2max(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="vo2_source">VO₂max Source</Label>
                    <Select value={vo2maxSource} onValueChange={setVo2maxSource}>
                      <SelectTrigger id="vo2_source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="running_watch">Running watch estimate (Garmin / Apple / Polar)</SelectItem>
                        <SelectItem value="wearable">Other wearable estimate</SelectItem>
                        <SelectItem value="laboratory">Measured in laboratory (Gas analysis / Spirometry)</SelectItem>
                        <SelectItem value="coach_assessment">Coach assessment</SelectItem>
                        <SelectItem value="self_reported">Self-reported / Race calculator</SelectItem>
                        <SelectItem value="unknown">Unknown / Not sure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="body_fat">Body Fat % (Optional)</Label>
                    <Input
                      id="body_fat"
                      type="number"
                      step={0.5}
                      placeholder="e.g. 14%"
                      value={bodyFatPct}
                      onChange={(e) => setBodyFatPct(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded border border-border p-3.5 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="has_re"
                      checked={hasLabRe}
                      onChange={(e) => setHasLabRe(e.target.checked)}
                      className="size-4 rounded border-border"
                    />
                    <Label htmlFor="has_re" className="cursor-pointer text-sm">
                      I have a laboratory Running Economy (RE) test
                    </Label>
                  </div>
                  {hasLabRe && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-2">
                      <Input
                        placeholder="Measured RE (mL/kg/km)"
                        value={labReValue}
                        onChange={(e) => setLabReValue(e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground flex items-center">
                        Used to fine-tune energy expenditure equations.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recovery & Wellness Baseline */}
              <div className="space-y-5 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Recovery & Wellness Baseline
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sleep_hrs">Average Sleep Duration (hours/night)</Label>
                    <Input
                      id="sleep_hrs"
                      type="number"
                      step={0.5}
                      min={4}
                      max={12}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sleep_qual">Typical Sleep Quality</Label>
                    <Select value={sleepQuality} onValueChange={setSleepQuality}>
                      <SelectTrigger id="sleep_qual">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="very_poor">Very poor</SelectItem>
                        <SelectItem value="poor">Poor</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label className="text-xs font-semibold">Pre-Training Recovery Score</Label>
                    <p className="text-[11px] text-muted-foreground">How recovered do you typically feel before hard sessions?</p>
                    <RatingSelector
                      value={recoveryScore}
                      onChange={setRecoveryScore}
                      labels={{
                        1: "Very poorly recovered",
                        2: "Under-recovered",
                        3: "Adequately recovered",
                        4: "Well recovered",
                        5: "Fully fresh & primed",
                      }}
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label className="text-xs font-semibold">Baseline Fatigue Level</Label>
                    <p className="text-[11px] text-muted-foreground">What is your typical chronic fatigue level during training?</p>
                    <RatingSelector
                      value={fatigueScore}
                      onChange={setFatigueScore}
                      labels={{
                        1: "Minimal fatigue",
                        2: "Light normal fatigue",
                        3: "Moderate fatigue",
                        4: "High cumulative fatigue",
                        5: "Heavy exhaustion",
                      }}
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label className="text-xs font-semibold">Non-Training Stress Level</Label>
                    <p className="text-[11px] text-muted-foreground">Daily work/life load outside of running.</p>
                    <RatingSelector
                      value={stressScore}
                      onChange={setStressScore}
                      labels={{
                        1: "Very low stress",
                        2: "Low / manageable",
                        3: "Moderate stress",
                        4: "High stress",
                        5: "Extreme life stress",
                      }}
                    />
                  </div>

                  <div className="space-y-2 rounded border border-border p-3.5">
                    <Label className="text-xs font-semibold">Training Motivation</Label>
                    <p className="text-[11px] text-muted-foreground">Eagerness to lace up and complete workouts.</p>
                    <RatingSelector
                      value={motivationScore}
                      onChange={setMotivationScore}
                      labels={{
                        1: "Very low motivation",
                        2: "Low eagerness",
                        3: "Moderate drive",
                        4: "High motivation",
                        5: "Extremely pumped",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Goals, Preferences & Nutrition */}
          {step === 6 && (
            <div className="mt-7 space-y-7">
              {/* Training Environment & Terrain */}
              <div className="space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Terrain & Environment Exposure
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="primary_surf">Primary Running Surface</Label>
                    <Select value={primarySurface} onValueChange={setPrimarySurface}>
                      <SelectTrigger id="primary_surf">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="road">Road / Pavement</SelectItem>
                        <SelectItem value="track">Synthetic Track</SelectItem>
                        <SelectItem value="trail">Trail / Dirt</SelectItem>
                        <SelectItem value="treadmill">Treadmill</SelectItem>
                        <SelectItem value="mixed">Mixed Surfaces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="typical_terrain">Typical Terrain</Label>
                    <Select value={typicalTerrain} onValueChange={setTypicalTerrain}>
                      <SelectTrigger id="typical_terrain">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Mostly Flat</SelectItem>
                        <SelectItem value="rolling">Rolling Undulations</SelectItem>
                        <SelectItem value="hilly">Hilly</SelectItem>
                        <SelectItem value="mountainous">Mountainous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weekly_elev">Weekly Elevation Gain (m)</Label>
                    <Input
                      id="weekly_elev"
                      type="number"
                      value={weeklyElevationGain}
                      onChange={(e) => setWeeklyElevationGain(Number(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pref_course">Preferred Race Course</Label>
                    <Select value={preferredCourse} onValueChange={setPreferredCourse}>
                      <SelectTrigger id="pref_course">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat / Fast PB Course</SelectItem>
                        <SelectItem value="rolling">Rolling Hills</SelectItem>
                        <SelectItem value="hilly">Technical / Hilly</SelectItem>
                        <SelectItem value="mountainous">Mountainous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="pref_env">Preferred Race Environment</Label>
                    <Select value={preferredEnvironment} onValueChange={setPreferredEnvironment}>
                      <SelectTrigger id="pref_env">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cool">Cool (5°C – 13°C) — Optimal</SelectItem>
                        <SelectItem value="moderate">Moderate (14°C – 19°C)</SelectItem>
                        <SelectItem value="warm">Warm / Humid (20°C+)</SelectItem>
                        <SelectItem value="no_preference">No preference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Nutrition & Fueling Baseline */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                  Nutrition & Fueling Baseline (Task 1B Foundation)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="diet_pattern">Dietary Pattern</Label>
                    <Select value={dietaryPattern} onValueChange={setDietaryPattern}>
                      <SelectTrigger id="diet_pattern">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_preference">No specific preference</SelectItem>
                        <SelectItem value="omnivore">Omnivore</SelectItem>
                        <SelectItem value="vegetarian">Vegetarian</SelectItem>
                        <SelectItem value="vegan">Vegan</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="diet_restrict">Dietary Restrictions or Allergies</Label>
                    <Input
                      id="diet_restrict"
                      placeholder="e.g. Gluten-free, lactose intolerant, none"
                      value={dietaryRestrictions}
                      onChange={(e) => setDietaryRestrictions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fueling_exp">In-Race Fueling Experience</Label>
                    <Select value={fuelingExperience} onValueChange={setFuelingExperience}>
                      <SelectTrigger id="fueling_exp">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never use gels / carbs</SelectItem>
                        <SelectItem value="sometimes">Sometimes (on long runs)</SelectItem>
                        <SelectItem value="usually">Usually (structured fueling)</SelectItem>
                        <SelectItem value="always">Always (trained gut, high intake)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="race_carbs">Typical In-Race Carb Intake (g/hour)</Label>
                    <Input
                      id="race_carbs"
                      type="number"
                      step={5}
                      min={0}
                      max={120}
                      value={typicalRaceCarbs}
                      onChange={(e) => setTypicalRaceCarbs(Number(e.target.value))}
                    />
                    <span className="text-[11px] text-muted-foreground">e.g. 30g = 1 gel/hr, 60g = 2 gels/hr</span>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="hydration">Typical Hydration Strategy</Label>
                    <Select value={typicalHydration} onValueChange={setTypicalHydration}>
                      <SelectTrigger id="hydration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="water_only">Water only</SelectItem>
                        <SelectItem value="electrolyte_drink">Electrolyte sports drink only</SelectItem>
                        <SelectItem value="water_and_electrolytes">Water + Electrolyte drink</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Health & Injury Status (Carefully Scoped) */}
              <div className="space-y-4 border-t border-border/50 pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
                    Health & Injury Readiness
                  </h3>
                  <FieldTag type="optional" />
                </div>
                <div className="rounded border border-border bg-muted/20 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="managing_inj">
                      Are you currently managing a running-related injury or condition that affects training?
                    </Label>
                    <Select value={managingInjury} onValueChange={setManagingInjury}>
                      <SelectTrigger id="managing_inj">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No, healthy and training normally</SelectItem>
                        <SelectItem value="yes">Yes, currently managing an issue</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {managingInjury === "yes" && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label htmlFor="train_mod">
                        Is your current training modified because of this issue?
                      </Label>
                      <Select value={trainingModified} onValueChange={setTrainingModified}>
                        <SelectTrigger id="train_mod">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No, doing normal volume</SelectItem>
                          <SelectItem value="yes">Yes, volume or intensity is currently restricted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Footer */}
          <div className="mt-10 flex items-center justify-between border-t border-border/50 pt-5">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 1 || busy}
              onClick={handleBack}
            >
              <ArrowLeft className="mr-1.5 size-4" /> Back
            </Button>

            {step < 6 ? (
              <Button type="button" onClick={handleNext}>
                Continue to Section {step + 1}
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={finishSetup}
                disabled={busy}
                className="bg-primary text-primary-foreground font-semibold px-6"
              >
                {busy ? "Saving Profile…" : (
                  <>
                    Finish Setup & Enter Stride <Check className="ml-2 size-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}