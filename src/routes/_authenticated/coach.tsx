import React, { useState, useEffect, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { ArrowRight, ChevronDown, ChevronUp, Check, X, Activity, Save } from "lucide-react";

export const Route=createFileRoute("/_authenticated/coach")({
  head:()=>({meta:[{title:"Roster — Stride Coach"}]}),
  component:Coach
});

function AthleteDetails({ athlete }: { athlete: any }) {
  const [planText, setPlanText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/coaches/athlete/${athlete.athlete_id}/plan`)
      .then(res => res.json())
      .then(data => setPlanText(data.plan_text || ""));
  }, [athlete.athlete_id]);

  const savePlan = async () => {
    setSaving(true);
    const res = await fetch(`/api/coaches/athlete/${athlete.athlete_id}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_text: planText })
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="bg-muted/10 p-6 border-b border-border border-t border-border/50 animate-in fade-in slide-in-from-top-2">
      <div className="grid xl:grid-cols-2 gap-8">
        
        {/* Vitals & AI Panel */}
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Activity className="size-4 text-primary"/> Physiological Vitals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Resting HR</p>
                <p className="text-2xl font-mono">42 <span className="text-sm text-muted-foreground">bpm</span></p>
              </div>
              <div className="bg-card p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-1">HRV Baseline</p>
                <p className="text-2xl font-mono text-success">86 <span className="text-sm text-muted-foreground">ms</span></p>
              </div>
              <div className="bg-card p-4 border border-border col-span-2">
                <p className="text-xs text-muted-foreground mb-3">Training Load Trend</p>
                <svg viewBox="0 0 260 40" className="h-10 w-full">
                  <path d="M0 30 C20 28 40 35 60 20 S90 25 120 10 S150 15 180 5 S220 8 260 2" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M0 30 C20 28 40 35 60 20 S90 25 120 10 S150 15 180 5 S220 8 260 2 L260 40 L0 40Z" fill="color-mix(in oklab, var(--primary) 15%, transparent)"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Model Diagnostics</h3>
            <div className="bg-card p-5 border border-border">
              <div>
                <p className="text-sm text-muted-foreground mb-2">AI Projected Marathon</p>
                <p className="text-4xl font-mono font-semibold">3:18:45</p>
                <p className="text-xs text-success mt-2">Top 12% in Age Category</p>
              </div>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 text-sm gap-2">
                <div><span className="text-muted-foreground block text-xs">Fatigue Risk</span><span className="font-mono text-warning">Medium (42%)</span></div>
                <div><span className="text-muted-foreground block text-xs">Fuel Adherence</span><span className="font-mono text-success">Excellent</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Training Block Manager */}
        <div className="space-y-4 flex flex-col">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-widest">Manage Training Block</h3>
          <div className="flex-1 bg-card border border-border flex flex-col">
            <textarea 
              value={planText} 
              onChange={e => setPlanText(e.target.value)}
              placeholder="e.g. Monday: 8km Easy @ 5:30/km&#10;Tuesday: 6x1000m Intervals..." 
              className="flex-1 w-full p-4 bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm leading-relaxed"
            />
            <div className="border-t border-border p-3 bg-muted/30 flex justify-between items-center">
              <span className="text-xs text-muted-foreground flex items-center gap-2">
                <EvidenceBadge kind="C" /> Synced to Athlete App
              </span>
              <Button size="sm" onClick={savePlan} disabled={saving}>
                {saved ? <><Check className="mr-2 size-4"/> Saved</> : <><Save className="mr-2 size-4"/> Save Plan</>}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Coach(){
  const [roster, setRoster] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  
  const fetchDashboard = () => {
    fetch('/api/coaches/dashboard')
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          setRoster(data.roster);
          setPending(data.pending);
        }
      });
  };

  useEffect(() => { fetchDashboard(); }, []);

  const respondRequest = async (connectionId: number, action: 'accept' | 'reject') => {
    await fetch('/api/coaches/respond', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connection_id: connectionId, action })
    });
    fetchDashboard();
  };

  return <AppShell>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-xs uppercase text-primary">{roster.length} active athletes</p>
        <h1 className="mt-2 text-3xl font-semibold">Roster Management</h1>
      </div>
      <Button asChild><Link to="/coach/reviews">Open review queue <ArrowRight className="ml-2 size-4" /></Link></Button>
    </div>

    {pending.length > 0 && (
      <div className="mt-8 border border-warning bg-warning-soft p-5 shadow-sm">
        <h2 className="font-semibold text-warning text-sm uppercase tracking-wider mb-4">Pending Requests ({pending.length})</h2>
        <div className="space-y-3">
          {pending.map(req => (
            <div key={req.id} className="flex justify-between items-center bg-card p-4 border border-border">
              <div>
                <span className="font-mono text-sm">{req.athlete_email}</span>
                <p className="text-xs text-muted-foreground mt-1">Requested to join your roster</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive-soft border-destructive-soft" onClick={() => respondRequest(req.id, 'reject')}><X className="size-4 mr-1"/> Reject</Button>
                <Button size="sm" onClick={() => respondRequest(req.id, 'accept')}><Check className="size-4 mr-1"/> Accept</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="mt-7 border border-border bg-card">
      <table className="w-full text-left">
        <thead className="border-b border-border bg-muted/60 font-mono text-[10px] uppercase text-muted-foreground">
          <tr><th className="p-4">Athlete Email</th><th className="p-4">Data freshness</th><th className="p-4">Evidence</th><th className="p-4"></th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {roster.length === 0 && <tr><td colSpan={4} className="p-6 text-muted-foreground text-center font-mono text-sm">No active athletes in roster.</td></tr>}
          {roster.map((athlete) => (
            <Fragment key={athlete.id}>
              <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === athlete.id ? null : athlete.id)}>
                <td className="p-4"><b className="text-sm">{athlete.athlete_email}</b></td>
                <td className="p-4"><span className="rounded-sm px-2 py-1 text-xs bg-success-soft text-success border border-success/20">Live API</span></td>
                <td className="p-4"><EvidenceBadge kind="V"/></td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="icon">{expanded === athlete.id ? <ChevronUp /> : <ChevronDown />}</Button>
                </td>
              </tr>
              {expanded === athlete.id && (
                <tr>
                  <td colSpan={4} className="p-0 border-t-0">
                    <AthleteDetails athlete={athlete} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  </AppShell>;
}