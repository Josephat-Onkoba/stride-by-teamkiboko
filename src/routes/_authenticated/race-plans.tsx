import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { RaceRibbon } from "@/components/stride/race-ribbon";
import { Button } from "@/components/ui/button";
import { MountainSnow, MapPin, Wind, TrendingUp, Droplets, ArrowRight } from "lucide-react";
import { EvidenceBadge } from "@/components/stride/evidence-badge";

export const Route = createFileRoute("/_authenticated/race-plans")({
  head: () => ({ meta: [{ title: "Race Analyzer — Stride" }] }),
  component: RaceAnalyzer,
});

function RaceAnalyzer() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("boston");
  const [courseProfile, setCourseProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch available courses
  useEffect(() => {
    fetch("/api/courses")
      .then(res => res.json())
      .then(data => setCourses(data))
      .catch(console.error);
  }, []);

  // Fetch specific course profile when selected
  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    fetch(`/api/courses/${selectedCourseId}/profile`)
      .then(res => res.json())
      .then(data => {
        setCourseProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCourseId]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-widest uppercase inline-flex items-center gap-2">
              <MountainSnow className="size-4" /> Course Analyzer
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Race Plans</h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Map your pacing and nutrition strategies directly against course elevation and wind vectors.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground uppercase font-mono tracking-widest">Select Course</label>
            <select 
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-4 py-2 bg-card border border-border/60 rounded-md font-mono text-sm outline-none focus:border-primary"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <div className="h-64 flex items-center justify-center font-mono text-muted-foreground animate-pulse">Analyzing Topography...</div>}

        {courseProfile && !loading && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Topography Chart Panel */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-card border border-border/60 p-6 rounded-xl shadow-xl shadow-primary/5">
                <h3 className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-2 mb-6">
                  <MapPin className="size-4 text-primary" /> Elevation Profile (m)
                </h3>
                
                {/* Visual Elevation Bar Chart */}
                <div className="h-64 flex items-end gap-1 px-2 border-b border-l border-border/50 pb-2 pl-2">
                  {courseProfile.elevation_profile?.map((p: any, i: number) => {
                    const dist = p[0];
                    const elev = p[1];
                    const heightPercent = Math.max(10, (elev / 200) * 100); // normalized for ~200m max
                    const grade = i > 0 ? courseProfile.segment_grades[i - 1] : 0;
                    const isUphill = grade > 1;
                    const isDownhill = grade < -1;
                    const color = isUphill ? 'bg-destructive/80' : isDownhill ? 'bg-success/80' : 'bg-primary/50';
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end group relative">
                        <div 
                          className={`w-full rounded-t-sm transition-all duration-300 hover:opacity-100 opacity-80 ${color}`}
                          style={{ height: `${heightPercent}%` }}
                        ></div>
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border p-2 rounded shadow-lg z-10 text-[10px] font-mono whitespace-nowrap pointer-events-none">
                          KM {dist}: {elev.toFixed(1)}m<br/>
                          Grade: {grade.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Distance Markers */}
                <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground px-2">
                  <span>Start</span>
                  <span>10k</span>
                  <span>Half</span>
                  <span>30k</span>
                  <span>Finish</span>
                </div>
              </div>

              {/* Segment Difficulty Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/20 border border-border/50 p-4 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Total Ascent</span>
                  <span className="text-xl font-mono font-semibold flex items-center gap-2">
                    <TrendingUp className="size-4 text-destructive"/> {courseProfile.total_ascent_m}m
                  </span>
                </div>
                <div className="bg-muted/20 border border-border/50 p-4 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Total Descent</span>
                  <span className="text-xl font-mono font-semibold flex items-center gap-2">
                    <TrendingUp className="size-4 text-success rotate-180"/> {courseProfile.total_descent_m}m
                  </span>
                </div>
                <div className="bg-muted/20 border border-border/50 p-4 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Max Grade</span>
                  <span className="text-xl font-mono font-semibold flex items-center gap-2">
                    <MountainSnow className="size-4 text-warning"/> {courseProfile.max_uphill_grade_pct?.toFixed(1) || 0}%
                  </span>
                </div>
                <div className="bg-muted/20 border border-border/50 p-4 rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Difficulty Score</span>
                  <span className="text-xl font-mono font-semibold flex items-center gap-2">
                    <Activity className="size-4 text-primary"/> {courseProfile.course_difficulty_score?.toFixed(1) || 0}
                  </span>
                </div>
              </div>

            </div>

            {/* Right Sidebar - Race Ribbon & Environment */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-6 rounded-xl">
                <h3 className="font-mono text-xs uppercase text-primary font-semibold mb-4">Environment Overlay</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <span className="text-sm flex items-center gap-2"><Wind className="size-4 text-muted-foreground"/> Est. Headwind</span>
                    <span className="font-mono text-sm">+2.4s / km</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <span className="text-sm flex items-center gap-2"><Droplets className="size-4 text-muted-foreground"/> WBGT Heat Penalty</span>
                    <span className="font-mono text-sm text-warning">+4.1s / km</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                    <EvidenceBadge kind="A" /> The Course Analyzer maps these localized weather vectors directly to the elevation profile to calculate your segment-specific pacing strategy below.
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border p-6 rounded-xl">
                <h3 className="font-mono text-xs uppercase text-muted-foreground mb-4 flex items-center justify-between">
                  Race Ribbon <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase">Print <ArrowRight className="ml-1 size-3"/></Button>
                </h3>
                <RaceRibbon />
              </div>

            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}