import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { Activity, Watch, UploadCloud, RefreshCw, CheckCircle2, AlertTriangle, Play, Smartphone, Calendar, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "Devices & History — Stride" }] }),
  component: DevicesPage,
});

function DevicesPage() {
  const [syncing, setSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [activities, setActivities] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = () => {
    fetch("/api/activities/101")
      .then(res => res.json())
      .then(data => {
        if (data.activities) setActivities(data.activities);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadStatus("uploading");
    
    const formData = new FormData();
    formData.append("file", file);
    
    fetch("/api/activities/upload?athlete_id=101", {
      method: "POST",
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setUploadStatus("success");
          fetchHistory();
          setTimeout(() => setUploadStatus("idle"), 3000);
        } else {
          setUploadStatus("error");
        }
      })
      .catch(() => setUploadStatus("error"));
  };

  const handleGarminSync = () => {
    setSyncing(true);
    // Simulate OAuth / API sync delay
    setTimeout(() => {
      setSyncing(false);
    }, 2000);
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="space-y-3">
          <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-widest uppercase inline-flex items-center gap-2">
            <Watch className="size-4" /> Integrations
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Devices & History</h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Sync your smartwatch or Strava history to continuously tune your physiology profile and marathon projections.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Connection Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-card border border-border/60 p-6 rounded-xl">
              <h3 className="font-mono text-xs uppercase text-muted-foreground mb-4">Connected Services</h3>
              
              <div className="space-y-4">
                {/* Garmin Connect */}
                <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                      <Watch className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Garmin Connect</h4>
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleGarminSync} disabled={syncing}>
                    {syncing ? <RefreshCw className="size-4 animate-spin" /> : "Connect"}
                  </Button>
                </div>

                {/* Apple Health */}
                <div className="flex items-center justify-between p-4 bg-muted/30 border border-border/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                      <Smartphone className="size-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Apple Health</h4>
                      <p className="text-xs text-muted-foreground">Not connected</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Connect</Button>
                </div>
                
                <div className="pt-4 border-t border-border/50">
                  <h4 className="font-mono text-xs uppercase text-muted-foreground mb-3">Manual Import</h4>
                  
                  <input 
                    type="file" 
                    accept=".csv"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                  />
                  
                  <Button 
                    className="w-full" 
                    variant={uploadStatus === "success" ? "default" : "secondary"}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadStatus === "uploading"}
                  >
                    {uploadStatus === "uploading" ? (
                      <><RefreshCw className="size-4 mr-2 animate-spin" /> Parsing CSV...</>
                    ) : uploadStatus === "success" ? (
                      <><CheckCircle2 className="size-4 mr-2 text-green-400" /> Uploaded Successfully</>
                    ) : (
                      <><UploadCloud className="size-4 mr-2" /> Upload Activity CSV</>
                    )}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Supports Strava, Coros, and Wahoo exports (.csv)
                  </p>
                </div>

              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-6 rounded-xl">
              <div className="flex items-start gap-3">
                <Activity className="size-5 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold text-primary text-sm mb-1">Dynamic Projections</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Every synced activity updates your rolling 7-day volume and Long Run stats, automatically recalibrating the Stride AI for a more accurate marathon finish time.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log Panel */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border/60 p-6 rounded-xl h-full shadow-xl shadow-primary/5">
              <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
                <h3 className="font-mono text-xs uppercase text-muted-foreground flex items-center gap-2">
                  <RouteIcon className="size-4 text-primary" /> Activity Log
                </h3>
                <span className="text-xs font-mono text-muted-foreground">Showing latest {activities.length} runs</span>
              </div>

              {activities.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center">
                    <Activity className="size-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-mono text-sm">No activity history found.</p>
                  <p className="text-xs text-muted-foreground/70 max-w-xs">Connect a device or upload a CSV export to build your physiology profile.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.slice().reverse().map((act) => (
                    <div key={act.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-muted/20 border border-border/50 rounded-lg hover:border-primary/50 transition-colors">
                      <div className="flex flex-col gap-1 mb-3 md:mb-0">
                        <span className="text-[10px] font-mono text-primary flex items-center gap-1">
                          <Calendar className="size-3" /> {act.date}
                        </span>
                        <h4 className="font-semibold flex items-center gap-2">
                          <Play className="size-4 text-success" /> Afternoon Run
                        </h4>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Distance</span>
                          <span className="font-mono font-medium">{act.distance_km} km</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Pace</span>
                          <span className="font-mono font-medium">{act.pace_min_km} /km</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">Avg HR</span>
                          <span className="font-mono font-medium text-destructive">{act.average_hr || '--'} bpm</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
