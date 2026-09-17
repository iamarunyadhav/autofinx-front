export const COMMON_CRYPTO_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "SOLUSDT",
  "AXSUSDT",
] as const;

export type CommonCryptoSymbol = (typeof COMMON_CRYPTO_SYMBOLS)[number];

export const CRYPTO_SYMBOL_LABELS: Record<string, string> = {
  BTCUSDT: "BTC / USDT",
  ETHUSDT: "ETH / USDT",
  XRPUSDT: "XRP / USDT",
  BNBUSDT: "BNB / USDT",
  DOGEUSDT: "DOGE / USDT",
  SOLUSDT: "SOL / USDT",
  AXSUSDT: "AXS / USDT",
};

export function normalizeMarketSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/[/.\-_\s]/g, "");
}

export function marketSymbolLabel(symbol: string): string {
  const normalized = normalizeMarketSymbol(symbol);
  return CRYPTO_SYMBOL_LABELS[normalized] ?? normalized;
}
