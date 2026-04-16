import { useMemo } from "react";
import { Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface CandlePoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface PredictionChartProps {
  symbol: string;
  candles?: CandlePoint[];
  isLoading?: boolean;
}

export function PredictionChart({ symbol, candles = [], isLoading }: PredictionChartProps) {
  const data = useMemo(() => {
    if (!candles.length) return [];
    const sorted = [...candles].sort((a, b) => a.timestamp - b.timestamp);
    const window = 10;
    return sorted.map((candle, index) => {
      const slice = sorted.slice(Math.max(0, index - window), index + 1);
      const mean = slice.reduce((sum, point) => sum + point.close, 0) / slice.length;
      const momentum = index > 0 ? candle.close - sorted[index - 1].close : 0;
      const estimate = mean + momentum * 0.5;

      return {
        time: new Date(candle.timestamp).toLocaleTimeString(),
        close: candle.close,
        estimate,
      };
    });
  }, [candles]);

  const latest = data[data.length - 1];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-base">Market Trend Estimate</CardTitle>
        <span className="text-xs text-muted-foreground">{symbol}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : data.length > 0 ? (
          <ChartContainer
            config={{
              close: { label: "Close", color: "hsl(var(--primary))" },
              estimate: { label: "Estimated Projection", color: "hsl(var(--warning))" },
            }}
            className="h-80"
          >
            <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="close" stroke="var(--color-close)" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="estimate" stroke="var(--color-estimate)" strokeDasharray="4 4" dot={false} strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}

        {latest && (
          <div className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Latest:</span> Close {latest.close.toFixed(2)}. Estimated projection {latest.estimate.toFixed(2)}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Projection is heuristic only. It is not AI and not a guaranteed outcome.</p>
      </CardContent>
    </Card>
  );
}
