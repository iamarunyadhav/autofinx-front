import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/api-base";

type Entry = { id: string; title: string; kind: string; status: string; evidence_level: string | null; created_at: string; payload: Record<string, unknown> };
type Status = { enabled: boolean; cadence_minutes: number; safety: Record<string, unknown>; cost: Record<string, unknown>; runs: { id: string; status: string; created_at: string; error_code: string | null; summary: Record<string, unknown> | null }[]; sources: { key: string; url: string; enabled: boolean; refresh_minutes: number }[] };
const tabs: Record<string, string> = { Overview: "capability", Observer: "observation", "Data Sources": "source", Research: "candidate", Discoveries: "candidate", "Opportunity Lab": "candidate", "Strategy Lab": "candidate", Experiments: "experiment", Recommendations: "candidate", Knowledge: "capability", "Model Lab": "experiment", Reports: "daily-report", "Weekly Report": "weekly-report", Cost: "capability", Safety: "capability" };

function Details({ value }: { value: unknown }) {
  return <pre className="whitespace-pre-wrap break-words text-xs max-h-96 overflow-auto rounded bg-muted p-3">{JSON.stringify(value, null, 2)}</pre>;
}

export default function NexusPage() {
  const { currentWorkspace } = useWorkspace();
  return <AppShell>{currentWorkspace ? <NexusWorkspace key={currentWorkspace.id} workspace={currentWorkspace.id} /> : <p className="p-6">Select a workspace to open Nexus.</p>}</AppShell>;
}

