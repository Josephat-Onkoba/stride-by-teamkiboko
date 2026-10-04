import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Info, Zap, Flame, Battery, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/stride/app-shell";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/fuel")({
  head: () => ({ meta: [
    { title: "Fuel lab — Stride" },
    { name: "description", content: "Evidence-based pre-race, in-race and post-race nutrition plans driven by your physiology profile." },
    { property: "og:title", content: "Fuel lab — Stride" },
    { property: "og:description", content: "Physiology-driven endurance fueling." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" }
  ] }),
  component: Fuel,
});

function Fuel() {
  const [plan, setPlan] = useState<any>(null);
  const [intake, setIntake] = useState([75]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Call the full pipeline to get nutrition data
    fetch('/api/predict/full-plan/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        age: 28, gender: "M", split_hhmmss: "01:35:00",
        weight_kg: 70, height_cm: 178, sex: 1,
        hr_rest: 52, hr_max: 188,
        training_hours_per_week: 8,
        is_carb_loaded: true,
        course_id: "boston",
        temperature_c: 20,
        relative_humidity_pct: 70,
        wind_speed_mps: 4.5,
        wind_direction_deg: 90
      })
    })
    .then(res => res.json())
    .then(data => {
      setPlan(data.task_1b);
      if (data.task_1b?.in_race?.recommended_g_hr) {
        setIntake([data.task_1b.in_race.recommended_g_hr]);
      }
      setLoading(false);
    })
    .catch(() => setLoading(false));
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
      <p className="font-mono text-xs uppercase text-primary">Task 1B · Nutrition Engine</p>
      <h1 className="mt-2 text-3xl font-semibold">Fuel lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Powered by physiology profile · CHO oxidation: {substrates?.cho_oxidation_g_hr ?? "–"} g/hr · RER: {physio?.rer ?? "–"}
      </p>

      <Tabs defaultValue="race" className="mt-7">
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
    </AppShell>
  );
}