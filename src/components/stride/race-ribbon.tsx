import { CloudOff, Droplets, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "./evidence-badge";

const splits = [
  ["Start", "—", "Settle · 5:00/km"],
  ["5 km", "0:25", "Gel 01 · 25 g"],
  ["10 km", "0:50", "Water · 180 ml"],
  ["15 km", "1:15", "Gel 02 · 25 g"],
  ["21.1", "1:45", "Hold · 4:58/km"],
  ["25 km", "2:05", "Gel 03 + water"],
  ["30 km", "2:30", "Caffeine · 25 g"],
  ["35 km", "2:55", "Commit · 4:55/km"],
  ["40 km", "3:20", "Final water"],
  ["Finish", "3:31", "Empty the tank"],
];

export function RaceRibbon() {
  return (
    <section className="border border-border bg-card shadow-[var(--shadow-panel)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">Berlin · Race Ribbon</h2><EvidenceBadge kind="P" /></div>
          <p className="mt-1 text-xs text-muted-foreground">Target 3:31:00 · 75 g carbs/hour</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-success-soft px-2 py-1 text-[11px] font-semibold text-success"><CloudOff className="size-3" /> Available offline</span>
          <Button variant="outline" size="icon" aria-label="Print race ribbon" title="Print race ribbon" onClick={() => window.print()}><Printer /></Button>
        </div>
      </header>
      <div className="overflow-x-auto p-5">
        <div className="flex min-w-[900px] border-y border-foreground">
          {splits.map(([distance, time, action], index) => (
            <div key={distance} className="relative min-w-[108px] flex-1 border-r border-border px-2 py-3 last:border-r-0">
              {index > 0 && index < 9 ? <span className="absolute -top-1 left-0 h-2 w-px bg-foreground" /> : null}
              <p className="font-mono text-[10px] uppercase text-muted-foreground">{distance}</p>
              <p className="mt-1 font-mono text-lg font-semibold">{time}</p>
              <p className="mt-3 flex items-start gap-1 text-[11px] leading-tight text-muted-foreground"><Droplets className="mt-0.5 size-3 shrink-0 text-primary" />{action}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}