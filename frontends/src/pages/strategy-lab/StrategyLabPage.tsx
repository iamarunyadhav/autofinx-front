import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "@/components/ml-training/MlBits";
import { LabShell, ToneBadge } from "@/components/strategy-lab/LabShell";
import { NewCandidateDialog } from "@/components/strategy-lab/NewCandidateDialog";
import { useLabCandidates } from "@/hooks/useStrategyLab";
import { cn } from "@/lib/utils";
import {
  LAB_ACTIVE_STATUSES,
  labAuditTone,
  labDateTime,
  labRunTone,
  labStatusTone,
  labVerdictTone,
  labWords,
  type LabRunBrief,
} from "@/lib/strategyLab";

function RunCell({ run }: { run: LabRunBrief | null }) {
  if (!run) return <span className="text-xs text-muted-foreground">—</span>;
  const active = LAB_ACTIVE_STATUSES.includes(run.status);
  return (
    <div className="flex flex-col items-start gap-1">
      {run.status === "COMPLETED" && run.verdict ? (
        <ToneBadge tone={labVerdictTone(run.verdict)}>{run.verdict}</ToneBadge>
      ) : (
        <ToneBadge tone={labRunTone(run.status)} className={cn(run.status === "RUNNING" && "animate-pulse")}>
          {run.status}{active && run.progress_pct != null ? ` ${Math.round(Number(run.progress_pct))}%` : ""}
        </ToneBadge>
      )}
    </div>
  );
}

function CandidateList({ workspaceId }: { workspaceId: string }) {
  const q = useLabCandidates(workspaceId);
  const rows = q.data?.candidates ?? [];

  if (!q.data && q.isLoading) return <LoadingBlock rows={4} />;
  if (!q.data && q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-2">
      {q.isError && <div role="alert" className="text-xs text-warning">Can't refresh the list; showing the last data received.</div>}
      {rows.length === 0 ? (
        <EmptyBlock title="No candidates yet" hint="Add one with “New candidate”: paste a Pine script or load a .pine / .txt file." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Version</TableHead>
                    <TableHead>Audit</TableHead>
                    <TableHead>Quick test</TableHead>
                    <TableHead className="hidden sm:table-cell">Deep test</TableHead>
                    <TableHead className="hidden lg:table-cell">Approval state</TableHead>
                    <TableHead className="hidden xl:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[14rem] align-top">
                        <Link to={`/strategy-lab/${encodeURIComponent(c.id)}`} className="block break-words font-medium text-primary hover:underline">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {labWords(c.intended_purpose)}
                          <span className="md:hidden"> · {labWords(c.source_type)}</span>
                          <span className="sm:hidden"> · v{c.latest_version ?? "—"}</span>
                        </div>
                        <div className="mt-1 lg:hidden"><ToneBadge tone={labStatusTone(c.status)}>{c.status}</ToneBadge></div>
                      </TableCell>
                      <TableCell className="hidden align-top text-xs md:table-cell">{c.source_type}</TableCell>
                      <TableCell className="hidden align-top font-mono text-xs sm:table-cell">
                        v{c.latest_version ?? "—"}
                        {!c.testable && <div className="font-sans text-[10px] text-muted-foreground" title="No reviewed translation for this exact source">not testable</div>}
                      </TableCell>
                      <TableCell className="align-top">
                        {c.audit_status ? <ToneBadge tone={labAuditTone(c.audit_status)}>{c.audit_status}</ToneBadge> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="align-top"><RunCell run={c.quick_test} /></TableCell>
                      <TableCell className="hidden align-top sm:table-cell"><RunCell run={c.deep_test} /></TableCell>
                      <TableCell className="hidden align-top lg:table-cell"><ToneBadge tone={labStatusTone(c.status)}>{c.status}</ToneBadge></TableCell>
                      <TableCell className="hidden whitespace-nowrap align-top text-xs text-muted-foreground xl:table-cell">{labDateTime(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function StrategyLabPage() {
  return (
    <LabShell
      title="Strategy Lab"
      description="Audit and test strategy ideas on development data. Owner approval is needed between stages."
      actions={({ workspaceId, canMutate }) => (canMutate ? <NewCandidateDialog workspaceId={workspaceId} /> : null)}
    >
      {({ workspaceId }) => <CandidateList workspaceId={workspaceId} />}
    </LabShell>
  );
}
