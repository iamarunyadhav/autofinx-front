import type { ReactNode } from "react";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { ErrorBlock, LoadingBlock } from "@/components/ml-training/MlBits";
import { useMlAccess } from "@/hooks/useMlTrainingLive";
import { cn } from "@/lib/utils";
import { LAB_TONE_CLASS, type LabTone } from "@/lib/strategyLab";

export interface LabAccess {
  workspaceId: string;
  /** False only for a workspace member known not to be owner/admin (the server enforces it anyway). */
  canMutate: boolean;
}

export function ToneBadge({ tone, children, className, title }: { tone: LabTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <Badge variant="outline" title={title} className={cn("whitespace-nowrap px-1.5 text-[10px] font-bold", LAB_TONE_CLASS[tone], className)}>
      {children}
    </Badge>
  );
}

export function ResearchBanner() {
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>
        <strong>Research only</strong> — uploaded code is never executed and nothing here can place an order.
      </span>
    </div>
  );
}

interface LabShellProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: (access: LabAccess) => ReactNode;
  children: (access: LabAccess) => ReactNode;
}

/**
 * Frame for the Strategy Lab pages: workspace + role resolution (same source
 * as ML Training), the research-only banner and the read-only notice.
 * Children render only with a workspace id the user actually has.
 */
export function LabShell({ title, description, actions, children }: LabShellProps) {
  const access = useMlAccess();
  const ctx: LabAccess | null = access.workspaceId ? { workspaceId: access.workspaceId, canMutate: access.canMutate } : null;

  let body: ReactNode;
  if (access.loading) {
    body = <LoadingBlock rows={4} />;
  } else if (!ctx) {
    body = <ErrorBlock error={new Error(access.error ? "Could not load your workspaces." : "No workspace available.")} onRetry={access.retry} />;
  } else {
    body = (
      <>
        {access.role !== null && !access.canMutate && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            You have read-only access here. Only a workspace owner or admin can add candidates, start tests or record decisions.
          </div>
        )}
        {children(ctx)}
      </>
    );
  }

  return (
    <AppShell>
      <div className="min-w-0 space-y-4 overflow-x-hidden p-3 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <FlaskConical className="h-5 w-5 shrink-0 text-primary" />
              <h1 className="min-w-0 break-words text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              <ToneBadge tone="good">research only</ToneBadge>
            </div>
            {description && <div className="text-sm text-muted-foreground">{description}</div>}
          </div>
          {ctx && actions && <div className="flex flex-wrap items-center gap-2">{actions(ctx)}</div>}
        </div>
        <ResearchBanner />
        {body}
      </div>
    </AppShell>
  );
}
