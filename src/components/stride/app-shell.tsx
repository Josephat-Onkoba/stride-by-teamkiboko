import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, ClipboardCheck, CloudOff, Dumbbell, FlaskConical, LayoutDashboard, LogOut, Menu, Users, ShieldAlert, UserPlus, Watch } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const athleteNav = [["/app", "Today", LayoutDashboard], ["/train", "Train", Dumbbell], ["/fuel", "Fuel lab", FlaskConical], ["/race-plans", "Race plans", Activity], ["/connect", "Find a Coach", UserPlus], ["/devices", "Devices", Watch]] as const;
const coachNav = [["/coach", "Roster", Users], ["/coach/reviews", "Review queue", ClipboardCheck]] as const;
const adminNav = [["/admin", "System Config", ShieldAlert]] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const role = typeof window !== "undefined" ? (sessionStorage.getItem("stride_role") || localStorage.getItem("stride_role") || "athlete") : "athlete";
  const nav = role === "admin" ? adminNav : role === "coach" ? coachNav : athleteNav;
  async function signOut() { 
    await queryClient.cancelQueries(); 
    queryClient.clear(); 
    sessionStorage.removeItem("stride_role");
    localStorage.removeItem("stride_role");
    localStorage.removeItem("stride_pending_role");
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true }); 
  }
  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[220px_1fr]">
    <aside className="hidden border-r border-border bg-card lg:flex lg:flex-col lg:p-4"><Link to="/" className="flex items-center gap-2 px-2 py-3 font-mono text-xl font-semibold"><span className="inline-flex size-7 items-center justify-center bg-primary text-primary-foreground">S</span> STRIDE</Link><p className="mt-8 px-2 font-mono text-[10px] uppercase text-muted-foreground">{role === "admin" ? "Admin Workspace" : role === "coach" ? "Coach workspace" : "Athlete workspace"}</p><nav className="mt-3 space-y-1">{nav.map(([to, label, Icon]) => <Button key={to} asChild variant={location.pathname === to ? "secondary" : "ghost"} className="w-full justify-start"><Link to={to}><Icon />{label}</Link></Button>)}</nav><div className="mt-auto"><div className="mb-3 flex items-center gap-2 border border-border bg-success-soft p-2 text-xs text-success"><CloudOff className="size-4" />Race plan synced offline</div><Button variant="ghost" className="w-full justify-start" onClick={signOut}><LogOut /> Sign out</Button></div></aside>
    <div><header className="flex h-16 items-center border-b border-border bg-card px-4 lg:px-7"><Button size="icon" variant="ghost" className="lg:hidden" aria-label="Open menu"><Menu /></Button><div className="ml-2 lg:ml-0"><p className="text-sm font-semibold">{role === "admin" ? "System Administration" : role === "coach" ? "Coach workspace" : "Performance workspace"}</p><p className="font-mono text-[10px] text-muted-foreground">Synced 08:42 UTC</p></div><span className="ml-auto rounded-sm bg-success-soft px-2 py-1 text-[11px] font-semibold text-success">SYSTEM READY</span></header><main className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">{children}</main><nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card lg:hidden" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>{nav.map(([to, label, Icon]) => <Link key={to} to={to} className={`flex h-16 flex-col items-center justify-center gap-1 text-[10px] ${location.pathname === to ? "text-primary" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</Link>)}</nav></div>
  </div>;
}