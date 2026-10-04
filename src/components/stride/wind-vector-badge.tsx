import React from "react";
import { Compass, Wind, ArrowDown, ArrowUp, ArrowRight } from "lucide-react";

export interface WindVectorBadgeProps {
  windSpeedMps: number;
  windDirectionDeg: number;
  courseHeadingDeg: number;
  compact?: boolean;
}

export function WindVectorBadge({
  windSpeedMps = 2.5,
  windDirectionDeg = 90,
  courseHeadingDeg = 90,
  compact = false,
}: WindVectorBadgeProps) {
  // Angular difference between wind direction and course direction
  const relAngleDeg = ((windDirectionDeg - courseHeadingDeg) % 360 + 360) % 360;
  const relRad = (relAngleDeg * Math.PI) / 180;

  // Headwind: positive = directly in runner's face, negative = assisting tailwind
  const headwindMps = Math.round(windSpeedMps * Math.cos(relRad) * 10) / 10;
  const crosswindMps = Math.round(Math.abs(windSpeedMps * Math.sin(relRad)) * 10) / 10;

  const isHeadwind = headwindMps > 0.5;
  const isTailwind = headwindMps < -0.5;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded border border-border/60 bg-muted/20 px-2.5 py-1">
        <Wind className="size-3.5 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold">
          {isHeadwind ? (
            <span className="text-warning flex items-center gap-0.5">
              <ArrowUp className="size-3" /> +{headwindMps} m/s Headwind
            </span>
          ) : isTailwind ? (
            <span className="text-success flex items-center gap-0.5">
              <ArrowDown className="size-3" /> {Math.abs(headwindMps)} m/s Tailwind
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-0.5">
              <ArrowRight className="size-3" /> {crosswindMps} m/s Crosswind
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5">
          <Compass className="size-4 text-primary" />
          <span className="font-mono text-xs font-semibold uppercase text-muted-foreground">
            Course-Relative Wind Vector
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          Course Heading: {Math.round(courseHeadingDeg)}°
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        {/* Visual Wind Compass */}
        <div className="relative flex size-12 items-center justify-center rounded-full border border-border/80 bg-muted/30">
          <div className="absolute top-1 text-[8px] font-mono text-muted-foreground">N</div>
          <div
            className="flex items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${relAngleDeg}deg)` }}
            title={`Wind Angle: ${Math.round(relAngleDeg)}° relative to runner`}
          >
            <ArrowUp className={`size-6 ${isHeadwind ? "text-destructive" : isTailwind ? "text-success" : "text-primary"}`} />
          </div>
        </div>

        {/* Vector Metrics */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Apparent Headwind:</span>
            <span className={`font-semibold ${isHeadwind ? "text-destructive" : isTailwind ? "text-success" : "text-foreground"}`}>
              {headwindMps > 0 ? `+${headwindMps}` : headwindMps} m/s
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Lateral Crosswind:</span>
            <span className="font-semibold text-muted-foreground">{crosswindMps} m/s</span>
          </div>

          <div className="pt-1">
            {isHeadwind ? (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-destructive uppercase">
                Aerodynamic Drag Penalty
              </span>
            ) : isTailwind ? (
              <span className="rounded bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success uppercase">
                Aerodynamic Assist
              </span>
            ) : (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                Neutral Air Velocity
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
