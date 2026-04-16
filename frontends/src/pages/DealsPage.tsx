import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout";
import { MobileTradeNav } from "@/components/trading/MobileTradeNav";
import { TradeDealList } from "@/components/trading/TradeDealList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBalances } from "@/hooks/useWallet";
import { useQuickTradeActive, useQuickTradeHistory, useQuickTradeMetadata, useSettleQuickTrades } from "@/hooks/useQuickTrade";

type DealFilter = "all" | "manual_quick_trade" | "robot_trade";

export default function DealsPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { data: balances = [] } = useBalances(workspaceId);
  const { data: metadata } = useQuickTradeMetadata(workspaceId);
  const [filter, setFilter] = useState<DealFilter>("all");
  const source = filter === "all" ? undefined : filter;
  const activeTrades = useQuickTradeActive(workspaceId, source);
  const historyTrades = useQuickTradeHistory(workspaceId, source, undefined, 20);
  const settleTrades = useSettleQuickTrades();

  useEffect(() => {
    const timer = window.setInterval(() => {
      settleTrades.mutate(25);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [settleTrades]);

  const balance = Number(balances[0]?.available ?? balances[0]?.balance ?? 0);
  const activeMode = metadata?.trading_state.mode ?? "paper";
  const netPnl = useMemo(
    () => (historyTrades.data ?? []).reduce((sum, trade) => sum + Number(trade.profit_loss || 0), 0),
    [historyTrades.data]
  );

  return (
    <AppShell>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_24%),linear-gradient(180deg,#020617_0%,#071120_100%)] text-slate-50">
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-28 pt-4 md:px-6">
          <div className="rounded-[30px] border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.28em] text-slate-500">Deals</div>
                <div className="mt-2 text-3xl font-semibold">Balance ${balance.toFixed(2)}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {activeMode === "live"
                    ? "Manual and robot live timed trades settle through the shared wallet and ledger."
                    : "Manual and robot paper trades share the same wallet and ledger."}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={activeMode === "live" ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-300"}>
                  {activeMode.toUpperCase()}
                </Badge>
                <Badge className={netPnl >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}>
                  Net PnL {netPnl >= 0 ? "+" : ""}
                  {netPnl.toFixed(2)}
                </Badge>
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-100" onClick={() => settleTrades.mutate(50)}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All deals" },
              { key: "manual_quick_trade", label: "Manual" },
              { key: "robot_trade", label: "Robot" },
            ].map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                className={filter === item.key ? "bg-blue-500/15 text-blue-300" : "bg-slate-900 text-slate-400 hover:text-slate-100"}
                onClick={() => setFilter(item.key as DealFilter)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TradeDealList title="Active trades" trades={activeTrades.data ?? []} emptyMessage="No active trades for the selected filter." />
            <TradeDealList title="History" trades={historyTrades.data ?? []} emptyMessage="Settled trades will appear here once they expire." />
          </div>
        </div>

        <MobileTradeNav />
      </div>
    </AppShell>
  );
}
