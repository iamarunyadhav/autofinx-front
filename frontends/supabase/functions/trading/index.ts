import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const body = await req.json();
    const { action } = body;

    console.log(`Trading request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'place_order': {
        const { workspace_id, symbol_id, side, order_type, quantity, price, stop_price, mode = 'paper' } = body;

        // Validate workspace membership
        const { data: member } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .single();

        if (!member) throw new Error('Not a workspace member');

        // Check global kill switch
        const { data: settings } = await supabase
          .from('system_settings')
          .select('global_trading_enabled')
          .eq('workspace_id', workspace_id)
          .single();

        if (settings && !settings.global_trading_enabled) {
          throw new Error('Trading is disabled globally');
        }

        // Generate client order ID
        const clientOrderId = `${workspace_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            workspace_id,
            symbol_id,
            client_order_id: clientOrderId,
            side,
            order_type,
            quantity,
            price,
            stop_price,
            mode,
            status: 'pending',
            submitted_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Log audit
        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'place_order',
          target_type: 'order',
          target_id: order.id,
          new_values: { side, order_type, quantity, price, mode },
        });

        // Simulate order execution for paper trading
        if (mode === 'paper') {
          await simulateOrderExecution(supabase, order, workspace_id, user.id);
        }

        return new Response(JSON.stringify({ order }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'cancel_order': {
        const { order_id, workspace_id } = body;

        const { data: order, error } = await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('id', order_id)
          .eq('workspace_id', workspace_id)
          .in('status', ['pending', 'submitted'])
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'cancel_order',
          target_type: 'order',
          target_id: order_id,
        });

        return new Response(JSON.stringify({ order }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_orders': {
        const { workspace_id, status, limit = 50 } = body;

        let query = supabase
          .from('orders')
          .select('*, symbols(*)')
          .eq('workspace_id', workspace_id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: orders, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ orders }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_positions': {
        const { workspace_id, mode = 'paper' } = body;

        const { data: positions, error } = await supabase
          .from('positions')
          .select('*, symbols(*)')
          .eq('workspace_id', workspace_id)
          .eq('mode', mode)
          .neq('quantity', 0);

        if (error) throw error;

        return new Response(JSON.stringify({ positions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_trades': {
        const { workspace_id, limit = 100 } = body;

        const { data: trades, error } = await supabase
          .from('trades')
          .select('*, orders!inner(*, symbols(*))')
          .eq('orders.workspace_id', workspace_id)
          .order('executed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(JSON.stringify({ trades }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Trading error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Simulate order execution for paper trading
async function simulateOrderExecution(supabase: any, order: any, workspace_id: string, user_id: string) {
  // Simulate a slight delay
  await new Promise(resolve => setTimeout(resolve, 100));

  // Get symbol price
  const { data: symbol } = await supabase
    .from('symbols')
    .select('exchange_symbol')
    .eq('id', order.symbol_id)
    .single();

  // Simulate fill price with slight slippage
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

  const basePrice = order.price || basePrices[symbol?.exchange_symbol] || 100;
  const slippage = order.side === 'buy' ? 1.001 : 0.999;
  const fillPrice = basePrice * slippage;
  const fee = order.quantity * fillPrice * 0.001; // 0.1% fee

  // Update order to filled
  await supabase
    .from('orders')
    .update({
      status: 'filled',
      filled_quantity: order.quantity,
      avg_fill_price: fillPrice,
      fees: fee,
      fee_currency: 'USDT',
      filled_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Create trade record
  await supabase
    .from('trades')
    .insert({
      order_id: order.id,
      trade_id: `sim-${Date.now()}`,
      quantity: order.quantity,
      price: fillPrice,
      fee,
      fee_currency: 'USDT',
    });

  // Update position
  const { data: existingPosition } = await supabase
    .from('positions')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('symbol_id', order.symbol_id)
    .eq('mode', order.mode)
    .single();

  if (existingPosition) {
    const newQty = order.side === 'buy' 
      ? Number(existingPosition.quantity) + Number(order.quantity)
      : Number(existingPosition.quantity) - Number(order.quantity);

    const newAvgPrice = order.side === 'buy' && existingPosition.quantity > 0
      ? (Number(existingPosition.avg_entry_price) * Number(existingPosition.quantity) + fillPrice * Number(order.quantity)) / newQty
      : fillPrice;

    await supabase
      .from('positions')
      .update({
        quantity: newQty,
        avg_entry_price: newAvgPrice,
        current_price: fillPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPosition.id);
  } else {
    await supabase
      .from('positions')
      .insert({
        workspace_id,
        symbol_id: order.symbol_id,
        quantity: order.side === 'buy' ? order.quantity : -order.quantity,
        avg_entry_price: fillPrice,
        current_price: fillPrice,
        mode: order.mode,
      });
  }

  // Create notification
  await supabase.from('notifications').insert({
    workspace_id,
    user_id,
    channel: 'in_app',
    title: `Order Filled: ${order.side.toUpperCase()}`,
    body: `${order.quantity} units filled at ${fillPrice.toFixed(4)}`,
    severity: 'success',
  });

  console.log(`Paper order ${order.id} simulated fill at ${fillPrice}`);
}
