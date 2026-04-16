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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const body = await req.json();
    const { action } = body;

    console.log(`Wallet request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'get_balances': {
        const { workspace_id } = body;

        const { data: ledgers, error } = await supabase
          .from('ledgers')
          .select('*')
          .eq('workspace_id', workspace_id);

        if (error) throw error;

        // If no ledgers exist, create default ones
        if (!ledgers || ledgers.length === 0) {
          const defaultCurrencies = ['USDT', 'USD', 'BTC', 'ETH'];
          const newLedgers = await Promise.all(
            defaultCurrencies.map(currency =>
              supabase
                .from('ledgers')
                .insert({
                  workspace_id,
                  currency,
                  balance: currency === 'USDT' || currency === 'USD' ? 10000 : 0,
                  available_balance: currency === 'USDT' || currency === 'USD' ? 10000 : 0,
                })
                .select()
                .single()
            )
          );

          return new Response(JSON.stringify({ 
            balances: newLedgers.map(l => l.data).filter(Boolean)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ balances: ledgers }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'deposit': {
        const { workspace_id, currency, amount, description } = body;

        if (amount <= 0) throw new Error('Invalid amount');

        // Get or create ledger
        let { data: ledger } = await supabase
          .from('ledgers')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('currency', currency)
          .single();

        if (!ledger) {
          const { data: newLedger, error: createError } = await supabase
            .from('ledgers')
            .insert({ workspace_id, currency, balance: 0, available_balance: 0 })
            .select()
            .single();
          if (createError) throw createError;
          ledger = newLedger;
        }

        const newBalance = Number(ledger.balance) + Number(amount);
        const newAvailable = Number(ledger.available_balance) + Number(amount);

        // Update ledger
        await supabase
          .from('ledgers')
          .update({
            balance: newBalance,
            available_balance: newAvailable,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ledger.id);

        // Create transaction
        const idempotencyKey = `deposit-${workspace_id}-${currency}-${Date.now()}`;
        const { data: tx, error: txError } = await supabase
          .from('ledger_transactions')
          .insert({
            workspace_id,
            tx_type: 'deposit',
            amount,
            currency,
            balance_after: newBalance,
            description: description || 'Deposit',
            idempotency_key: idempotencyKey,
          })
          .select()
          .single();

        if (txError) throw txError;

        // Audit log
        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'deposit',
          target_type: 'ledger',
          target_id: ledger.id,
          new_values: { amount, currency, balance_after: newBalance },
        });

        // Notification
        await supabase.from('notifications').insert({
          workspace_id,
          user_id: user.id,
          channel: 'in_app',
          title: 'Deposit Successful',
          body: `${amount} ${currency} has been credited to your account`,
          severity: 'success',
        });

        return new Response(JSON.stringify({ 
          transaction: tx,
          new_balance: newBalance,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'withdraw': {
        const { workspace_id, currency, amount, description } = body;

        if (amount <= 0) throw new Error('Invalid amount');

        const { data: ledger } = await supabase
          .from('ledgers')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('currency', currency)
          .single();

        if (!ledger) throw new Error('Ledger not found');
        if (Number(ledger.available_balance) < amount) {
          throw new Error('Insufficient balance');
        }

        const newBalance = Number(ledger.balance) - Number(amount);
        const newAvailable = Number(ledger.available_balance) - Number(amount);

        await supabase
          .from('ledgers')
          .update({
            balance: newBalance,
            available_balance: newAvailable,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ledger.id);

        const idempotencyKey = `withdraw-${workspace_id}-${currency}-${Date.now()}`;
        const { data: tx, error: txError } = await supabase
          .from('ledger_transactions')
          .insert({
            workspace_id,
            tx_type: 'withdrawal',
            amount: -amount,
            currency,
            balance_after: newBalance,
            description: description || 'Withdrawal',
            idempotency_key: idempotencyKey,
          })
          .select()
          .single();

        if (txError) throw txError;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'withdraw',
          target_type: 'ledger',
          target_id: ledger.id,
          new_values: { amount, currency, balance_after: newBalance },
        });

        await supabase.from('notifications').insert({
          workspace_id,
          user_id: user.id,
          channel: 'in_app',
          title: 'Withdrawal Processed',
          body: `${amount} ${currency} withdrawal initiated`,
          severity: 'info',
        });

        return new Response(JSON.stringify({ 
          transaction: tx,
          new_balance: newBalance,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_transactions': {
        const { workspace_id, currency, limit = 50 } = body;

        let query = supabase
          .from('ledger_transactions')
          .select('*')
          .eq('workspace_id', workspace_id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (currency) {
          query = query.eq('currency', currency);
        }

        const { data: transactions, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ transactions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'transfer': {
        const { workspace_id, from_currency, to_currency, amount } = body;

        if (amount <= 0) throw new Error('Invalid amount');

        const { data: fromLedger } = await supabase
          .from('ledgers')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('currency', from_currency)
          .single();

        if (!fromLedger || Number(fromLedger.available_balance) < amount) {
          throw new Error('Insufficient balance');
        }

        // Deduct from source
        const fromNewBalance = Number(fromLedger.balance) - Number(amount);
        await supabase
          .from('ledgers')
          .update({
            balance: fromNewBalance,
            available_balance: Number(fromLedger.available_balance) - Number(amount),
          })
          .eq('id', fromLedger.id);

        // Get or create destination ledger
        let { data: toLedger } = await supabase
          .from('ledgers')
          .select('*')
          .eq('workspace_id', workspace_id)
          .eq('currency', to_currency)
          .single();

        if (!toLedger) {
          const { data: newLedger } = await supabase
            .from('ledgers')
            .insert({ workspace_id, currency: to_currency, balance: 0, available_balance: 0 })
            .select()
            .single();
          toLedger = newLedger;
        }

        const toNewBalance = Number(toLedger.balance) + Number(amount);
        await supabase
          .from('ledgers')
          .update({
            balance: toNewBalance,
            available_balance: Number(toLedger.available_balance) + Number(amount),
          })
          .eq('id', toLedger.id);

        // Create transaction records
        const timestamp = Date.now();
        await supabase.from('ledger_transactions').insert([
          {
            workspace_id,
            tx_type: 'transfer',
            amount: -amount,
            currency: from_currency,
            balance_after: fromNewBalance,
            description: `Transfer to ${to_currency}`,
            idempotency_key: `transfer-out-${timestamp}`,
          },
          {
            workspace_id,
            tx_type: 'transfer',
            amount,
            currency: to_currency,
            balance_after: toNewBalance,
            description: `Transfer from ${from_currency}`,
            idempotency_key: `transfer-in-${timestamp}`,
          },
        ]);

        return new Response(JSON.stringify({ 
          success: true,
          from_balance: fromNewBalance,
          to_balance: toNewBalance,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Wallet error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
