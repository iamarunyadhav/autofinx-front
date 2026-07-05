import { Button } from "@/components/ui/button";
import type { AssetClass } from "@/hooks/useProviderCatalog";

interface AssetClassToggleProps {
  value: AssetClass;
  onChange: (value: AssetClass) => void;
  disabledClasses?: AssetClass[];
  disabledNote?: string;
  className?: string;
}

const OPTIONS: Array<{ key: AssetClass; label: string }> = [
  { key: "CRYPTO", label: "Crypto" },
  { key: "FOREX", label: "Forex" },
];

/**
 * Shared Crypto/Forex switch used consistently across Quick Trade, Future
 * Trade Bot, and Robot Trade — one toggle, one component, so the three pages
 * can't drift into different asset-class behavior.
 */
export function AssetClassToggle({ value, onChange, disabledClasses = [], disabledNote, className }: AssetClassToggleProps) {
  return (
    <div className={className}>
      <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        {OPTIONS.map((option) => {
          const disabled = disabledClasses.includes(option.key);
          const active = value === option.key;
          return (
            <Button
              key={option.key}
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              title={disabled ? disabledNote : undefined}
              className={
                active
                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  : "bg-transparent text-slate-300 hover:bg-slate-800"
              }
              onClick={() => !disabled && onChange(option.key)}
            >
              {option.label}
              {disabled ? <span className="ml-1 text-[10px] text-slate-500">(soon)</span> : null}
            </Button>
          );
        })}
      </div>
      {disabledClasses.length > 0 && disabledNote ? (
        <div className="mt-1 text-[11px] text-slate-500">{disabledNote}</div>
      ) : null}
    </div>
  );
}
