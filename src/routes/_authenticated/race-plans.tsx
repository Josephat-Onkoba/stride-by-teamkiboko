import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { RaceRibbon } from "@/components/stride/race-ribbon";
import { WindVectorBadge } from "@/components/stride/wind-vector-badge";
import { Button } from "@/components/ui/button";
import {
  MountainSnow,
  MapPin,
  Wind,
  TrendingUp,
  Droplets,
  ArrowRight,
  Activity,
  History,
  Thermometer,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { EvidenceBadge } from "@/components/stride/evidence-badge";

export const Route = createFileRoute("/_authenticated/race-plans")({
  head: () => ({ meta: [{ title: "Course & Topography Analyzer — Stride" }] }),
  component: RaceAnalyzer,
});

function RaceAnalyzer() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("boston");
  const [courseProfile, setCourseProfile] = useState<any>(null);
  const [weatherObservations, setWeatherObservations] = useState<any[]>([]);
  const [selectedWeatherIndex, setSelectedWeatherIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Weather parameters state (editable / updated by presets)
  const [tempC, setTempC] = useState<number>(14.5);
  const [humidityPct, setHumidityPct] = useState<number>(65);
  const [windMps, setWindMps] = useState<number>(3.2);
  const [windDirDeg, setWindDirDeg] = useState<number>(75);

  // Fetch available courses
  useEffect(() => {
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCourses(data);
        }
      })
      .catch(console.error);
  }, []);

  // Fetch specific course profile & segments when selected
  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    fetch(`/api/courses/${selectedCourseId}`)
      .then((res) => res.json())
      .then((data) => {
        setCourseProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch historical weather observations for this course
    fetch(`/api/weather/observations?query=${selectedCourseId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWeatherObservations(data);
          if (data.length > 0) {
            setSelectedWeatherIndex(0);
            applyWeatherPreset(data[0]);
          }
        }
      })
      .catch(console.error);
  }, [selectedCourseId]);

  const applyWeatherPreset = (obs: any) => {
    if (!obs) return;
    if (obs.temperature_c !== undefined) setTempC(Number(obs.temperature_c));
    if (obs.relative_humidity_pct !== undefined) setHumidityPct(Number(obs.relative_humidity_pct));
    if (obs.wind_speed_mps !== undefined) setWindMps(Number(obs.wind_speed_mps));
    if (obs.wind_direction_deg !== undefined) setWindDirDeg(Number(obs.wind_direction_deg));
  };

  const handleSelectPreset = (idx: number) => {
    setSelectedWeatherIndex(idx);
    applyWeatherPreset(weatherObservations[idx]);
  };

  // Environmental calculations
  const courseHeading = courseProfile?.general_heading_deg || 0;
  const relAngle = ((windDirDeg - courseHeading) % 360 + 360) % 360;
  const relRad = (relAngle * Math.PI) / 180;
  const headwindMps = Math.round(windMps * Math.cos(relRad) * 10) / 10;
  const headwindSlowdownSec = headwindMps > 0 ? (headwindMps * 0.9).toFixed(1) : "0.0";
  const wbgtHeatPenalty = tempC > 18 ? ((tempC - 18) * 0.8).toFixed(1) : "0.0";

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/40 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-1.5">
                <MountainSnow className="size-3.5" /> Topography & Segments
              </span>
              <span className="text-xs font-mono text-muted-foreground">Minetti Metabolic Cost Model</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Race Course & Topography Analyzer</h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              Inspect course-segment elevation grades, Minetti metabolic energy multipliers, and historical weather vectors to optimize segment-by-segment pacing.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Select Course</label>
            <select 
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3.5 py-2 bg-card border border-border/60 rounded-md font-mono text-xs font-semibold outline-none focus:border-primary"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="h-64 flex items-center justify-center font-mono text-sm text-muted-foreground animate-pulse">
            Loading course topography and segment database...
          </div>
        )}

        {courseProfile && !loading && (
          <div className="space-y-8">
            
            {/* Topography Chart & Overview Cards */}
            <div className="grid lg:grid-cols-3 gap-8">
              
              {/* Topography Chart Panel */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card border border-border/60 p-6 rounded-xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-2">
                      <MapPin className="size-4 text-primary" /> Elevation Profile (m) — {courseProfile.name}
                    </h3>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Heading: {courseProfile.general_heading_deg}° · Distance: {courseProfile.total_distance_km} km
                    </span>
                  </div>
                  
                  {/* Visual Elevation Bar Chart */}
                  <div className="h-56 flex items-end gap-1 px-2 border-b border-l border-border/50 pb-2 pl-2">
                    {courseProfile.elevation_profile?.map((p: any, i: number) => {
                      const dist = p[0];
                      const elev = p[1];
                      // Scale elevation dynamically
                      const minElev = 0;
                      const maxElev = 180;
                      const heightPercent = Math.max(10, Math.min(100, ((elev - minElev) / maxElev) * 100));
                      const grade = courseProfile.segments && courseProfile.segments[i] ? courseProfile.segments[i].grade_pct : 0;
                      const isUphill = grade > 1;
                      const isDownhill = grade < -1;
                      const color = isUphill ? "bg-rose-500/80" : isDownhill ? "bg-emerald-500/80" : "bg-primary/60";
                      
                      return (
                        <div key={i} className="flex-1 flex flex-col justify-end group relative">
                          <div 
                            className={`w-full rounded-t-sm transition-all duration-300 hover:opacity-100 opacity-80 ${color}`}
                            style={{ height: `${heightPercent}%` }}
                          />
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border p-2 rounded shadow-lg z-20 text-[10px] font-mono whitespace-nowrap pointer-events-none">
                            Km {dist.toFixed(1)}: {elev.toFixed(1)}m<br />
                            Grade: {grade.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Distance Markers */}
                  <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground px-2">
                    <span>Start (0 km)</span>
                    <span>10 km</span>
                    <span>Half (21.1 km)</span>
                    <span>30 km</span>
                    <span>Finish (42.2 km)</span>
                  </div>
                </div>

                {/* Segment Difficulty Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card border border-border/60 p-4 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Total Ascent</span>
                    <span className="text-lg font-mono font-semibold flex items-center gap-1.5 text-rose-400">
                      <TrendingUp className="size-4" /> +{Math.round(courseProfile.total_ascent_m || 0)}m
                    </span>
                  </div>
                  <div className="bg-card border border-border/60 p-4 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Total Descent</span>
                    <span className="text-lg font-mono font-semibold flex items-center gap-1.5 text-emerald-400">
                      <TrendingUp className="size-4 rotate-180" /> -{Math.round(courseProfile.total_descent_m || 0)}m
                    </span>
                  </div>
                  <div className="bg-card border border-border/60 p-4 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Net Elevation</span>
                    <span className="text-lg font-mono font-semibold text-foreground">
                      {(courseProfile.net_elevation_m || 0) > 0 ? `+${Math.round(courseProfile.net_elevation_m)}m` : `${Math.round(courseProfile.net_elevation_m || 0)}m`}
                    </span>
                  </div>
                  <div className="bg-card border border-border/60 p-4 rounded-lg">
                    <span className="text-[10px] uppercase font-mono text-muted-foreground block mb-1">Course Difficulty</span>
                    <span className="text-lg font-mono font-semibold flex items-center gap-1.5 text-primary">
                      <Activity className="size-4" /> {(courseProfile.course_difficulty_score || 0).toFixed(1)} / 10
                    </span>
                  </div>
                </div>

              </div>

              {/* Right Sidebar - Historical Weather & Wind Vector */}
              <div className="space-y-6">
                
                {/* Historical Weather Presets */}
                <div className="bg-card border border-border/60 p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-1.5 font-semibold text-xs">
                      <History className="size-4 text-primary" />
                      <span>Historical Race Weather</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">SQLite Weather Layer</span>
                  </div>

                  {weatherObservations.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No historical observations logged for this course.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">Select past race condition to test environmental impact:</p>
                      <div className="flex flex-col gap-1.5">
                        {weatherObservations.map((obs, idx) => {
                          const isSelected = selectedWeatherIndex === idx;
                          return (
                            <button
                              key={obs.id || idx}
                              type="button"
                              onClick={() => handleSelectPreset(idx)}
                              className={`text-left p-2 rounded-md border text-xs transition-colors flex items-center justify-between ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border/60 bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              <div>
                                <span className="font-semibold block">{obs.observation_time?.slice(0, 4) || "Race Day"}</span>
                                <span className="text-[10px] font-mono">
                                  {obs.temperature_c}°C · {obs.relative_humidity_pct}% RH · {obs.wind_speed_mps} m/s
                                </span>
                              </div>
                              {isSelected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Wind Vector Compass Badge */}
                  <div className="pt-2">
                    <WindVectorBadge
                      windSpeedMps={windMps}
                      windDirectionDeg={windDirDeg}
                      courseHeadingDeg={courseHeading}
                    />
                  </div>

                  {/* Environmental Impact Summary */}
                  <div className="bg-muted/30 border border-border/50 p-3 rounded-lg text-xs space-y-2 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wind className="size-3" /> Headwind Slowdown:
                      </span>
                      <span className="text-warning font-semibold">+{headwindSlowdownSec}s / km</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Thermometer className="size-3" /> WBGT Heat Strain:
                      </span>
                      <span className="text-warning font-semibold">+{wbgtHeatPenalty}s / km</span>
                    </div>
                  </div>
                </div>

                {/* Tactical Segment Strategy Notice */}
                <div className="bg-primary/5 border border-primary/20 p-5 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Zap className="size-4" />
                    <span>Minetti Energy Cost Modeling</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Stride applies the Minetti (2002) 5th-order polynomial to convert raw elevation grade into metabolic energy demand. Uphill grades cost up to 40% more glycogen; downhill segments below -5% require eccentric quadriceps protection.
                  </p>
                </div>

              </div>
            </div>

            {/* Course Segment Topography Table */}
            {courseProfile.segments && courseProfile.segments.length > 0 && (
              <div className="bg-card border border-border/60 p-6 rounded-xl shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      <MountainSnow className="size-4 text-primary" /> Segment Topography & Metabolic Cost Table
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Structured kilometer segments with elevation changes and calculated Minetti energy cost multipliers.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {courseProfile.segments.length} segments analyzed
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] text-left">
                        <th className="py-2 px-3">Segment</th>
                        <th className="py-2 px-3">Distance Range</th>
                        <th className="py-2 px-3">Start / End Elev</th>
                        <th className="py-2 px-3">Elevation Delta</th>
                        <th className="py-2 px-3">Grade (%)</th>
                        <th className="py-2 px-3">Minetti Cost Multiplier</th>
                        <th className="py-2 px-3">Pacing & Tactical Strategy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {courseProfile.segments.map((seg: any) => {
                        const grade = Number(seg.grade_pct || 0);
                        const isUphill = grade > 1.0;
                        const isDownhill = grade < -1.0;
                        const costMult = seg.difficulty_weight ? Number(seg.difficulty_weight).toFixed(2) : "1.00";
                        
                        let strategyTag = "Even Aerobic Effort";
                        if (grade > 2.5) strategyTag = "Conserve Glycogen — High Metabolic Cost";
                        else if (grade > 1.0) strategyTag = "Controlled Climb — Maintain Target HR";
                        else if (grade < -2.5) strategyTag = "Controlled Descents — Protect Quadriceps";
                        else if (grade < -1.0) strategyTag = "Gentle Assist — Relax Stride Cadence";

                        return (
                          <tr key={seg.segment_index || seg.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              Seg #{seg.segment_index}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {seg.start_km.toFixed(1)} – {seg.end_km.toFixed(1)} km
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {Math.round(seg.start_elevation_m)}m → {Math.round(seg.end_elevation_m)}m
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={seg.elevation_change_m > 0 ? "text-rose-400 font-semibold" : seg.elevation_change_m < 0 ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>
                                {seg.elevation_change_m > 0 ? `+${Math.round(seg.elevation_change_m)}m` : `${Math.round(seg.elevation_change_m)}m`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isUphill ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : isDownhill ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-muted text-muted-foreground"
                              }`}>
                                {grade > 0 ? `+${grade.toFixed(1)}%` : `${grade.toFixed(1)}%`}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              <span className={Number(costMult) > 1.1 ? "text-warning" : Number(costMult) < 0.95 ? "text-emerald-400" : "text-foreground"}>
                                {costMult}×
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-muted-foreground">
                              {strategyTag}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Printable Race Ribbon */}
            <div className="pt-2">
              <RaceRibbon />
            </div>

          </div>
        )}

      </div>
    </AppShell>
  );
}