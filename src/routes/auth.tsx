import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — Stride" }, { name: "description", content: "Sign in or create your Stride athlete or coach account." },
    { property: "og:title", content: "Sign in — Stride" }, { property: "og:description", content: "Access evidence-aware race planning in Stride." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus("");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) { 
      setStatus("Enter a valid email and a password of at least 8 characters."); 
      setBusy(false); 
      return; 
    }
    
    try {
      let resultError = null;
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role },
          },
        });
        resultError = error;
        
        if (!error) {
          sessionStorage.setItem("stride_role", role);
          localStorage.setItem("stride_pending_role", role);
          if (signUpData?.user) {
            try {
              await supabase.from("user_roles").upsert(
                { user_id: signUpData.user.id, role: role as any },
                { onConflict: "user_id,role" }
              );
            } catch (e) {
              console.warn("Could not insert user_roles immediately:", e);
            }
          }
          if (signUpData?.session) {
            await navigate({ to: "/onboarding" });
            return;
          } else {
            setStatus("Account created! Please check your email to verify your address before logging in.");
            return;
          }
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        resultError = error;
        
        if (!error && signInData?.user) {
          const user = signInData.user;
          
          // 1. Fetch user's registered role from Supabase user_roles table
          const { data: roleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();
            
          let actualRole = roleRow?.['role'] || (user.user_metadata?.['role'] as string) || null;
          
          // Fallback if registered before this fix: default to athlete and backfill user_roles
          if (!actualRole) {
            actualRole = localStorage.getItem("stride_pending_role") || "athlete";
            try {
              await supabase.from("user_roles").upsert(
                { user_id: user.id, role: actualRole as any },
                { onConflict: "user_id,role" }
              );
            } catch (e) {
              console.warn("Could not backfill user_roles:", e);
            }
          }
          
          sessionStorage.setItem("stride_role", actualRole);
          localStorage.setItem("stride_role", actualRole);
          
          // Check onboarding status
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_complete")
            .eq("user_id", user.id)
            .maybeSingle();
            
          let dest = "/app";
          if (!profile || profile.onboarding_complete === false) {
            dest = "/onboarding";
          } else if (actualRole === "admin") {
            dest = "/admin";
          } else if (actualRole === "coach") {
            dest = "/coach";
          } else {
            dest = "/app";
          }
          
          await navigate({ to: dest });
          return;
        }
      }
      
      if (resultError) {
        setStatus(resultError.message || "Authentication failed.");
      }
    } catch (err) {
      setStatus("Failed to connect to authentication service.");
    } finally {
      setBusy(false);
    }
  }
  async function googleSignIn() { setStatus("Google Sign-In is disabled for local DB mode."); }
  return <main className="grid min-h-screen lg:grid-cols-[0.85fr_1.15fr]">
    <section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col"><Link to="/" className="font-mono text-xl font-semibold">STRIDE</Link><div className="my-auto"><Activity className="size-10 text-accent" /><blockquote className="mt-8 max-w-md text-4xl font-semibold leading-tight">“A calm decision is a fast decision.”</blockquote><p className="mt-6 max-w-sm text-sm leading-relaxed text-primary-foreground/65">Your projection, training context, and race plan in one evidence-aware workspace.</p></div><p className="font-mono text-xs text-primary-foreground/50">RACE SYSTEM · 2026</p></section>
    <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md"><Button asChild variant="ghost" className="mb-10 -ml-3"><Link to="/"><ArrowLeft /> Back</Link></Button><p className="font-mono text-xs uppercase text-primary">{mode === "login" ? "Welcome back" : "Create account"}</p><h1 className="mt-2 text-3xl font-semibold">{mode === "login" ? "Continue to Stride" : "Start with a clear baseline"}</h1>{mode === "signup" && <div className="mt-6 space-y-2"><Label className="text-xs uppercase tracking-wider text-muted-foreground">Account Type</Label><div className="grid grid-cols-2 border border-border p-1">{(["athlete", "coach"] as const).map((item) => <Button key={item} type="button" variant={role === item ? "default" : "ghost"} onClick={() => setRole(item)} className="capitalize">{item}</Button>)}</div></div>}<Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={googleSignIn}>Continue with Google</Button><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>{status && <p className="border-l-2 border-primary pl-3 text-sm text-muted-foreground" role="status">{status}</p>}<Button className="h-11 w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</Button></form><button type="button" className="mt-6 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setStatus(""); }}>{mode === "login" ? "New to Stride? Create an account" : "Already have an account? Log in"}</button></div></section>
  </main>;
}