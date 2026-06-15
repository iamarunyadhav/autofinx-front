import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleData } from "@/hooks/useRobotCandleFeed";

interface RobotLiveChartProps {
  candles: CandleData[];
  entryPrice?: number | null;
  stopPrice?: number | null;
  takeProfitPrice?: number | null;
  side?: "BUY" | "SELL" | null;
  height?: number;
}

const toBar = (c: CandleData): CandlestickData<Time> => ({
  time: c.time as UTCTimestamp,
  open: c.open,
  high: c.high,
  low: c.low,
  close: c.close,
});

/**
 * Dark-theme candlestick chart for the Robot Trade page. Renders the live feed
 * plus entry / trailing-stop / take-profit price lines that track the position.
 */
export function RobotLiveChart({
  candles,
  entryPrice,
  stopPrice,
  takeProfitPrice,
  side,
  height = 360,
}: RobotLiveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<Record<string, IPriceLine | null>>({ entry: null, stop: null, tp: null });

  // Create the chart once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: { borderColor: "rgba(148,163,184,0.15)", timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => chart.applyOptions({ width: container.clientWidth });
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = { entry: null, stop: null, tp: null };
    };
  }, [height]);

  // Push candle data.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || candles.length === 0) return;
    series.setData(candles.map(toBar));
  }, [candles]);

  // Sync the entry / stop / take-profit price lines.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const sync = (
      key: "entry" | "stop" | "tp",
      price: number | null | undefined,
      color: string,
      title: string,
    ) => {
      const existing = linesRef.current[key];
      if (price && price > 0) {
        const opts = {
          price,
          color,
          lineWidth: 2 as const,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        };
        if (existing) {
          existing.applyOptions(opts);
        } else {
          linesRef.current[key] = series.createPriceLine(opts);
        }
      } else if (existing) {
        series.removePriceLine(existing);
        linesRef.current[key] = null;
      }
    };

    sync("entry", entryPrice, "#3b82f6", side ? `Entry (${side})` : "Entry");
    sync("stop", stopPrice, "#f43f5e", "Stop");
    sync("tp", takeProfitPrice, "#22c55e", "Take profit");
  }, [entryPrice, stopPrice, takeProfitPrice, side]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
