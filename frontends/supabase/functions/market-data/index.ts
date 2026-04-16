import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simulated market data (in production, connect to real exchange APIs)
const generateMockPrice = (basePrice: number, volatility: number = 0.02) => {
  const change = (Math.random() - 0.5) * 2 * volatility * basePrice;
  return basePrice + change;
};

const basePrices: Record<string, number> = {
  'BTCUSDT': 43500,
  'ETHUSDT': 2250,
  'SOLUSDT': 95,
  'XRPUSDT': 0.62,
  'AAPL': 182,
  'TSLA': 245,
  'GOOGL': 140,
  'MSFT': 375,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, symbols } = await req.json();

    console.log(`Market data request: ${action}`, { symbols });

    switch (action) {
      case 'get_prices': {
        // Get all symbols or specific ones
        let query = supabase.from('symbols').select('*').eq('is_active', true);
        
        if (symbols && symbols.length > 0) {
          query = query.in('exchange_symbol', symbols);
        }

        const { data: symbolData, error } = await query;
        if (error) throw error;

        const prices = symbolData?.map(symbol => {
          const basePrice = basePrices[symbol.exchange_symbol] || 100;
          const currentPrice = generateMockPrice(basePrice);
          const change24h = (Math.random() - 0.5) * 10;
          
          return {
            symbol: symbol.symbol,
            exchange_symbol: symbol.exchange_symbol,
            asset_type: symbol.asset_type,
            price: currentPrice,
            change_24h: change24h,
            change_24h_percent: (change24h / basePrice) * 100,
            high_24h: currentPrice * 1.02,
            low_24h: currentPrice * 0.98,
            volume_24h: Math.random() * 1000000000,
            timestamp: new Date().toISOString(),
          };
        });

        return new Response(JSON.stringify({ prices }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_candles': {
        const { symbol, timeframe = '1h', limit = 100 } = await req.json();
        
        // Generate mock OHLCV data
        const now = Date.now();
        const intervals: Record<string, number> = {
          '1m': 60000,
          '5m': 300000,
          '15m': 900000,
          '1h': 3600000,
          '4h': 14400000,
          '1d': 86400000,
        };
        
        const interval = intervals[timeframe] || 3600000;
        const basePrice = basePrices[symbol] || 100;
        
        const candles = [];
        let lastClose = basePrice;
        
        for (let i = limit - 1; i >= 0; i--) {
          const timestamp = now - (i * interval);
          const open = lastClose;
          const volatility = 0.015;
          const close = generateMockPrice(open, volatility);
          const high = Math.max(open, close) * (1 + Math.random() * volatility);
          const low = Math.min(open, close) * (1 - Math.random() * volatility);
          const volume = Math.random() * 10000;
          
          candles.push({
            timestamp,
            open,
            high,
            low,
            close,
            volume,
          });
          
          lastClose = close;
        }

        return new Response(JSON.stringify({ candles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_orderbook': {
        const { symbol } = await req.json();
        const basePrice = basePrices[symbol] || 100;
        
        const bids = [];
        const asks = [];
        
        for (let i = 0; i < 10; i++) {
          bids.push({
            price: basePrice * (1 - (i + 1) * 0.001),
            quantity: Math.random() * 10,
          });
          asks.push({
            price: basePrice * (1 + (i + 1) * 0.001),
            quantity: Math.random() * 10,
          });
        }

        return new Response(JSON.stringify({ 
          symbol,
          bids: bids.sort((a, b) => b.price - a.price),
          asks: asks.sort((a, b) => a.price - b.price),
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Market data error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
