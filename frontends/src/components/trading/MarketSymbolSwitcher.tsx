import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMMON_CRYPTO_SYMBOLS, marketSymbolLabel, normalizeMarketSymbol } from "@/lib/market-symbols";

export interface MarketSymbolSwitcherProps {
  value: string;
  onChange: (symbol: string) => void;
  symbols?: string[];
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function MarketSymbolSwitcher({
  value,
  onChange,
  symbols = [...COMMON_CRYPTO_SYMBOLS],
  disabled = false,
  className,
  label = "Market",
}: MarketSymbolSwitcherProps) {
  const options = useMemo(() => {
    const merged = new Set([...COMMON_CRYPTO_SYMBOLS, ...symbols].map(normalizeMarketSymbol).filter(Boolean));
    return [...merged];
  }, [symbols]);
  const normalizedValue = normalizeMarketSymbol(value);

  return (
    <div className={className}>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <Select value={normalizedValue} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
        <SelectContent>
          {options.map((symbol) => <SelectItem key={symbol} value={symbol}>{marketSymbolLabel(symbol)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
