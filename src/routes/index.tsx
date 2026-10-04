import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Database, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/stride/evidence-badge";
import { SplitBoard } from "@/components/stride/split-board";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Stride — Evidence-aware marathon planning" },
    { name: "description", content: "Project marathon performance and build evidence-aware pacing, training, and fueling plans." },
    { property: "og:title", content: "Stride — Evidence-aware marathon planning" },
    { property: "og:description", content: "Decision support for professional distance runners and coaches." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});

const athletes = [
  ["Case 0142", "2:51 → 2:47", "68 km/week", "Matched 94%"],
  ["Case 0781", "3:12 → 3:06", "81 km/week", "Matched 91%"],
  ["Case 1034", "3:38 → 3:29", "54 km/week", "Matched 88%"],
];

function FuelGap() {
  return (
    <div className="border border-border bg-card p-5 shadow-[var(--shadow-panel)] sm:p-7">
      <div className="flex items-start justify-between"><div><p className="font-mono text-[11px] uppercase text-muted-foreground">Fuel gap model</p><h2 className="mt-1 text-xl font-semibold">Energy availability over 42.2 km</h2></div><EvidenceBadge kind="V" /></div>
      <div className="relative mt-8 h-56 border-l border-b border-border">
        <div className="absolute left-0 right-0 top-[22%] border-t-2 border-dashed border-warning"><span className="absolute right-0 -top-6 bg-warning-soft px-2 py-1 font-mono text-[10px] text-warning">90 g/h ceiling</span></div>
        <svg viewBox="0 0 700 220" className="absolute inset-0 h-full w-full" role="img" aria-label="Glycogen falls through a marathon while carbohydrate intake partially replenishes it">
          <path d="M0 15 C110 28 150 54 230 78 S390 130 470 155 S610 197 700 211" fill="none" stroke="var(--foreground)" strokeWidth="3" />
          <path d="M0 16 C110 31 145 52 205 69 L230 40 C290 70 340 95 395 108 L425 77 C500 112 550 140 590 153 L620 126 C650 150 675 168 700 180 L700 220 L0 220Z" fill="color-mix(in oklab, var(--primary) 13%, transparent)" stroke="var(--primary)" strokeWidth="3" />
        </svg>
        <span className="absolute bottom-2 left-3 text-xs text-muted-foreground">Start</span><span className="absolute bottom-2 right-3 text-xs text-muted-foreground">Finish</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-foreground" /> No intake</span><span className="flex items-center gap-2"><i className="h-0.5 w-5 bg-primary" /> Planned intake</span></div>
    </div>
  );
}

function Home() {
  return <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
        <Link to="/" className="mr-auto flex items-center gap-2 font-mono text-xl font-semibold"><span className="inline-flex size-7 items-center justify-center bg-primary text-primary-foreground">S</span> STRIDE</Link>
        <nav className="hidden items-center gap-6 text-sm lg:flex"><a href="#how">How it works</a><a href="#science">Science</a><a href="#privacy">Data and privacy</a></nav>
        <Button variant="ghost" asChild className="ml-2"><Link to="/auth">Log in</Link></Button>
        <Button asChild><a href="#project">Project my marathon</a></Button>
      </div>
    </header>
    <main>
      <section id="project" className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:pb-24 lg:pt-20">
        <div><p className="font-mono text-xs uppercase text-primary">Decision support for distance running</p><h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.02] sm:text-6xl">Know what the evidence supports.</h1><p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">Turn your training, physiology, and race conditions into a clear projection—with uncertainty kept visible.</p><div className="mt-8 flex items-center gap-3"><EvidenceBadge kind="V" /><span className="text-xs text-muted-foreground">No black-box certainty. Every output carries its evidence state.</span></div></div>
        <SplitBoard />
      </section>
      <section id="how" className="border-y border-border bg-secondary/45"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2"><FuelGap /><div className="flex flex-col justify-center px-2 lg:px-10"><p className="font-mono text-xs uppercase text-primary">Plan the whole race</p><h2 className="mt-3 text-3xl font-semibold">Pace is only half the equation.</h2><p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">Stride models the fuel gap against your pace target and keeps every recommendation below the practical absorption ceiling.</p><Button asChild variant="outline" className="mt-7 w-fit"><Link to="/auth">Build a fueling plan <ArrowRight /></Link></Button></div></div></section>
      <section id="science" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase text-primary">Runners like you</p><h2 className="mt-2 text-3xl font-semibold">Comparable, not generic.</h2></div><EvidenceBadge kind="C" /></div><div className="grid gap-4 md:grid-cols-3">{athletes.map(([id, result, volume, match]) => <article key={id} className="border border-border bg-card p-5"><p className="font-mono text-xs text-muted-foreground">{id}</p><p className="mt-5 font-mono text-2xl font-semibold">{result}</p><div className="mt-5 flex justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>{volume}</span><span>{match}</span></div></article>)}</div></section>
      <section id="privacy" className="border-y border-border bg-primary text-primary-foreground"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-center"><div><p className="font-mono text-[11px] uppercase text-primary-foreground/65">Trust band</p><h2 className="mt-2 text-2xl font-semibold">Built to be inspected.</h2><p className="mt-2 max-w-2xl text-sm text-primary-foreground/70">Published methods, open datasets, granular consent, and visible uncertainty—not unexplained scores.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary"><BookOpen /> Research</Button><Button variant="secondary"><Database /> Open datasets</Button><Button variant="secondary"><ShieldCheck /> Privacy</Button></div></div></section>
    </main>
    <footer className="mx-auto flex max-w-7xl items-center justify-between px-4 py-8 text-xs text-muted-foreground sm:px-6"><span>© 2026 Stride</span><span className="font-mono">Evidence before certainty.</span></footer>
  </div>;
}