import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callPublicEdgeFunction } from '@/lib/api';

interface PriceData {
  symbol: string;
  exchange_symbol: string;
  asset_type: string;
  price: number;
  change_24h: number;
  change_24h_percent: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  timestamp: string;
}

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OrderbookData {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: string;
}

export function useMarketPrices(symbols?: string[], refetchInterval = 5000) {
  return useQuery({
    queryKey: ['market-prices', symbols],
    queryFn: async () => {
      const data = await callPublicEdgeFunction<{ prices: PriceData[] }>('market-data', {
        action: 'get_prices',
        symbols,
      });
      return data.prices;
    },
    refetchInterval,
    staleTime: 2000,
  });
}

export function useCandles(symbol: string, timeframe = '1h', limit = 100) {
  return useQuery({
    queryKey: ['candles', symbol, timeframe, limit],
    queryFn: async () => {
      const data = await callPublicEdgeFunction<{ candles: Candle[] }>('market-data', {
        action: 'get_candles',
        symbol,
        timeframe,
        limit,
      });
      return data.candles;
    },
    enabled: !!symbol,
    staleTime: 30000,
  });
}

export function useOrderbook(symbol: string) {
  return useQuery({
    queryKey: ['orderbook', symbol],
    queryFn: async () => {
      const data = await callPublicEdgeFunction<OrderbookData>('market-data', {
        action: 'get_orderbook',
        symbol,
      });
      return data;
    },
    enabled: !!symbol,
    refetchInterval: 2000,
  });
}
