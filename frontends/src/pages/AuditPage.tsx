import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  GitBranch,
  Play,
  RadioTower,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Send,
  Workflow,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditFlow, type AuditFlow, type AuditFlowNode, type AuditLight } from "@/hooks/useAuditFlow";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

const flowIcons = {
  webhook: RadioTower,
  binance_brain: GitBranch,
  robot: Bot,
  order_transport: Send,
  server: ServerCog,
};

const lightStyles: Record<AuditLight, string> = {
  green: "bg-emerald-500 text-emerald-950 border-emerald-500",
  yellow: "bg-amber-400 text-amber-950 border-amber-400",
  red: "bg-rose-500 text-white border-rose-500",
  gray: "bg-slate-300 text-slate-700 border-slate-300",
};

const panelStyles: Record<AuditLight, string> = {
  green: "border-emerald-200 bg-emerald-50/70",
  yellow: "border-amber-200 bg-amber-50/80",
  red: "border-rose-200 bg-rose-50/80",
  gray: "border-slate-200 bg-slate-50",
};

export default function AuditPage() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const audit = useAuditFlow(currentWorkspace?.id);
  const data = audit.overview.data;
  const [activeFlow, setActiveFlow] = useState("webhook");
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const flows = data?.flows ?? {};
  const active = flows[activeFlow] ?? Object.values(flows)[0];
  const orderRouter = (data?.runtime?.order_router ?? {}) as Record<string, unknown>;
  const orderTransport = String(orderRouter.effective_transport ?? "rest");
  const requestedTransport = String(orderRouter.requested_transport ?? orderTransport);
  const wsTransportOn = requestedTransport === "websocket";
  const selectedNode = useMemo(() => {
    const nodes = active?.nodes ?? [];
    return nodes.find((node) => node.key === selectedNodeKey) ?? nodes[0] ?? null;
  }, [active, selectedNodeKey]);
  const overallState = useMemo<AuditLight>(() => {
    const nodes = Object.values(flows).flatMap((flow) => flow.nodes || []);
    if (nodes.some((node) => node.state === "red")) return "red";
    if (nodes.some((node) => node.state === "yellow")) return "yellow";
    if (nodes.some((node) => node.state === "green")) return "green";
    return "gray";
  }, [flows]);

  useEffect(() => {
    setSelectedNodeKey(null);
  }, [activeFlow]);

  const run = async (label: string, action: { mutateAsync: () => Promise<unknown> }) => {
    try {
      await action.mutateAsync();
      toast({ title: `${label} triggered`, description: "Audit will refresh in a few seconds." });
    } catch (error) {
      toast({ title: `${label} failed`, description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    }
  };

  const exportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autofinx-audit-${data.workspace_id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyReport = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.report ?? data, null, 2));
    toast({ title: "Report copied", description: "Audit report is ready to paste into analysis notes." });
  };

  const toggleOrderTransport = async (enabled: boolean) => {
    try {
      await audit.setOrderTransport.mutateAsync(enabled ? "websocket" : "rest");
      toast({
        title: enabled ? "WebSocket order transport selected" : "REST order transport selected",
        description: "Future Trade order router will use the selected transport on the next live order.",
      });
    } catch (error) {
      toast({ title: "Transport update failed", description: error instanceof Error ? error.message : "Request failed", variant: "destructive" });
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="border-b bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-lg", lightStyles[overallState])}>
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-normal text-slate-950">Audit Flow Monitor</h1>
                <p className="text-sm text-slate-500">Future Trade, Binance brain, robot candles, server workers, and blockers in one live trace.</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{data?.report?.summary ?? "Waiting for first audit snapshot."}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-9 gap-2 px-3">
                <Clock3 className="h-4 w-4" />
                {data?.generated_at ? formatTime(data.generated_at) : "Waiting"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => audit.overview.refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportJson} disabled={!data}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={copyReport} disabled={!data}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Report
              </Button>
            </div>
          </div>
        </div>

        <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4">
          <section className="grid gap-3 md:grid-cols-4">
            <HealthTile label="Overall" value={statusLabel(overallState)} state={overallState} />
            <HealthTile label="Hard Blockers" value={String(data?.report?.health?.hard_blocker_count ?? 0)} state={(data?.report?.health?.hard_blocker_count ?? 0) ? "red" : "green"} />
            <HealthTile label="Soft Warnings" value={String(data?.report?.health?.soft_warning_count ?? 0)} state={(data?.report?.health?.soft_warning_count ?? 0) ? "yellow" : "green"} />
            <HealthTile label="Queue Failed" value={String(data?.report?.health?.queue_failed ?? 0)} state={(data?.report?.health?.queue_failed ?? 0) ? "red" : "green"} />
          </section>

          <section className="grid gap-3 md:grid-cols-5">
            {Object.entries(data?.metrics ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-lg border bg-white px-3 py-3">
                <div className="text-xs font-medium uppercase text-slate-500">{labelize(key)}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Workflow className="h-5 w-5" />
                  Live Workflow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeFlow} onValueChange={setActiveFlow}>
                  <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-100 p-1 lg:grid-cols-5">
                    {Object.entries(flows).map(([key, flow]) => {
                      const Icon = flowIcons[key as keyof typeof flowIcons] ?? Workflow;
                      return (
                        <TabsTrigger key={key} value={key} className="gap-2">
                          <Icon className="h-4 w-4" />
                          {flow.title}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {Object.entries(flows).map(([key, flow]) => (
                    <TabsContent key={key} value={key} className="mt-4">
                      <WorkflowGraph flow={flow} selectedKey={selectedNode?.key} onSelect={setSelectedNodeKey} />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5" />
                  Selected Step
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNode ? (
                  <div className={cn("rounded-lg border p-4", panelStyles[selectedNode.state])}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <StatusIcon state={selectedNode.state} />
                        {selectedNode.label}
                      </div>
                      <Badge variant="outline" className="bg-white">{selectedNode.blockerType ?? "none"}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-700">
                      <DetailLine label="Reason" value={selectedNode.detail || "No event received yet"} />
                      <DetailLine label="Time" value={selectedNode.at ? formatTime(selectedNode.at) : "Waiting"} />
                      <DetailLine label="Latency" value={selectedNode.latencyMs !== null && selectedNode.latencyMs !== undefined ? `${selectedNode.latencyMs} ms` : "Not measured"} />
                      <DetailLine label="Retry" value={selectedNode.retryable ? "Allowed from recovery panel" : "Manual fix / next trigger"} />
                      <DetailLine label="Next" value={selectedNode.nextAction || "No action needed"} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Select a workflow step to inspect it.</div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-5 w-5" />
                  Recovery And Failover
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" className="justify-start" onClick={() => run("Runtime recovery", audit.recoverRuntime)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Recover Future Runtime
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => run("Live feed restart", audit.restartLiveFeed)}>
                  <RadioTower className="mr-2 h-4 w-4" />
                  Restart Live Feed
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => run("Worker restart", audit.restartWorkers)}>
                  <ServerCog className="mr-2 h-4 w-4" />
                  Restart Workers
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => run("Failed job retry", { mutateAsync: () => audit.retryFailedJobs.mutateAsync(undefined) })}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Failed Jobs
                </Button>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Reconcile command: <span className="font-mono">{data?.actions?.reconcile_binance ?? "php artisan future-trade:reconcile-binance"}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">Binance WS Order Transport</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Requested {requestedTransport}; effective {orderTransport}.
                      </div>
                    </div>
                    <Switch checked={wsTransportOn} onCheckedChange={toggleOrderTransport} disabled={audit.setOrderTransport.isPending} />
                  </div>
                  <div className="mt-2 text-xs text-slate-600">{String(orderRouter.message ?? "Order router status waiting.")}</div>
                </div>
                <div className="grid gap-2 pt-1">
                  {(data?.report?.failover ?? []).map((item) => (
                    <div key={item.label} className="grid grid-cols-[14px_1fr] gap-2 rounded-lg border bg-white p-2 text-xs">
                      <StatusDot state={item.state.includes("need") || item.state === "stopped" ? "red" : item.state === "waiting" ? "yellow" : "green"} />
                      <div>
                        <div className="font-medium text-slate-900">{item.label} <span className="font-normal text-slate-500">({item.state})</span></div>
                        <div className="text-slate-500">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Blockers And Warnings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {(active?.nodes ?? []).filter((node) => node.state === "red" || node.state === "yellow").map((node) => (
                  <div key={node.key} className={cn("rounded-lg border p-3", panelStyles[node.state])}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {node.state === "red" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {node.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-700">{node.detail || "No detail from server yet."}</div>
                  </div>
                ))}
                {(active?.nodes ?? []).every((node) => node.state !== "red" && node.state !== "yellow") && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">No hard blockers in this flow.</div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent Timeline</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[440px] space-y-2 overflow-y-auto">
                {(data?.timeline ?? []).map((item, index) => (
                  <div key={`${item.type}-${item.at}-${index}`} className="grid grid-cols-[20px_1fr_auto] gap-3 rounded-lg border bg-white p-3">
                    <StatusDot state={item.state} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-950">{item.title}</div>
                      <div className="truncate text-xs text-slate-500">{item.reason || item.type}</div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div>{item.at ? formatTime(item.at) : "-"}</div>
                      <div>{item.latency_ms ? `${item.latency_ms} ms` : ""}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Full Report</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-2 text-sm">
                  {Object.entries(data?.report?.operator_actions ?? {}).map(([key, value]) => (
                    <DetailLine key={key} label={labelize(key)} value={value || "-"} />
                  ))}
                </div>
                <pre className="max-h-[300px] overflow-auto rounded-lg border bg-slate-950 p-3 text-xs text-slate-100">
                  {JSON.stringify({ refs: data?.report?.raw_refs, runtime: data?.runtime, queues: data?.queues, latest: data?.latest }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </AppShell>
  );
}

function WorkflowGraph({ flow, selectedKey, onSelect }: { flow: AuditFlow; selectedKey?: string; onSelect: (key: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      {flow.nodes.map((node, index) => (
        <div key={node.key} className="relative">
          {index < flow.nodes.length - 1 && <div className="absolute left-[calc(100%-4px)] top-7 hidden h-0.5 w-6 bg-slate-300 md:block" />}
          <NodePanel node={node} selected={node.key === selectedKey} onSelect={() => onSelect(node.key)} />
        </div>
      ))}
    </div>
  );
}

function NodePanel({ node, selected, onSelect }: { node: AuditFlowNode; selected?: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={cn("min-h-[150px] w-full rounded-lg border p-3 text-left transition hover:shadow-sm", panelStyles[node.state], selected && "ring-2 ring-slate-900")}>
      <div className="flex items-start justify-between gap-2">
        <StatusIcon state={node.state} />
        {node.latencyMs !== null && node.latencyMs !== undefined && (
          <Badge variant="outline" className="bg-white text-xs">{node.latencyMs} ms</Badge>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-950">{node.label}</div>
      <div className="mt-1 line-clamp-3 text-xs text-slate-600">{node.detail || "No event yet"}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{node.at ? formatTime(node.at) : "Waiting for trigger"}</span>
        <span>{node.blockerType ?? "none"}</span>
      </div>
    </button>
  );
}

function HealthTile({ label, value, state }: { label: string; value: string; state: AuditLight }) {
  return (
    <div className={cn("rounded-lg border px-3 py-3", panelStyles[state])}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
        <StatusDot state={state} />
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-3">
      <span className="text-xs font-medium uppercase text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-700">{value}</span>
    </div>
  );
}

function StatusIcon({ state }: { state: AuditLight }) {
  if (state === "green") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (state === "red") return <XCircle className="h-5 w-5 text-rose-600" />;
  if (state === "yellow") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <Clock3 className="h-5 w-5 text-slate-400" />;
}

function StatusDot({ state }: { state: AuditLight }) {
  return <span className={cn("mt-1 h-3 w-3 rounded-full border", lightStyles[state])} />;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function labelize(value: string) {
  return value.replace(/_/g, " ");
}

function statusLabel(state: AuditLight) {
  if (state === "green") return "Healthy";
  if (state === "yellow") return "Warning";
  if (state === "red") return "Blocked";
  return "Waiting";
}
