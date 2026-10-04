import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogActivityModal } from "@/components/stride/log-activity-modal";
import { AcwrGauge } from "@/components/stride/acwr-gauge";
import {
  Activity,
  Watch,
  UploadCloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Smartphone,
  Calendar,
  Route as RouteIcon,
  Plus,
  Flame,
  Heart,
  Mountain,
  Gauge,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Devices & Activity History — Stride" }] }),
  component: DevicesPage,
});

function DevicesPage() {
  const [athleteId, setAthleteId] = useState<string>("101");
  const [syncing, setSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [activities, setActivities] = useState<any[]>([]);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setAthleteId(user.id);
        fetchHistory(user.id);
      } else {
        fetchHistory("101");
      }
    });
  }, []);

  const fetchHistory = (idToFetch = athleteId) => {
    fetch(`/api/activities/${idToFetch}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.activities) {
          setActivities(data.activities);
        }
      })
      .catch(console.error);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("uploading");

    const formData = new FormData();
    formData.append("file", file);

    fetch(`/api/activities/upload?athlete_id=${athleteId}`, {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" || data.activity_id || data.id) {
          setUploadStatus("success");
          fetchHistory(athleteId);
          setReloadKey((prev) => prev + 1);
          setTimeout(() => setUploadStatus("idle"), 3500);
        } else {
          setUploadStatus("error");
          setTimeout(() => setUploadStatus("idle"), 4000);
        }
      })
      .catch(() => {
        setUploadStatus("error");
        setTimeout(() => setUploadStatus("idle"), 4000);
      });
  };

  const handleGarminSync = () => {
    setSyncing(true);
    // Simulate OAuth sync handshake
    setTimeout(() => {
      setSyncing(false);
      fetchHistory(athleteId);
      setReloadKey((prev) => prev + 1);
    }, 1800);
  };

  const onActivityLogged = () => {
    fetchHistory(athleteId);
    setReloadKey((prev) => prev + 1);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header with Title & Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-wider uppercase inline-flex items-center gap-1.5">
                <Watch className="size-3.5" /> Wearables & Training Stream
              </span>
              <span className="text-xs font-mono text-muted-foreground">Athlete: {athleteId.slice(0, 8)}...</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Devices & Activity History</h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              Continuous GPS & wearable sync directly feeds Stride's SQLite training log, calculating ACWR, session RPE loads, and updating your marathon predictions in real-time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsLogModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/20"
            >
              <Plus className="size-4 mr-2" /> Log Activity
            </Button>
          </div>
        </div>

        {/* Workload ACWR Gauge Component */}
        <div className="w-full">
          <AcwrGauge athleteId={athleteId} reloadKey={reloadKey} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Connection & Import Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border/60 p-5 rounded-xl shadow-sm">
              <h3 className="font-mono text-xs uppercase text-muted-foreground mb-3 flex items-center justify-between">
                <span>Wearable Connect</span>
                <span className="text-[10px] text-primary font-normal">OAuth 2.0</span>
              </h3>
              
              <div className="space-y-3">
                {/* Garmin Connect */}
                <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border/50 rounded-lg hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                      <Watch className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs">Garmin Connect</h4>
                      <p className="text-[11px] text-muted-foreground">FIT & TCX Auto-Sync</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleGarminSync} disabled={syncing}>
                    {syncing ? <RefreshCw className="size-3.5 animate-spin" /> : "Connect"}
                  </Button>
                </div>

                {/* Apple Health */}
                <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border/50 rounded-lg hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center">
                      <Smartphone className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs">Apple Health</h4>
                      <p className="text-[11px] text-muted-foreground">HealthKit Workout Stream</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs">Connect</Button>
                </div>

                {/* Strava */}
                <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border/50 rounded-lg hover:border-border transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                      <Activity className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-xs">Strava API</h4>
                      <p className="text-[11px] text-muted-foreground">Webhook Ingestion</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs">Connect</Button>
                </div>
                
                {/* Manual CSV File Upload */}
                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-mono text-xs uppercase text-muted-foreground">CSV / FIT Import</h4>
                    <span className="text-[10px] text-muted-foreground">Batch Upload</span>
                  </div>
                  
                  <input 
                    type="file" 
                    accept=".csv,.fit"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                  />
                  
                  <Button 
                    className="w-full text-xs font-semibold" 
                    variant={uploadStatus === "success" ? "default" : "secondary"}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === "uploading"}
                  >
                    {uploadStatus === "uploading" ? (
                      <><RefreshCw className="size-3.5 mr-2 animate-spin" /> Ingesting to SQLite...</>
                    ) : uploadStatus === "success" ? (
                      <><CheckCircle2 className="size-3.5 mr-2 text-green-400" /> Imported Successfully</>
                    ) : uploadStatus === "error" ? (
                      <><AlertTriangle className="size-3.5 mr-2 text-destructive" /> Failed — Try CSV</>
                    ) : (
                      <><UploadCloud className="size-3.5 mr-2" /> Upload Activity CSV</>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center mt-2">
                    Accepts Strava, Coros, Garmin, and Wahoo CSV exports.
                  </p>
                </div>

              </div>
            </div>
            
            {/* Real-Time Recalculation Note */}
            <div className="bg-primary/5 border border-primary/20 p-5 rounded-xl text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <Info className="size-4 shrink-0" />
                <span>Automated Workload & ML Pipeline</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Activities logged manually or synced via wearable instantly recalculate your rolling 7-day volume, acute/chronic workload ratio (ACWR), and Foster training monotony.
              </p>
            </div>
          </div>

          {/* Activity Log Table / List Panel */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border/60 p-5 rounded-xl shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <RouteIcon className="size-4 text-primary" />
                  <h3 className="font-semibold text-sm">Synchronized Activities</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground">
                    {activities.length} {activities.length === 1 ? "activity" : "activities"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => fetchHistory(athleteId)} className="h-7 px-2">
                    <RefreshCw className="size-3.5" />
                  </Button>
                </div>
              </div>

              {activities.length === 0 ? (
                <div className="my-auto py-16 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="size-16 rounded-full bg-muted/40 flex items-center justify-center border border-border/60">
                    <Activity className="size-8 text-muted-foreground/60" />
                  </div>
                  <h4 className="font-semibold text-base">No Activities Recorded Yet</h4>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Connect your GPS watch, import a workout CSV, or log your recent training run manually to populate your longitudinal workload history.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setIsLogModalOpen(true)}
                    className="mt-2 text-xs font-semibold"
                  >
                    <Plus className="size-3.5 mr-1.5" /> Log First Workout
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[580px] pr-1">
                  {activities.map((act) => {
                    const dateStr = act.activity_date || act.date || "Recent";
                    const actType = (act.activity_type || "easy_run").replace("_", " ");
                    const dist = act.distance_km ? Number(act.distance_km).toFixed(1) : "—";
                    const dur = act.duration_min || act.duration_minutes || "—";
                    const pace = act.pace_min_km || (act.average_pace_minkm ? `${act.average_pace_minkm.toFixed(2)}/km` : "—");
                    const hr = act.average_hr ? `${Math.round(act.average_hr)} bpm` : "—";
                    const rpe = act.perceived_exertion || act.rpe;
                    const rpeLoad = act.session_rpe_load || (rpe && dur ? Math.round(Number(dur) * Number(rpe)) : null);
                    const trimp = act.trimp_score ? Math.round(Number(act.trimp_score)) : null;
                    const elevGain = act.elevation_gain_m ? Math.round(Number(act.elevation_gain_m)) : null;

                    return (
                      <div
                        key={act.id}
                        className="p-3.5 bg-muted/20 hover:bg-muted/40 border border-border/50 rounded-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        {/* Left metadata */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-medium text-primary flex items-center gap-1">
                              <Calendar className="size-3" /> {dateStr}
                            </span>
                            <span className="capitalize px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border/80">
                              {actType}
                            </span>
                            {act.source && (
                              <span className="text-[9px] uppercase font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                                {act.source}
                              </span>
                            )}
                          </div>
                          {act.notes && (
                            <p className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                              "{act.notes}"
                            </p>
                          )}
                        </div>

                        {/* Right metrics grid */}
                        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                          <div className="text-right min-w-[50px]">
                            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Dist</span>
                            <span className="font-mono font-semibold text-foreground">{dist} km</span>
                          </div>
                          <div className="text-right min-w-[50px]">
                            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Time</span>
                            <span className="font-mono font-medium text-foreground">{dur} min</span>
                          </div>
                          <div className="text-right min-w-[55px]">
                            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Pace</span>
                            <span className="font-mono font-medium text-foreground">{pace}</span>
                          </div>
                          <div className="text-right min-w-[55px]">
                            <span className="block text-[9px] uppercase tracking-wider text-muted-foreground">Avg HR</span>
                            <span className="font-mono font-medium text-rose-400">{hr}</span>
                          </div>

                          {/* Workload / RPE Badges */}
                          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                            {rpeLoad !== null && (
                              <div className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-mono text-[10px] font-semibold flex items-center gap-1" title={`Session RPE Load: Duration × RPE (${rpe}/10)`}>
                                <Flame className="size-3" />
                                {rpeLoad}
                              </div>
                            )}
                            {trimp !== null && (
                              <div className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono text-[10px] font-semibold" title="Banister TRIMP score">
                                T:{trimp}
                              </div>
                            )}
                            {elevGain !== null && elevGain > 0 && (
                              <div className="px-2 py-1 rounded bg-muted text-muted-foreground font-mono text-[10px] flex items-center gap-1" title="Elevation gain">
                                <Mountain className="size-3" />
                                +{elevGain}m
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal for manual activity logging */}
        <LogActivityModal
          athleteId={athleteId}
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          onActivityLogged={onActivityLogged}
        />

      </div>
    </AppShell>
  );
}

