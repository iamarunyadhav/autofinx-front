import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { QuickTradeChartPayload } from "@/hooks/useQuickTrade";

interface QuickTradeChartCardProps {
  symbolLabel: string;
  chartType: string;
  chart?: QuickTradeChartPayload;
  loading?: boolean;
}

export function QuickTradeChartCard({ symbolLabel, chartType, chart, loading }: QuickTradeChartCardProps) {
  const data = chart?.candles?.map((candle) => ({
    time: new Date(candle.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    move: candle.close >= candle.open ? "up" : "down",
  })) ?? [];

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-950 text-slate-50 shadow-[0_24px_60px_rgba(2,6,23,0.4)]">
      <CardHeader className="space-y-1 border-b border-slate-900 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]">
        <CardTitle className="text-xl">{symbolLabel}</CardTitle>
        <div className="text-sm text-slate-400">
          {chart?.quote?.price ? `${chart.quote.price.toFixed(4)} USD` : "Waiting for quote"}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {loading ? (
          <Skeleton className="h-[320px] w-full rounded-2xl bg-slate-900" />
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="tradeArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#172033" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", color: "#e2e8f0" }} />
                  <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#tradeArea)" strokeWidth={2.5} />
                </AreaChart>
              ) : chartType === "bars" || chartType === "candles" ? (
                <BarChart data={data}>
                  <CartesianGrid stroke="#172033" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", color: "#e2e8f0" }} />
                  <Bar dataKey="close" radius={[6, 6, 0, 0]} fill="#1d4ed8" />
                </BarChart>
              ) : (
                <LineChart data={data}>
                  <CartesianGrid stroke="#172033" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b", color: "#e2e8f0" }} />
                  <Line type="monotone" dataKey="close" stroke="#60a5fa" dot={false} strokeWidth={2.25} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