function NexusWorkspace({ workspace }: { workspace: string }) {
  const client = useQueryClient();
  const [tab, setTab] = useState("Overview");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [exchange, setExchange] = useState("binance_futures");
  const [timeframe, setTimeframe] = useState("1m");
  const [horizon, setHorizon] = useState(60);
  const [cost, setCost] = useState(12);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const base = `/workspaces/${workspace}/nexus`;
  const status = useQuery({ queryKey: ["nexus", workspace, "status"], queryFn: async () => (await api.get<Status>(base)).data, refetchInterval: 30000, refetchIntervalInBackground: false });
  const entries = useQuery({ queryKey: ["nexus", workspace, tabs[tab], page], queryFn: async () => (await api.get<{ data: Entry[]; last_page: number }>(`${base}/entries`, { params: { kind: tabs[tab], page } })).data, enabled: status.isSuccess, refetchInterval: 30000, refetchIntervalInBackground: false });
  const action = useMutation({ mutationFn: async ({ path, body }: { path: string; body?: unknown }) => api.post(`${base}${path}`, body), onSuccess: () => { setError(""); void client.invalidateQueries({ queryKey: ["nexus", workspace] }); }, onError: (e: Error) => setError(e.message) });
  const download = async (format: string, candidate?: string) => {
    try {
      const params = new URLSearchParams({ format });
      if (candidate) params.set("candidate_id", candidate);
      const response = await fetch(`${getApiBaseUrl().replace(/\/$/, "")}${base}/export?${params}`, { headers: await authHeaders() });
      if (!response.ok) throw new Error("Export failed. Check workspace access and candidate approval.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `nexus.${format === "markdown" ? "md" : format}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
  };
  const data = status.data;
  const records = (entries.data?.data ?? []).filter(e => `${e.title} ${e.status} ${e.evidence_level} ${String(e.payload.market ?? "")} ${String(e.payload.type ?? "")}`.toLowerCase().includes(filter.toLowerCase()))
    .filter(e => tab !== "Strategy Lab" || e.payload.type === "NEW_STRATEGY");
  return <main className="p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Nexus Research</h1><p className="text-sm text-muted-foreground">Observe · Discover · Experiment · Review</p></div>
      <div className="flex gap-2"><Badge variant="outline">15-minute cycle</Badge><Button disabled={!data?.enabled || action.isPending} onClick={() => action.mutate({ path: "/run" })}>Run cycle</Button></div></div>
    {(error || status.error || entries.error) && <div role="alert" className="border border-destructive rounded p-3">{error || status.error?.message || entries.error?.message}<Button variant="ghost" onClick={() => { void status.refetch(); void entries.refetch(); }}>Retry</Button></div>}
    {status.isLoading && <p>Loading Nexus…</p>}
    {data && !data.enabled && <p className="rounded border p-3">Nexus is disabled in server configuration. Research history remains available.</p>}
    <nav aria-label="Nexus sections" className="flex flex-wrap gap-2">{Object.keys(tabs).map(name => <Button key={name} size="sm" variant={tab === name ? "default" : "outline"} onClick={() => { setTab(name); setPage(1); setFilter(""); }}>{name}</Button>)}</nav>
    {tab === "Overview" && <Card><CardHeader><CardTitle>Recent cycles</CardTitle></CardHeader><CardContent className="space-y-3">{!data?.runs.length && <p>No runs yet. Start the server worker and request a cycle.</p>}{data?.runs.map(run => <div key={run.id} className="rounded border p-3"><div className="flex gap-3"><Badge variant="outline">{run.status}</Badge><span>{new Date(run.created_at).toLocaleString()}</span></div>{run.error_code && <p>{run.error_code}</p>}{run.summary && <Details value={run.summary} />}</div>)}</CardContent></Card>}
    {tab === "Safety" && <><p>Owner/admin approval records a research decision. Code writing, deployment, risk overrides and live trading are unavailable to Nexus.</p><Details value={data?.safety} /></>}
    {tab === "Cost" && <><p>Reservations are conservative spending bounds. Provider invoices may differ. Limits are shared across workspaces.</p><Details value={data?.cost} /></>}
    {tab === "Data Sources" && <Card><CardHeader><CardTitle>Configured sources</CardTitle></CardHeader><CardContent>{data?.sources.map(s => <p key={s.key}>{s.key} · every {s.refresh_minutes} minutes · {s.enabled ? "enabled" : "disabled"}</p>)}<p className="mt-3 text-sm text-muted-foreground">Unconfigured broker/news feeds require an adapter and credentials. Source contents are evidence, never agent instructions.</p></CardContent></Card>}
    {tab === "Model Lab" && <p>Model research is advisory. These experiments evaluate the existing forecast on historical candles; model training and live promotion are not enabled.</p>}
    {["Reports", "Weekly Report", "Knowledge"].includes(tab) && <div className="flex gap-2">{["json", "markdown", "pdf"].map(format => <Button key={format} variant="outline" onClick={() => void download(format)}>Export latest {format}</Button>)}</div>}
    {!["Safety", "Cost"].includes(tab) && <>
      <Input aria-label="Filter current page" placeholder="Filter this page by title, market, status, evidence or type" value={filter} onChange={e => setFilter(e.target.value)} />
      {entries.isLoading && <p>Loading records…</p>}
      {!entries.isLoading && records.length === 0 && <p className="text-muted-foreground">No matching records on this page.</p>}
      {records.map(entry => <Card key={entry.id}><CardHeader><div className="flex flex-wrap gap-2"><Badge variant="outline">{entry.status}</Badge>{entry.evidence_level && <Badge variant="outline">Evidence {entry.evidence_level}</Badge>}<span className="text-xs text-muted-foreground">{String(entry.payload.origin ?? entry.kind)}</span></div><CardTitle className="text-lg">{entry.title}</CardTitle></CardHeader><CardContent className="space-y-3">
        {entry.payload.idea && <p>{String(entry.payload.idea)}</p>}{entry.payload.data_required && <p className="text-sm">Required: {String(entry.payload.data_required)}</p>}
        <details><summary className="cursor-pointer">Evidence, requirements and limitations</summary><Details value={entry.payload} /></details>
        {entry.kind === "candidate" && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setSelected(entry); setReason(""); }}>Review / experiment</Button>{entry.status === "APPROVED" && <Button onClick={() => void download("markdown", entry.id)}>Export build package</Button>}</div>}
      </CardContent></Card>)}
      <div className="flex items-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page} / {entries.data?.last_page ?? 1}</span><Button variant="outline" disabled={page >= (entries.data?.last_page ?? 1)} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </>}
    {selected && <Card><CardHeader><CardTitle>Review: {selected.title}</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input aria-label="Review reason" placeholder="Reason for approval or rejection" value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex gap-2">{["APPROVED", "REJECTED"].map(value => <Button key={value} disabled={action.isPending || reason.trim().length < 3} onClick={() => action.mutate({ path: `/candidates/${selected.id}/review`, body: { action: value, reason } })}>{value === "APPROVED" ? "Approve proposal" : "Reject"}</Button>)}<Button variant="ghost" onClick={() => setSelected(null)}>Close</Button></div>
      <p className="text-sm">Optional forecast proxy experiment. This evaluates the existing forecast, not the proposed strategy. Select a historical window of 160–1000 stored candles. All times below are UTC.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label>Symbol<Input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} /></label>
        <label>Market<select className="block w-full border rounded p-2 bg-background" value={exchange} onChange={e => setExchange(e.target.value)}><option value="binance">Binance spot</option><option value="binance_futures">Binance futures</option></select></label>
        <label>Timeframe<select className="block w-full border rounded p-2 bg-background" value={timeframe} onChange={e => setTimeframe(e.target.value)}>{["1m", "5m", "15m", "1h"].map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Horizon seconds<Input type="number" min={60} max={3600} value={horizon} onChange={e => setHorizon(Number(e.target.value))} /></label>
        <label>From UTC<Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To UTC<Input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></label>
        <label>Total round-trip cost (bps)<Input type="number" min={0.1} step={0.1} value={cost} onChange={e => setCost(Number(e.target.value))} /></label>
      </div>
      <Button disabled={!data?.enabled || action.isPending || !from || !to} onClick={() => action.mutate({ path: "/experiments", body: { candidate_id: selected.id, symbol, exchange, timeframe, horizon_seconds: horizon, from: `${from}:00Z`, to: `${to}:00Z`, round_trip_cost_bps: cost } })}>Queue forecast experiment</Button>
    </CardContent></Card>}
  </main>;
}
