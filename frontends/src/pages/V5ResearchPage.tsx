import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";
import { api, authorizedFetch } from "@/lib/api";

type Candidate = {
  symbol: string;
  rank: number;
  ranking_score: number;
  execution_authorized: boolean;
  research_status?: string;
};
type Selection = {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  status: string;
  selected_at: string;
  selection_price: number;
};
type Metric = {
  selection_id: string;
  symbol: string;
  side: string;
  return_since_selection: number | null;
  estimated_after_cost_return: number | null;
  cost_status: string;
  history: { at: string; return: number }[];
};
type RankingSnapshot = {
  as_of: string;
  rows: {
    symbol: string;
    current_rank: number | null;
    previous_rank: number | null;
    rank_movement: number | null;
    new_entrant?: boolean;
    removed?: boolean;
  }[];
};
type KnowledgeItem = { id: string; title: string; status: string; evidence_level?: string; payload?: { category?: string; content?: string; source_type?: string; source_url?: string | null; verification?: Record<string, string>; training_eligible?: boolean } };
type KnowledgeExperiment = { id: string; title: string; category: string; status: string; paper_track: string; training_eligible: boolean; execution_authorized: boolean; paper_trades: unknown[]; note: string };

type DecisionDiagnostics = {
  sample_count: number;
  counts: Record<string, number>;
  failure_buckets?: Record<string, number>;
  rates_pct: Record<string, number>;
  directional_rate_pct: number;
  wait_like_rate_pct: number | null;
  alert: string | null;
  meaning: string;
};
type ShadowHistoryItem = {
  anchor_time_ms: number;
  decision: string;
  decision_reason: string;
  prediction_status: string;
  decision_status: string;
};

type ShadowResearchPayload = {
  status: string;
  horizon_minutes?: number | null;
  model?: { model_version: string | null; status: string; calibration?: { state: string }; holdout_samples?: number } | null;
  prediction?: {
    decision: "BUY" | "SELL" | "WAIT";
    decision_status?: string;
    decision_reason?: string | null;
    p_buy?: number | null;
    p_sell?: number | null;
    buy_net_pct?: number | null;
    sell_net_pct?: number | null;
  };
  decision_diagnostics?: DecisionDiagnostics;
};

