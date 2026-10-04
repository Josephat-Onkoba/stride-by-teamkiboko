import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { EvidenceBadge } from "./evidence-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function parseTime(value: string) {
  const parts = value.split(":").map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) return 5400;
  const hours = parts[0] ?? 1;
  const minutes = parts[1] ?? 30;
  return Math.max(1800, Math.min(10800, hours * 3600 + minutes * 60));
}

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SplitBoard() {
  const [halfTime, setHalfTime] = useState("1:24");
  const [age, setAge] = useState(31);
  const [category, setCategory] = useState("open");
  const projection = useMemo(() => {
    const seconds = parseTime(halfTime);
    const ageAdjustment = Math.max(0, age - 35) * 0.0008;
    const categoryAdjustment = category === "female" ? 0.012 : 0;
    return seconds * 2.07 * (1 + ageAdjustment + categoryAdjustment);
  }, [halfTime, age, category]);

  return (
    <section className="border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-7" aria-label="Marathon projection calculator">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase text-muted-foreground">Split board · 21.1 km input</p>
          <h2 className="mt-1 text-xl font-semibold text-card-foreground">Project your marathon</h2>
        </div>
        <EvidenceBadge kind="V" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="half-time">Half marathon time</Label>
          <Input id="half-time" value={halfTime} onChange={(event) => setHalfTime(event.target.value.slice(0, 5))} placeholder="1:24" inputMode="numeric" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input id="age" type="number" min={16} max={100} value={age} onChange={(event) => setAge(Math.max(16, Math.min(100, Number(event.target.value) || 16)))} />
        </div>
        <div className="space-y-2">
          <Label>Gender category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Predicted finish <EvidenceBadge kind="P" /></div>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-normal text-foreground sm:text-6xl">{formatTime(projection)}</p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">Typical error ± 06:40</p>
        </div>
        <a href="#science" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
          <Info className="size-4" /> How is this calculated?
        </a>
      </div>
    </section>
  );
}