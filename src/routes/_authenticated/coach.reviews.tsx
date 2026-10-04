import { useState, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Check, Pencil, X } from "lucide-react";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/coach/reviews")({
  head: () => ({
    meta: [
      { title: "Review queue — Stride Coach" },
      { name: "description", content: "Compare current and proposed athlete plans before approval." },
      { property: "og:title", content: "Review queue — Stride Coach" },
      { property: "og:description", content: "Human review for AI-proposed training and fueling changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const role = (context as any)?.role || sessionStorage.getItem("stride_role") || "athlete";
    if (role !== "coach" && role !== "admin") {
      throw redirect({ to: "/app" });
    }
  },
  component: Reviews,
});
const changes=[["Tue · Intervals","6 × 1 km @ 4:05","5 × 1 km @ 3:58"],["Thu · Tempo","8 km @ 4:25","10 km @ 4:22"],["Sat · Long run","28 km easy","26 km · final 6 km race pace"],["Race fuel","70 g/h","75 g/h · dual-source"]];
function Reviews() {
  const [status, setStatus] = useState("Awaiting decision");
  const [reason, setReason] = useState("");
  const [prediction, setPrediction] = useState("...");
  
  useEffect(() => {
    fetch('/api/predict/marathon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ split_hhmmss: '01:30:00', age: 30, gender: 'W' })
    })
    .then(res => res.json())
    .then(data => {
      if (data.final_time) {
        setPrediction(data.final_time);
      }
    })
    .catch(console.error);
  }, []);

  return (
    <AppShell>
      <p className="font-mono text-xs uppercase text-primary">Review 01 / 03</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Mara V. · Berlin taper</h1>
          <p className="mt-2 text-sm text-muted-foreground">Proposed after Sunday’s 30 km progression run.</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded bg-muted/50 px-2 py-1 text-xs">
            <span className="font-semibold">ML Prediction:</span>
            <span className="font-mono text-primary">{prediction}</span>
          </div>
        </div>
        <EvidenceBadge kind="P" />
      </div>
      <section className="mt-7 border border-border bg-card shadow-[var(--shadow-panel)]">
        <header className="grid grid-cols-[180px_1fr_1fr] border-b border-border bg-muted/50 font-mono text-[10px] uppercase text-muted-foreground">
          <span className="p-4">Plan item</span>
          <span className="border-l border-border p-4">Current</span>
          <span className="border-l border-border p-4">AI proposal</span>
        </header>
        {changes.map(([label, current, proposal]) => (
          <div key={label} className="grid grid-cols-[180px_1fr_1fr] border-b border-border last:border-b-0 text-sm">
            <b className="p-4">{label}</b>
            <span className="border-l border-border p-4 text-muted-foreground">{current}</span>
            <span className="border-l border-border bg-success-soft/35 p-4 font-medium">{proposal}</span>
          </div>
        ))}
      </section>
      <section className="mt-5 border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setStatus("Approved")}><Check />Approve</Button>
          <Button variant="outline" onClick={() => setStatus("Editing draft")}><Pencil />Edit</Button>
          <Input value={reason} onChange={e => setReason(e.target.value.slice(0, 240))} maxLength={240} placeholder="Reason for rejection" className="min-w-[240px] flex-1" />
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => setStatus("Rejected with reason")}><X />Reject</Button>
        </div>
        <p className="mt-4 font-mono text-xs text-muted-foreground" role="status">STATUS · {status}</p>
      </section>
    </AppShell>
  );
}