function ReturnChart({ points }: { points: { at: string; return: number }[] }) {
  const width = 420;
  const height = 120;
  const padding = 12;
  const values = points.map((point) => point.return);
  const low = Math.min(0, ...values);
  const high = Math.max(0.0001, ...values);
  const coordinates = points
    .map((point, index) => {
      const x = padding + (index * Math.max(1, width - 2 * padding)) / Math.max(1, points.length - 1);
      const y = height - padding - ((point.return - low) / Math.max(1e-9, high - low)) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full rounded bg-muted/20" role="img" aria-label="Research return history">
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="currentColor" opacity=".25" />
      <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="2" />
      <text x={padding} y={padding + 8} fontSize="10">{(high * 100).toFixed(2)}%</text>
      <text x={padding} y={height - 2} fontSize="10">{(low * 100).toFixed(2)}%</text>
    </svg>
  );
}

function statusTone(status: string): string {
  if (status === "VALID_TRADEABLE") return "text-emerald-300";
  if (status === "COST_BLOCKED") return "text-orange-300";
  if (status === "MODEL_FAILED" || status === "DATA_INVALID") return "text-rose-300";
  return "text-amber-300";
}

function ShadowDiagnosticsPanel({ workspaceId, symbols }: { workspaceId?: string; symbols: string[] }) {
  const [symbol, setSymbol] = useState(symbols[0] ?? "BTCUSDT");
  useEffect(() => {
    if (symbols.length > 0 && !symbols.includes(symbol)) setSymbol(symbols[0]);
  }, [symbols, symbol]);
  const query = useQuery({
    queryKey: ["v5-shadow-diagnostics", workspaceId, symbol],
    enabled: Boolean(workspaceId && symbol),
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow", "GET", undefined, { params: { workspace_id: workspaceId, symbol, duration_seconds: 3600 } }) as Promise<ShadowResearchPayload>,
    refetchInterval: 60_000,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["v5-shadow-history", workspaceId, symbol],
    enabled: Boolean(workspaceId && symbol),
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow/history", "GET", undefined, { params: { workspace_id: workspaceId, symbol, limit: 30 } }) as Promise<{ items?: ShadowHistoryItem[] }>,
    refetchInterval: 60_000,
    retry: false,
  });
  const holdout = useQuery({
    queryKey: ["v5-holdout-review", workspaceId, symbol],
    enabled: Boolean(workspaceId && symbol),
    queryFn: () => authorizedFetch("/quick-trade/ml-shadow/holdout-review", "GET", undefined, { params: { workspace_id: workspaceId, symbol, horizon_minutes: 15 } }) as Promise<{ champion?: { model_version?: string; holdout?: Record<string, unknown> | null }; challenger?: { model_version?: string; status?: string; holdout?: Record<string, unknown> | null }; gate?: { unseen_holdout_required: boolean; net_cost_required: boolean; human_approval_required: boolean; automatic_promotion: boolean; execution_authorized: boolean } }>,
    refetchInterval: 60_000,
    retry: false,
  });
  const researchCase = useMutation({
    mutationFn: () => authorizedFetch("/quick-trade/ml-shadow/research-case", "POST", { workspace_id: workspaceId, symbol, note: "Created from V5 shadow diagnostics." }) as Promise<{ created: boolean; entry?: { id: string } }>,
  });
  const hypothesisCase = useMutation({
    mutationFn: () => authorizedFetch("/quick-trade/ml-shadow/research-hypothesis", "POST", { workspace_id: workspaceId, symbol, note: "Generated from V5 failure buckets; review-only." }) as Promise<{ created: boolean; entry?: { id: string } }>,
  });
  const llmReview = useMutation({
    mutationFn: () => authorizedFetch("/quick-trade/ml-shadow/research-hypothesis/review", "POST", { workspace_id: workspaceId, symbol }) as Promise<{ status: string; message?: string; suggestions?: { title?: string; idea?: string; limitations?: string }[] }>,
  });
  const experimentReview = useMutation({
    mutationFn: () => authorizedFetch("/quick-trade/ml-shadow/research-experiment-review", "POST", { workspace_id: workspaceId, candidate_id: hypothesisCase.data?.entry?.id, symbol, timeframe: "15m" }) as Promise<{ created: boolean }>,
  });
  const diagnostics = query.data?.decision_diagnostics;
  const prediction = query.data?.prediction;

  return <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0">
      <div><CardTitle>ML shadow decision health</CardTitle><p className="mt-1 text-xs text-muted-foreground">Research-only diagnostics. This never changes a model or places an order.</p></div>
      <select className="rounded border bg-background px-2 py-1 text-xs" value={symbol} onChange={(event) => setSymbol(event.target.value)} disabled={!symbols.length}>
        {(symbols.length ? symbols : ["BTCUSDT"]).map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </CardHeader>
    <CardContent className="space-y-4">
      {query.isLoading && <p className="text-sm text-muted-foreground">Loading shadow diagnostics…</p>}
      {query.isError && <p className="text-sm text-destructive">Shadow diagnostics unavailable for this workspace.</p>}
      {query.data && <>
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Latest decision</div><div className={"mt-1 font-semibold " + statusTone(prediction?.decision_status ?? "WAIT_SIGNAL")}>{prediction?.decision ?? "—"}</div><div className="text-xs text-muted-foreground">{(prediction?.decision_status ?? "—").replaceAll("_", " ")}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Observed samples</div><div className="mt-1 text-lg font-semibold">{diagnostics?.sample_count ?? 0}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Directional rate</div><div className="mt-1 text-lg font-semibold">{diagnostics ? `${diagnostics.directional_rate_pct.toFixed(1)}%` : "—"}</div></div>
          <div className="rounded border p-3"><div className="text-xs text-muted-foreground">WAIT-like rate</div><div className="mt-1 text-lg font-semibold text-amber-300">{diagnostics?.wait_like_rate_pct == null ? "—" : `${diagnostics.wait_like_rate_pct.toFixed(1)}%`}</div></div>
        </div>
        {diagnostics?.alert && <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-orange-500/40 bg-orange-500/10 p-3 text-sm text-orange-200"><span><b>Diagnostic alert:</b> WAIT-like decisions are dominating this sample. This is an investigation trigger, not an instruction to lower thresholds.</span><div className="flex gap-2"><button className="rounded border border-orange-300/50 px-2 py-1 text-xs" onClick={() => researchCase.mutate()} disabled={researchCase.isPending}>{researchCase.isPending ? "Creating…" : "Create Nexus research case"}</button><button className="rounded border border-sky-300/50 px-2 py-1 text-xs text-sky-200" onClick={() => hypothesisCase.mutate()} disabled={hypothesisCase.isPending}>{hypothesisCase.isPending ? "Preparing…" : "Prepare hypotheses"}</button></div></div>}
        {researchCase.isSuccess && <div className="text-xs text-emerald-300">Nexus case {researchCase.data?.created ? "created" : "already exists"}. It is review-only and cannot change execution.</div>}
        {researchCase.isError && <div className="text-xs text-destructive">Could not create the Nexus case. Check Nexus migration and workspace permissions.</div>}
        {hypothesisCase.isSuccess && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-300"><span>Research hypotheses {hypothesisCase.data?.created ? "prepared" : "already exist"}. They are ready for optional LLM review; no model or threshold changed.</span><div className="flex gap-2"><button className="rounded border border-sky-300/50 px-2 py-1" onClick={() => llmReview.mutate()} disabled={llmReview.isPending}>{llmReview.isPending ? "Reviewing…" : "Request LLM review"}</button><button className="rounded border border-emerald-300/50 px-2 py-1 text-emerald-200" onClick={() => experimentReview.mutate()} disabled={experimentReview.isPending}>{experimentReview.isPending ? "Queueing…" : "Queue experiment review"}</button></div></div>}
        {hypothesisCase.isError && <div className="text-xs text-destructive">Could not prepare research hypotheses. Check Nexus migration and workspace permissions.</div>}
        {llmReview.data && <div className="rounded border border-sky-500/30 bg-sky-500/5 p-3 text-xs"><div className="font-medium text-sky-200">LLM research status: {llmReview.data.status}</div><div className="mt-1 text-muted-foreground">{llmReview.data.message}</div>{(llmReview.data.suggestions ?? []).length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">{llmReview.data.suggestions?.map((item, index) => <li key={`${item.title ?? "suggestion"}-${index}`}><span className="font-medium">{item.title ?? "Hypothesis"}</span>{item.idea ? ` — ${item.idea}` : ""}</li>)}</ul>}</div>}
        {experimentReview.isSuccess && <div className="text-xs text-emerald-300">Experiment proposal queued for review only. No training job was dispatched.</div>}
        {experimentReview.isError && <div className="text-xs text-amber-300">Experiment review requires an approved hypothesis candidate. Nothing was dispatched.</div>}
        {prediction && <div className="rounded border bg-muted/20 p-3 text-xs text-muted-foreground">Reason: {(prediction.decision_reason ?? "—").replaceAll("_", " ")} · BUY net {prediction.buy_net_pct == null ? "—" : `${prediction.buy_net_pct.toFixed(3)}%`} · SELL net {prediction.sell_net_pct == null ? "—" : `${prediction.sell_net_pct.toFixed(3)}%`}</div>}
        <div className="grid gap-2 sm:grid-cols-5">{Object.entries(diagnostics?.counts ?? {}).map(([key, value]) => <div className="rounded border px-3 py-2" key={key}><div className={"text-xs " + statusTone(key)}>{key.replaceAll("_", " ")}</div><div className="text-sm font-medium">{value}</div><div className="text-xs text-muted-foreground">{diagnostics?.rates_pct[key]?.toFixed(1) ?? "0.0"}%</div></div>)}</div>
        <div className="rounded border p-3"><div className="mb-2 text-sm font-medium">Failure analysis buckets</div><div className="grid gap-2 sm:grid-cols-4">{Object.entries(diagnostics?.failure_buckets ?? {}).map(([key, value]) => <div className="rounded bg-muted/20 px-3 py-2" key={key}><div className="text-xs text-muted-foreground">{key.replaceAll("_", " ")}</div><div className="text-lg font-semibold">{value}</div></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Buckets are investigation hints only; they do not change thresholds or retrain automatically.</p></div>
        <div className="rounded border p-3"><div className="mb-2 flex items-center justify-between"><div><div className="text-sm font-medium">Holdout comparison & promotion gate</div><div className="text-xs text-muted-foreground">Champion vs challenger on an unseen, fee-aware holdout.</div></div><Badge variant="outline">Review only</Badge></div>{holdout.isLoading ? <p className="text-xs text-muted-foreground">Loading holdout metrics…</p> : holdout.isError ? <p className="text-xs text-muted-foreground">Holdout comparison unavailable.</p> : <><div className="grid gap-2 sm:grid-cols-2"><div className="rounded bg-muted/20 px-3 py-2 text-xs"><div className="text-muted-foreground">Champion</div><div className="font-medium">{holdout.data?.champion?.model_version ?? "—"}</div></div><div className="rounded bg-muted/20 px-3 py-2 text-xs"><div className="text-muted-foreground">Challenger</div><div className="font-medium">{holdout.data?.challenger?.model_version ?? "—"} · {holdout.data?.challenger?.status ?? "—"}</div></div></div><div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Unseen holdout: required</span><span>Net-cost gate: required</span><span>Human approval: required</span><span>Auto-promotion: disabled</span></div></>}</div>
        <div className="rounded border p-3"><div className="mb-2 text-sm font-medium">Recent decision history</div>{history.isLoading ? <p className="text-xs text-muted-foreground">Loading history…</p> : history.isError ? <p className="text-xs text-muted-foreground">History unavailable.</p> : history.data?.items?.length ? <div className="max-h-52 space-y-1 overflow-auto">{history.data.items.map((item) => <div className="flex items-center justify-between gap-2 border-b py-1 text-xs last:border-0" key={`${item.anchor_time_ms}-${item.decision}`}><span className="text-muted-foreground">{new Date(item.anchor_time_ms).toLocaleString()}</span><span className={statusTone(item.decision_status)}>{item.decision} · {item.decision_status.replaceAll("_", " ")}</span></div>)}</div> : <p className="text-xs text-muted-foreground">No stored shadow decisions yet.</p>}</div>
      </>}
    </CardContent>
  </Card>;
}

export default function V5ResearchPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const queryClient = useQueryClient();
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeCategory, setKnowledgeCategory] = useState("CANDLE");
  const [knowledgeSourceType, setKnowledgeSourceType] = useState("MANUAL_NOTE");
  const knowledge = useQuery({
    queryKey: ["v5-knowledge", workspaceId], enabled: Boolean(workspaceId), retry: false,
    queryFn: () => api.get<{ items: KnowledgeItem[] }>(`/workspaces/${workspaceId}/v5/research/knowledge`).then((response) => response.data),
  });
  const knowledgeExperiments = useQuery({
    queryKey: ["v5-knowledge-paper-experiments", workspaceId], enabled: Boolean(workspaceId), retry: false,
    queryFn: () => api.get<{ items: KnowledgeExperiment[] }>(`/workspaces/${workspaceId}/v5/research/knowledge/paper-experiments`).then((response) => response.data),
  });
  const createKnowledge = useMutation({
    mutationFn: () => api.post(`/workspaces/${workspaceId}/v5/research/knowledge`, { title: knowledgeTitle, content: knowledgeContent, category: knowledgeCategory, source_type: knowledgeSourceType }),
    onSuccess: () => { setKnowledgeTitle(""); setKnowledgeContent(""); queryClient.invalidateQueries({ queryKey: ["v5-knowledge", workspaceId] }); },
  });
  const uploadKnowledge = useMutation({
    mutationFn: async () => { const form = new FormData(); form.append("title", knowledgeTitle); form.append("category", knowledgeCategory); form.append("source_type", knowledgeSourceType === "MANUAL_NOTE" ? "DOCUMENT_TRANSCRIPT" : knowledgeSourceType); if (knowledgeContent) form.append("content", knowledgeContent); if (knowledgeFile) form.append("document", knowledgeFile); return api.upload(`/workspaces/${workspaceId}/v5/research/knowledge/upload`, form); },
    onSuccess: () => { setKnowledgeTitle(""); setKnowledgeContent(""); setKnowledgeFile(null); queryClient.invalidateQueries({ queryKey: ["v5-knowledge", workspaceId] }); },
  });
  const reviewKnowledge = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "APPROVED" | "REJECTED" }) => api.post(`/workspaces/${workspaceId}/v5/research/knowledge/${id}/review`, { action, reason: action === "APPROVED" ? "Human-reviewed V5 research knowledge." : "Rejected during V5 knowledge review." }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v5-knowledge", workspaceId] }),
  });
  const downloadKnowledge = useMutation({
    mutationFn: async (format: "txt" | "pdf") => api.download(`/workspaces/${workspaceId}/v5/research/knowledge/download?format=${format}`, `v5-knowledge-review.${format}`),
  });
  const runKnowledgePaper = useMutation({
    mutationFn: (id: string) => api.post(`/workspaces/${workspaceId}/v5/research/knowledge/${id}/paper-run`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v5-knowledge-paper-experiments", workspaceId] }),
  });
  const overview = useQuery({
    queryKey: ["v5-overview"],
    queryFn: async () => (await api.get<{ execution_authorized: boolean; latest_run?: { candidates?: Candidate[] } }>("/../v5/research/overview")).data,
    retry: false,
  });
  const selections = useQuery({
    queryKey: ["v5-selections", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => (await api.get<{ selections: Selection[] }>(`/workspaces/${workspaceId}/v5/research/selections`)).data,
    retry: false,
  });
  const metrics = useQuery({
    queryKey: ["v5-selection-metrics", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => (await api.get<{ metrics: Metric[] }>(`/workspaces/${workspaceId}/v5/research/selection-metrics`)).data,
    retry: false,
  });
  const ranking = useQuery({
    queryKey: ["v5-ranking-history"],
    queryFn: async () => (await api.get<{ snapshots: RankingSnapshot[] }>("/../v5/research/ranking-history")).data,
    retry: false,
  });
  const add = useMutation({
    mutationFn: (value: { symbol: string; side: "LONG" | "SHORT" }) => {
      if (!workspaceId) throw new Error("Select a workspace first.");
      return api.post(`/workspaces/${workspaceId}/v5/research/selections`, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v5-selections", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["v5-selection-metrics", workspaceId] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${workspaceId}/v5/research/selections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["v5-selections", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["v5-selection-metrics", workspaceId] });
    },
  });

  const candidates = overview.data?.latest_run?.candidates ?? [];
  const tracked = (selections.data?.selections ?? []).filter((selection) => selection.status === "TRACKING");
  const latestRanking = ranking.data?.snapshots?.at(-1);
  const diagnosticSymbols = Array.from(new Set(["BTCUSDT", ...candidates.map((candidate) => candidate.symbol)]));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <h1 className="text-2xl font-bold">V5 Market Research</h1>
        <p className="text-sm text-muted-foreground">Research/shadow only. Charts are hypothetical gross reference returns, not realized P&amp;L. Cost-adjusted returns remain unavailable until validated costs exist.</p>

        <Card>
          <CardHeader><CardTitle>Scanner status</CardTitle></CardHeader>
          <CardContent>
            <Badge variant="secondary">{overview.data?.execution_authorized === false ? "EXECUTION DISABLED" : "UNAVAILABLE"}</Badge>
            {overview.isLoading && <p>Loading...</p>}
            {overview.isError && <p className="text-destructive">Research API unavailable.</p>}
          </CardContent>
        </Card>

        <ShadowDiagnosticsPanel workspaceId={workspaceId} symbols={diagnosticSymbols} />

        <Card>
          <CardHeader><CardTitle>V5 Knowledge Review &amp; Paper Validation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Create one item per rule in Candle, Trend, Support/Resistance, or Risk. Upload a transcript (.txt/.md/.pdf) made from a video/audio source; this screen does not transcribe media itself. Every item starts as proposed, needs human review, and remains training-ineligible. Approval never changes live trading.</p>
            <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <input className="rounded border bg-background px-3 py-2 text-sm" placeholder="Knowledge title" value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} />
              <select className="rounded border bg-background px-3 py-2 text-sm" value={knowledgeCategory} onChange={(event) => setKnowledgeCategory(event.target.value)}><option>CANDLE</option><option>TREND</option><option>SUPPORT_RESISTANCE</option><option>RISK</option><option>OTHER</option></select>
              <select className="rounded border bg-background px-3 py-2 text-sm" value={knowledgeSourceType} onChange={(event) => setKnowledgeSourceType(event.target.value)}><option value="MANUAL_NOTE">Manual note</option><option value="VIDEO_TRANSCRIPT">Video transcript</option><option value="AUDIO_TRANSCRIPT">Audio transcript</option><option value="DOCUMENT_TRANSCRIPT">Document transcript</option></select>
            </div>
            <textarea className="min-h-24 w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Describe the rule and when it should/should not apply" value={knowledgeContent} onChange={(event) => setKnowledgeContent(event.target.value)} />
            <div className="flex flex-wrap items-center gap-2"><button className="rounded border px-3 py-2 text-sm disabled:opacity-50" disabled={!workspaceId || !knowledgeTitle.trim() || !knowledgeContent.trim() || createKnowledge.isPending} onClick={() => createKnowledge.mutate()}>Add text for validation</button><input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(event) => setKnowledgeFile(event.target.files?.[0] ?? null)} /><button className="rounded border border-sky-400/50 px-3 py-2 text-sm text-sky-300 disabled:opacity-50" disabled={!workspaceId || !knowledgeTitle.trim() || !knowledgeFile || uploadKnowledge.isPending} onClick={() => uploadKnowledge.mutate()}>Upload document</button></div>
            <div className="flex flex-wrap items-center gap-2 rounded border border-sky-400/30 bg-sky-400/5 p-3 text-xs"><span className="text-muted-foreground">Download is enabled only when one or more individual items have Human review: APPROVED.</span><button className="rounded border border-sky-400/50 px-2 py-1 text-sky-200 disabled:opacity-50" disabled={!workspaceId || downloadKnowledge.isPending} onClick={() => downloadKnowledge.mutate("txt")}>Download approved TXT</button><button className="rounded border border-sky-400/50 px-2 py-1 text-sky-200 disabled:opacity-50" disabled={!workspaceId || downloadKnowledge.isPending} onClick={() => downloadKnowledge.mutate("pdf")}>Download approved PDF</button>{downloadKnowledge.isError && <span className="text-destructive">No approved items available yet, or download failed.</span>}</div>
            <div className="space-y-2">{(knowledge.data?.items ?? []).map((item) => <div className="rounded border p-3" key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div><b>{item.title}</b><span className="ml-2 text-xs text-muted-foreground">{item.payload?.category} · {item.status}</span></div>{item.status === "PROPOSED" && <div className="flex gap-2"><button className="rounded border border-emerald-400/50 px-2 py-1 text-xs text-emerald-300" onClick={() => reviewKnowledge.mutate({ id: item.id, action: "APPROVED" })}>Approve knowledge</button><button className="rounded border border-rose-400/50 px-2 py-1 text-xs text-rose-300" onClick={() => reviewKnowledge.mutate({ id: item.id, action: "REJECTED" })}>Reject</button></div>}</div>
              <p className="mt-1 text-xs text-muted-foreground">Source: {item.payload?.source_type ?? "MANUAL_NOTE"}</p><p className="mt-1 text-xs text-muted-foreground">{item.payload?.content}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>Document: {item.payload?.verification?.document_review ?? "PENDING"}</span><span>Human: {item.payload?.verification?.human_review ?? "PENDING"}</span><span>Backtest: {item.payload?.verification?.backtest ?? "PENDING"}</span><span>Paper: {item.payload?.verification?.paper_trade ?? "PENDING"}</span><span>Holdout: {item.payload?.verification?.holdout ?? "PENDING"}</span><span>Training eligible: NO</span></div>
            </div>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>V5 Knowledge Experiments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Separate paper-only experiment track. It never changes the baseline V5 ML autopilot and never places a live order. Approved items remain candidates until the isolated rule runner records paper outcomes.</p>
            <div className="grid gap-2 sm:grid-cols-2"><div className="rounded border border-sky-400/30 bg-sky-400/5 p-3 text-xs"><b>Baseline track</b><div className="mt-1 text-muted-foreground">V5 ML Paper Autopilot · existing model signals</div></div><div className="rounded border border-violet-400/30 bg-violet-400/5 p-3 text-xs"><b>Knowledge track</b><div className="mt-1 text-muted-foreground">Approved knowledge · isolated experiment ledger</div></div></div>
            {knowledgeExperiments.isLoading && <p className="text-xs text-muted-foreground">Loading experiment candidates…</p>}
            {knowledgeExperiments.isError && <p className="text-xs text-destructive">Knowledge experiment status unavailable.</p>}
            {!knowledgeExperiments.isLoading && !knowledgeExperiments.isError && !(knowledgeExperiments.data?.items?.length) && <p className="text-xs text-muted-foreground">No knowledge items yet. Upload and review a transcript or document above.</p>}
            <div className="space-y-2">{(knowledgeExperiments.data?.items ?? []).map((item) => <div className="rounded border p-3" key={item.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{item.title}</b><span className="ml-2 text-xs text-muted-foreground">{item.category}</span></div><div className="flex items-center gap-2"><span className={item.status === "APPROVED" ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{item.paper_track.replaceAll("_", " ")}</span>{item.status === "APPROVED" && <button className="rounded border border-violet-400/50 px-2 py-1 text-xs text-violet-300" onClick={() => runKnowledgePaper.mutate(item.id)} disabled={runKnowledgePaper.isPending}>Run isolated paper check</button>}</div></div><div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-3"><span>Paper trades: {item.paper_trades.length}</span><span>Training eligible: NO</span><span>Live execution: NO</span></div><p className="mt-2 text-xs text-muted-foreground">{item.note}</p></div>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>My Selected Top 3</CardTitle></CardHeader>
          <CardContent>
            {!workspaceId ? <p className="text-muted-foreground">Select a workspace first.</p> : tracked.length === 0 ? <p className="text-muted-foreground">No tracked opportunities.</p> : tracked.map((selection) => (
              <div className="flex justify-between rounded border p-3" key={selection.id}>
                <span><b>{selection.symbol}</b> {selection.side} · {new Date(selection.selected_at).toLocaleString()} · server price {selection.selection_price}</span>
                <button className="text-destructive" onClick={() => remove.mutate(selection.id)}>Remove</button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Research Return History</CardTitle></CardHeader>
          <CardContent>
            {metrics.isLoading ? <p>Loading metrics...</p> : metrics.isError ? <p className="text-destructive">Metrics unavailable.</p> : metrics.data?.metrics?.length ? metrics.data.metrics.map((metric) => (
              <div className="mb-3 rounded border p-3" key={metric.selection_id}>
                <div className="flex justify-between"><b>{metric.symbol} {metric.side}</b><span>{metric.return_since_selection === null ? "Unavailable" : `${(metric.return_since_selection * 100).toFixed(2)}% gross`}</span></div>
                <ReturnChart points={metric.history} />
                <p className="mt-1 text-xs text-muted-foreground">Cost-adjusted return: unavailable · hypothetical research only · execution authorized: false</p>
              </div>
            )) : <p className="text-muted-foreground">No return history.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dynamic Ranking History</CardTitle></CardHeader>
          <CardContent>
            {!latestRanking ? <p className="text-muted-foreground">No ranking history.</p> : latestRanking.rows.map((row) => (
              <div className="flex justify-between border-b py-2 last:border-b-0" key={row.symbol}>
                <b>{row.symbol}</b>
                <span>{row.removed ? "Removed" : `#${row.current_rank}`} {row.new_entrant ? "· new" : row.rank_movement ? `· ${row.rank_movement > 0 ? "↑" : "↓"}${Math.abs(row.rank_movement)}` : ""}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Existing V5 Dynamic Top 3</CardTitle></CardHeader>
          <CardContent>
            {candidates.length === 0 ? <p className="text-muted-foreground">No eligible candidates.</p> : candidates.map((candidate) => (
              <div className="flex justify-between rounded border p-3" key={candidate.symbol}>
                <div><b>#{candidate.rank} {candidate.symbol}</b> <span>Score: {candidate.ranking_score}</span><p className="text-xs text-muted-foreground">{candidate.research_status ?? "UNVALIDATED_RESEARCH_CANDIDATES"} · execution authorized: {String(candidate.execution_authorized)}</p></div>
                <div>
                  <button disabled={!workspaceId || tracked.length >= 3} className="mr-1 rounded border px-2 py-1 disabled:opacity-50" onClick={() => add.mutate({ symbol: candidate.symbol, side: "LONG" })}>Track LONG</button>
                  <button disabled={!workspaceId || tracked.length >= 3} className="rounded border px-2 py-1 disabled:opacity-50" onClick={() => add.mutate({ symbol: candidate.symbol, side: "SHORT" })}>Track SHORT</button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
