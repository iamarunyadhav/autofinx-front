import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  MoreVertical, 
  TrendingUp, 
  TrendingDown,
  Play,
  Pause,
} from "lucide-react";

interface Strategy {
  id: string;
  name: string;
  type: string;
  asset: string;
  mode: "live" | "paper";
  status: "running" | "paused" | "error";
  pnl: number;
  pnlPercent: number;
  trades24h: number;
  winRate: number;
  connection?: string;
}

interface StrategyCardProps {
  strategy: Strategy;
  onToggle: (id: string) => void;
  delay?: number;
}

export function StrategyCard({ strategy, onToggle, delay = 0 }: StrategyCardProps) {
  const isProfit = strategy.pnl >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card variant="interactive" className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{strategy.name}</h3>
              <Badge variant={strategy.mode === "live" ? "live" : "paper"} pulse={strategy.mode === "live" && strategy.status === "running"}>
                {strategy.mode.toUpperCase()}
              </Badge>
              {strategy.connection && (
                <Badge variant="outline" className="text-[11px]">
                  {strategy.connection}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {strategy.type} • {strategy.asset}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Switch
              checked={strategy.status === "running"}
              onCheckedChange={() => onToggle(strategy.id)}
            />
            <Button variant="ghost" size="icon-sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* P&L */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">P&L</p>
            <div className="flex items-center gap-1">
              {isProfit ? (
                <TrendingUp className="w-4 h-4 text-profit" />
              ) : (
                <TrendingDown className="w-4 h-4 text-loss" />
              )}
              <span
                className={`font-mono font-semibold ${
                  isProfit ? "text-profit" : "text-loss"
                }`}
              >
                {isProfit ? "+" : ""}${strategy.pnl.toLocaleString()}
              </span>
            </div>
            <p
              className={`text-xs font-mono ${
                isProfit ? "text-profit" : "text-loss"
              }`}
            >
              {isProfit ? "+" : ""}{strategy.pnlPercent.toFixed(2)}%
            </p>
          </div>

          {/* Trades */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Trades (24h)</p>
            <p className="font-mono font-semibold">{strategy.trades24h}</p>
          </div>

          {/* Win Rate */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className="font-mono font-semibold">{strategy.winRate}%</p>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Badge variant={strategy.status === "running" ? "running" : strategy.status === "paused" ? "paused" : "error"}>
            {strategy.status === "running" && <Play className="w-3 h-3" />}
            {strategy.status === "paused" && <Pause className="w-3 h-3" />}
            {strategy.status.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Last trade: 2m ago
          </span>
        </div>
      </Card>
    </motion.div>
  );
}
