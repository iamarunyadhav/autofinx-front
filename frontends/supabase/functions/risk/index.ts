import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Risk validation functions
function checkPositionSize(
  orderValue: number,
  portfolioValue: number,
  maxPositionPercent: number
): { valid: boolean; reason?: string } {
  const positionPercent = (orderValue / portfolioValue) * 100;
  if (positionPercent > maxPositionPercent) {
    return {
      valid: false,
      reason: `Position size ${positionPercent.toFixed(2)}% exceeds max ${maxPositionPercent}%`,
    };
  }
  return { valid: true };
}

function checkDailyLoss(
  dailyPnL: number,
  portfolioValue: number,
  maxDailyLossPercent: number
): { valid: boolean; reason?: string } {
  const lossPercent = (Math.abs(dailyPnL) / portfolioValue) * 100;
  if (dailyPnL < 0 && lossPercent > maxDailyLossPercent) {
    return {
      valid: false,
      reason: `Daily loss ${lossPercent.toFixed(2)}% exceeds max ${maxDailyLossPercent}%`,
    };
  }
  return { valid: true };
}

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

    console.log(`Risk request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'get_profiles': {
        const { workspace_id } = body;

        const { data: profiles, error } = await supabase
          .from('risk_profiles')
          .select('*')
          .eq('workspace_id', workspace_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ profiles }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_profile': {
        const { workspace_id, name, limits } = body;

        const { data: profile, error } = await supabase
          .from('risk_profiles')
          .insert({
            workspace_id,
            name,
            max_position_percent: limits.max_position_percent || 10,
            max_daily_loss_percent: limits.max_daily_loss_percent || 5,
            max_drawdown_percent: limits.max_drawdown_percent || 15,
            max_leverage: limits.max_leverage || 1,
            stop_loss_percent: limits.stop_loss_percent || 2,
            take_profit_percent: limits.take_profit_percent || 5,
            slippage_tolerance: limits.slippage_tolerance || 0.005,
            settings: limits.settings || {},
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'create_risk_profile',
          target_type: 'risk_profile',
          target_id: profile.id,
          new_values: { name, limits },
        });

        return new Response(JSON.stringify({ profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_profile': {
        const { profile_id, workspace_id, updates } = body;

        const { data: profile, error } = await supabase
          .from('risk_profiles')
          .update(updates)
          .eq('id', profile_id)
          .eq('workspace_id', workspace_id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'update_risk_profile',
          target_type: 'risk_profile',
          target_id: profile_id,
          new_values: updates,
        });

        return new Response(JSON.stringify({ profile }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'validate_order': {
        const { workspace_id, order_value, profile_id } = body;

        // Get risk profile
        const { data: profile } = await supabase
          .from('risk_profiles')
          .select('*')
          .eq('id', profile_id)
          .single();

        if (!profile) {
          throw new Error('Risk profile not found');
        }

        // Get portfolio value from ledgers
        const { data: ledgers } = await supabase
          .from('ledgers')
          .select('balance, currency')
          .eq('workspace_id', workspace_id);

        const portfolioValue = ledgers?.reduce((sum, l) => sum + Number(l.balance), 0) || 0;

        // Get daily P&L
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: todayTrades } = await supabase
          .from('ledger_transactions')
          .select('amount')
          .eq('workspace_id', workspace_id)
          .eq('tx_type', 'pnl')
          .gte('created_at', today.toISOString());

        const dailyPnL = todayTrades?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Run validations
        const validations = [];

        const positionCheck = checkPositionSize(
          order_value,
          portfolioValue,
          Number(profile.max_position_percent)
        );
        validations.push({ rule: 'position_size', ...positionCheck });

        const dailyLossCheck = checkDailyLoss(
          dailyPnL,
          portfolioValue,
          Number(profile.max_daily_loss_percent)
        );
        validations.push({ rule: 'daily_loss', ...dailyLossCheck });

        const allValid = validations.every(v => v.valid);

        if (!allValid) {
          // Create notification for blocked trade
          await supabase.from('notifications').insert({
            workspace_id,
            user_id: user.id,
            channel: 'in_app',
            title: 'Trade Blocked by Risk Engine',
            body: validations.filter(v => !v.valid).map(v => v.reason).join('; '),
            severity: 'warning',
          });
        }

        return new Response(JSON.stringify({
          valid: allValid,
          validations,
          portfolio_value: portfolioValue,
          daily_pnl: dailyPnL,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'global_kill_switch': {
        const { workspace_id, enabled } = body;

        // Update system settings
        const { error } = await supabase
          .from('system_settings')
          .update({ global_trading_enabled: enabled })
          .eq('workspace_id', workspace_id);

        if (error) throw error;

        // If disabling, also disable all strategy instances
        if (!enabled) {
          await supabase
            .from('strategy_instances')
            .update({ is_enabled: false })
            .eq('workspace_id', workspace_id);
        }

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: enabled ? 'enable_global_trading' : 'disable_global_trading',
          target_type: 'system_settings',
          target_id: workspace_id,
        });

        await supabase.from('notifications').insert({
          workspace_id,
          user_id: user.id,
          channel: 'in_app',
          title: enabled ? '🟢 Trading Enabled' : '🔴 Trading Disabled',
          body: enabled 
            ? 'Global trading has been enabled' 
            : 'KILL SWITCH ACTIVATED - All trading has been stopped',
          severity: enabled ? 'success' : 'critical',
        });

        console.log(`🚨 Global kill switch: trading ${enabled ? 'ENABLED' : 'DISABLED'} for workspace ${workspace_id}`);

        return new Response(JSON.stringify({ 
          success: true, 
          global_trading_enabled: enabled 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_system_settings': {
        const { workspace_id } = body;

        let { data: settings } = await supabase
          .from('system_settings')
          .select('*')
          .eq('workspace_id', workspace_id)
          .single();

        if (!settings) {
          // Create default settings
          const { data: newSettings } = await supabase
            .from('system_settings')
            .insert({
              workspace_id,
              global_trading_enabled: true,
              maintenance_mode: false,
              max_concurrent_strategies: 10,
            })
            .select()
            .single();
          settings = newSettings;
        }

        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Risk error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
