import { useQuery } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

export type AssetClass = "CRYPTO" | "FOREX";

export interface ProviderCatalogEntry {
  key: string;
  label: string;
  asset_class: AssetClass;
  live_supported: boolean;
  default_market_type?: string;
  supports_short?: boolean;
  requires_integration?: boolean;
  requires_passphrase?: boolean;
  symbols: Array<{ symbol: string; display: string; asset_class?: string; payout_rate?: number }>;
  timeframes?: string[];
  durations?: number[];
}

interface AssetsResponse {
  providers: {
    CRYPTO: ProviderCatalogEntry[];
    METALS: ProviderCatalogEntry[];
    FOREX: ProviderCatalogEntry[];
  };
}

/**
 * Single source of truth for "which providers/asset classes exist" on the
 * frontend — backed by GET /assets, which itself derives providers from
 * LiveTradeProviderRegistry (config/live_providers.php). Reuse this instead
 * of a page-local hardcoded provider list.
 */
export function useProviderCatalog() {
  const query = useQuery({
    queryKey: ["provider-catalog"],
    queryFn: async () => authorizedFetch("/assets") as Promise<AssetsResponse>,
    staleTime: 5 * 60_000,
  });

  const crypto = query.data?.providers?.CRYPTO ?? [];
  // Metals + forex both live behind the same broker in the UI's Crypto/Forex
  // toggle — combine them into one "FOREX" bucket for that purpose.
  const forex = [...(query.data?.providers?.FOREX ?? []), ...(query.data?.providers?.METALS ?? [])];

  return {
    ...query,
    crypto,
    forex,
    byAssetClass: (assetClass: AssetClass): ProviderCatalogEntry[] => (assetClass === "CRYPTO" ? crypto : forex),
  };
}
