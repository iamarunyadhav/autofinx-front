import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

type Candidate = { symbol: string; rank: number; ranking_score: number; direction?: string | null; research_status?: string; execution_authorized: boolean; reason_codes?: string[] };
type Overview = { status?: string; execution_authorized: boolean; latest_run?: { as_of?: string; candidates?: Candidate[] } | null };

export default function V5ResearchPage() {
  const query = useQuery({ queryKey: ["v5-research-overview"], queryFn: async () => (await api.get<Overview>("/../v5/research/overview")).data, retry: false });
  const candidates = query.data?.latest_run?.candidates ?? [];
  return <AppShell><div className="p-6 space-y-5 max-w-5xl mx-auto"><div><h1 className="text-2xl font-bold">V5 Market Research</h1><p className="text-sm text-muted-foreground">Shadow research only. No candidate can place or authorize a trade.</p></div><Card><CardHeader><CardTitle>Scanner status</CardTitle></CardHeader><CardContent><Badge variant="secondary">{query.data?.execution_authorized === false ? "EXECUTION DISABLED" : "UNAVAILABLE"}</Badge>{query.isLoading && <p className="mt-3 text-sm">Loading research status…</p>}{query.isError && <p className="mt-3 text-sm text-destructive">Research API is unavailable or authentication is required.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Top research candidates</CardTitle></CardHeader><CardContent>{candidates.length === 0 ? <p className="text-sm text-muted-foreground">No validated scanner run or no eligible research candidates.</p> : <div className="space-y-3">{candidates.map(c => <div key={c.symbol} className="border rounded p-3"><b>#{c.rank} {c.symbol}</b><span className="ml-3 text-sm">Score: {c.ranking_score}</span><p className="text-xs text-muted-foreground mt-1">{c.research_status ?? "UNVALIDATED_RESEARCH_CANDIDATES"} · execution authorized: {String(c.execution_authorized)}</p></div>)}</div>}</CardContent></Card></div></AppShell>;
}
