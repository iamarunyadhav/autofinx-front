import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProviderCatalogEntry } from "@/hooks/useProviderCatalog";

interface ProviderSelectProps {
  providers: ProviderCatalogEntry[];
  value: string;
  onChange: (providerKey: string) => void;
  fallbackLabel?: string;
  className?: string;
}

/**
 * Generalized from Robot Trade's original inline provider dropdown — reused
 * here instead of re-implemented per page.
 */
export function ProviderSelect({ providers, value, onChange, fallbackLabel = "Binance", className }: ProviderSelectProps) {
  const options = providers.length > 0 ? providers : [{ key: "binance", label: fallbackLabel } as ProviderCatalogEntry];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "border-slate-800 bg-slate-950 text-slate-100"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((provider) => (
          <SelectItem key={provider.key} value={provider.key}>
            {provider.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
