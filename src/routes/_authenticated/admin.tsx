import { useState, useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/stride/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Stride" }] }),
  beforeLoad: async ({ context }) => {
    const role = (context as any)?.role || sessionStorage.getItem("stride_role") || "athlete";
    if (role !== "admin") {
      throw redirect({ to: "/app" });
    }
  },
  component: Admin,
});

function Admin() {
  const [modelUrl, setModelUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/config")
      .then(r => r.json())
      .then(data => {
        if(data.hf_model_url) setModelUrl(data.hf_model_url);
        if(data.hf_api_key) setApiKey(data.hf_api_key);
        setLoading(false);
      });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Saving...");
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hf_model_url: modelUrl, hf_api_key: apiKey })
    });
    setStatus("Configuration synced to Python Backend successfully.");
  };

  if (loading) return <AppShell><p>Loading...</p></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl">
        <p className="font-mono text-xs uppercase text-primary">System Settings</p>
        <h1 className="mt-2 text-3xl font-semibold">Admin Workspace</h1>
        
        <form onSubmit={save} className="mt-8 space-y-6 border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="text-warning" />
            <h2 className="text-xl font-semibold">Hugging Face ML Models</h2>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Configure the AI inference endpoints for the marathon prediction and training adaptation modules. 
            This configuration is saved directly to the Python Microservice Database.
          </p>
          
          <div className="space-y-2">
            <Label>Inference Endpoint URL</Label>
            <Input 
              value={modelUrl} 
              onChange={e => setModelUrl(e.target.value)} 
              placeholder="https://api-inference.huggingface.co/models/..." 
            />
          </div>
          <div className="space-y-2">
            <Label>Bearer Token (API Key)</Label>
            <Input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="hf_..." 
            />
          </div>
          <div className="pt-2">
            <Button type="submit">Save AI Configuration</Button>
          </div>
          
          {status && (
            <p className="mt-4 border-l-2 border-primary pl-3 text-sm text-success">{status}</p>
          )}
        </form>
      </div>
    </AppShell>
  );
}
