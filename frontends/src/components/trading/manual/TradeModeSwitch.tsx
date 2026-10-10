import { Button } from "@/components/ui/button";

export type TradeMode = "time" | "manual";

/** [Time-Based] [Manual SL/TP] switch on the Quick Trade page. Presentation only. */
export function TradeModeSwitch({ mode, onChange }: { mode: TradeMode; onChange: (m: TradeMode) => void }) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Quick Trade mode">
      <Button variant="ghost" role="tab" aria-selected={mode === "time"} className={mode === "time" ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-slate-300"} onClick={() => onChange("time")}>Time-Based</Button>
      <Button variant="ghost" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-300"} onClick={() => onChange("manual")}>Manual SL/TP</Button>
    </div>
  );
}
