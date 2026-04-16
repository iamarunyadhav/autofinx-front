import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  connectionId: string;
}

interface ExchangeBalance {
  currency: string;
  available: number;
  locked: number;
  total: number;
}

// Simulated exchange API responses - in production, these would call real exchange APIs
async function fetchBinanceBalances(_apiKey: string, _apiSecret: string, isTestnet: boolean): Promise<ExchangeBalance[]> {
  console.log(`Fetching Binance balances (testnet: ${isTestnet})`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 0.5234, locked: 0.1, total: 0.6234 },
    { currency: 'ETH', available: 2.456, locked: 0, total: 2.456 },
    { currency: 'USDT', available: 15420.50, locked: 500, total: 15920.50 },
    { currency: 'BNB', available: 12.34, locked: 0, total: 12.34 },
  ];
}

async function fetchCoinbaseBalances(_apiKey: string, _apiSecret: string): Promise<ExchangeBalance[]> {
  console.log('Fetching Coinbase balances');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 1.234, locked: 0, total: 1.234 },
    { currency: 'ETH', available: 5.678, locked: 0.5, total: 6.178 },
    { currency: 'USDC', available: 25000, locked: 0, total: 25000 },
  ];
}

async function fetchKrakenBalances(_apiKey: string, _apiSecret: string): Promise<ExchangeBalance[]> {
  console.log('Fetching Kraken balances');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 0.789, locked: 0, total: 0.789 },
    { currency: 'ETH', available: 3.21, locked: 0.2, total: 3.41 },
    { currency: 'USD', available: 8500, locked: 1500, total: 10000 },
  ];
}

async function fetchBybitBalances(_apiKey: string, _apiSecret: string): Promise<ExchangeBalance[]> {
  console.log('Fetching Bybit balances');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 0.45, locked: 0.05, total: 0.5 },
    { currency: 'USDT', available: 12000, locked: 3000, total: 15000 },
  ];
}

async function fetchOKXBalances(_apiKey: string, _apiSecret: string): Promise<ExchangeBalance[]> {
  console.log('Fetching OKX balances');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 0.333, locked: 0, total: 0.333 },
    { currency: 'ETH', available: 1.5, locked: 0.5, total: 2.0 },
    { currency: 'USDT', available: 5000, locked: 0, total: 5000 },
  ];
}

async function fetchKuCoinBalances(_apiKey: string, _apiSecret: string): Promise<ExchangeBalance[]> {
  console.log('Fetching KuCoin balances');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return [
    { currency: 'BTC', available: 0.25, locked: 0, total: 0.25 },
    { currency: 'KCS', available: 100, locked: 0, total: 100 },
    { currency: 'USDT', available: 7500, locked: 500, total: 8000 },
  ];
}

async function fetchExchangeBalances(
  provider: string,
  apiKey: string,
  apiSecret: string,
  isTestnet: boolean
): Promise<ExchangeBalance[]> {
  switch (provider.toLowerCase()) {
    case 'binance':
      return fetchBinanceBalances(apiKey, apiSecret, isTestnet);
    case 'coinbase':
      return fetchCoinbaseBalances(apiKey, apiSecret);
    case 'kraken':
      return fetchKrakenBalances(apiKey, apiSecret);
    case 'bybit':
      return fetchBybitBalances(apiKey, apiSecret);
    case 'okx':
      return fetchOKXBalances(apiKey, apiSecret);
    case 'kucoin':
      return fetchKuCoinBalances(apiKey, apiSecret);
    default:
      throw new Error(`Unsupported exchange: ${provider}`);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { connectionId } = await req.json() as SyncRequest;

    if (!connectionId) {
      return new Response(
        JSON.stringify({ error: 'Connection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Syncing connection: ${connectionId}`);

    // Fetch the connection details
    const { data: connection, error: fetchError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      console.error('Connection not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Connection not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Connection is disabled' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch balances from the exchange
    const balances = await fetchExchangeBalances(
      connection.provider,
      connection.api_key_encrypted || '',
      connection.api_secret_encrypted || '',
      connection.is_testnet || false
    );

    console.log(`Retrieved ${balances.length} balances from ${connection.provider}`);

    // Update last_synced_at timestamp
    const { error: updateError } = await supabase
      .from('exchange_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (updateError) {
      console.error('Failed to update sync timestamp:', updateError);
    }

    // Upsert ledger entries for each balance
    for (const balance of balances) {
      const { error: ledgerError } = await supabase
        .from('ledgers')
        .upsert({
          workspace_id: connection.workspace_id,
          currency: balance.currency,
          balance: balance.total,
          available_balance: balance.available,
          locked_balance: balance.locked,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id,currency',
        });

      if (ledgerError) {
        console.error(`Failed to upsert ledger for ${balance.currency}:`, ledgerError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        balances,
        syncedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
