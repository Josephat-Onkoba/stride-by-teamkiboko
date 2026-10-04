import { cn } from "@/lib/utils";

type EvidenceKind = "V" | "P" | "C";

const labels: Record<EvidenceKind, string> = {
  V: "Validated",
  P: "Planned",
  C: "Context",
};

export function EvidenceBadge({ kind = "V", className }: { kind?: EvidenceKind; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-sm border border-current/20 bg-current/5 px-1.5 font-mono text-[10px] font-semibold uppercase text-muted-foreground", className)} title={labels[kind]}>
      [{kind}] {labels[kind]}
    </span>
  );
}