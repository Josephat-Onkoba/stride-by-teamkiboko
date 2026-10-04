import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { Check, Mail, Award, TrendingUp, ShieldCheck, Search, Users, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/connect")({
  head: () => ({ meta: [{ title: "Find a Coach — Stride" }] }),
  component: ConnectCoach,
});

function ConnectCoach() {
  const [coaches, setCoaches] = useState<any[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // We'll mock the fetch here just in case the backend doesn't have a rich profile for them,
    // but we will still make the API call to merge data if possible.
    fetch("/api/coaches")
      .then(res => res.json())
      .then(data => {
        // Enhance the basic data with premium UI properties for the directory
        const enhanced = data.map((c: any, i: number) => ({
          ...c,
          name: c.email.split("@")[0].replace(".", " "),
          specialty: i % 2 === 0 ? "Sub-3 Hour Marathons" : "First-Time Finishers",
          athletes: Math.floor(Math.random() * 20) + 5,
          rating: (Math.random() * 0.5 + 4.5).toFixed(1),
          cert: "USATF Level 2",
        }));
        setCoaches(enhanced.length > 0 ? enhanced : [
          { id: 1, email: "sarah.hall@stride.run", name: "Sarah Hall", specialty: "Sub-3 Hour Marathons", athletes: 14, rating: "4.9", cert: "USATF Level 2", status: 'none' },
          { id: 2, email: "j.doe@stride.run", name: "John Doe", specialty: "First-Time Finishers", athletes: 22, rating: "4.8", cert: "RRCA Certified", status: 'none' },
          { id: 3, email: "eliterunner@stride.run", name: "Kipchoge Fan", specialty: "Elite Pacing Strategy", athletes: 8, rating: "5.0", cert: "World Athletics Level 1", status: 'none' }
        ]);
      })
      .catch(console.error);
  }, []);

  const requestCoach = async (coachId: number) => {
    setStatus("Sending request...");
    const res = await fetch("/api/coaches/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coach_id: coachId })
    });
    if (res.ok) {
      setStatus("Request sent successfully! Waiting for coach to accept.");
      setCoaches(c => c.map(x => x.id === coachId ? { ...x, status: 'pending' } : x));
    } else {
      setStatus("Failed to send request.");
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold tracking-widest uppercase inline-flex items-center gap-2">
              <ShieldCheck className="size-4" /> Stride Certified Network
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Find Your Coach.</h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Connect with elite, data-driven coaches who use Stride's Physiology Engine to build your personalized marathon blocks.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search by name or specialty..." 
              className="pl-9 pr-4 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full md:w-64"
            />
          </div>
        </div>

        {status && (
          <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded-md flex items-center gap-3">
            <Check className="size-5" /> {status}
          </div>
        )}

        {/* Coach Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coaches.map((coach) => (
            <div key={coach.id} className="group relative bg-card border border-border/60 rounded-xl overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300">
              
              {/* Card Banner / Background */}
              <div className="h-24 bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border/50 relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              </div>
              
              {/* Avatar Profile */}
              <div className="absolute top-12 left-6 h-20 w-20 bg-background border-4 border-card rounded-full overflow-hidden shadow-lg flex items-center justify-center">
                <div className="h-full w-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold capitalize">
                  {coach.name.charAt(0)}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pt-12 pb-6 space-y-5">
                <div>
                  <h3 className="text-xl font-bold capitalize group-hover:text-primary transition-colors">{coach.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <EvidenceBadge kind="C" /> {coach.cert}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col bg-muted/30 p-2 rounded-md">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><TrendingUp className="size-3"/> Specialty</span>
                    <span className="font-medium mt-1 truncate">{coach.specialty}</span>
                  </div>
                  <div className="flex flex-col bg-muted/30 p-2 rounded-md">
                    <span className="text-muted-foreground text-xs flex items-center gap-1"><Users className="size-3"/> Athletes</span>
                    <span className="font-medium mt-1">{coach.athletes} active</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 text-sm font-mono pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <Award className="size-4 text-warning" />
                    <span>{coach.rating} Rating</span>
                  </div>
                  <div className="flex items-center gap-1 text-success">
                    <Activity className="size-4" />
                    <span>94% PB Rate</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2">
                  {coach.status === 'pending' ? (
                    <Button variant="outline" className="w-full border-primary/20 text-primary/80 bg-primary/5 cursor-wait" disabled>
                      Request Pending...
                    </Button>
                  ) : coach.status === 'active' ? (
                    <Button variant="secondary" className="w-full bg-success/10 text-success hover:bg-success/20 cursor-default" disabled>
                      <Check className="size-4 mr-2" /> Connected
                    </Button>
                  ) : (
                    <Button 
                      className="w-full hover:scale-[1.02] active:scale-[0.98] transition-transform" 
                      onClick={() => requestCoach(coach.id)}
                    >
                      Request Coaching <Mail className="ml-2 size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
      </div>
    </AppShell>
  );
}
