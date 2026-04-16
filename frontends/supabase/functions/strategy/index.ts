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

    console.log(`Strategy request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'get_strategies': {
        const { data: strategies, error } = await supabase
          .from('strategies')
          .select('*')
          .or(`is_public.eq.true,author_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ strategies }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_instances': {
        const { workspace_id } = body;

        const { data: instances, error } = await supabase
          .from('strategy_instances')
          .select(`
            *,
            strategies(*),
            strategy_schedules(*),
            instance_risk_profiles(*, risk_profiles(*))
          `)
          .eq('workspace_id', workspace_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ instances }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_instance': {
        const { workspace_id, strategy_id, name, mode = 'paper', params = {} } = body;

        const { data: instance, error } = await supabase
          .from('strategy_instances')
          .insert({
            workspace_id,
            strategy_id,
            name,
            mode,
            params,
            is_enabled: false,
          })
          .select()
          .single();

        if (error) throw error;

        // Create default schedule
        await supabase.from('strategy_schedules').insert({
          instance_id: instance.id,
          timezone: 'UTC',
          is_enabled: true,
        });

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'create_strategy_instance',
          target_type: 'strategy_instance',
          target_id: instance.id,
          new_values: { name, mode, strategy_id },
        });

        return new Response(JSON.stringify({ instance }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle_instance': {
        const { instance_id, workspace_id, is_enabled } = body;

        // Check risk limits before enabling
        if (is_enabled) {
          const { data: settings } = await supabase
            .from('system_settings')
            .select('global_trading_enabled, max_concurrent_strategies')
            .eq('workspace_id', workspace_id)
            .single();

          if (settings && !settings.global_trading_enabled) {
            throw new Error('Global trading is disabled');
          }

          // Count active strategies
          const { count } = await supabase
            .from('strategy_instances')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspace_id)
            .eq('is_enabled', true);

          if (settings?.max_concurrent_strategies && count && count >= settings.max_concurrent_strategies) {
            throw new Error(`Maximum ${settings.max_concurrent_strategies} concurrent strategies allowed`);
          }
        }

        const { data: instance, error } = await supabase
          .from('strategy_instances')
          .update({ is_enabled })
          .eq('id', instance_id)
          .eq('workspace_id', workspace_id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: is_enabled ? 'enable_strategy' : 'disable_strategy',
          target_type: 'strategy_instance',
          target_id: instance_id,
        });

        await supabase.from('notifications').insert({
          workspace_id,
          user_id: user.id,
          channel: 'in_app',
          title: is_enabled ? 'Strategy Enabled' : 'Strategy Disabled',
          body: `${instance.name} has been ${is_enabled ? 'started' : 'stopped'}`,
          severity: is_enabled ? 'success' : 'info',
        });

        return new Response(JSON.stringify({ instance }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_params': {
        const { instance_id, workspace_id, params } = body;

        const { data: instance, error } = await supabase
          .from('strategy_instances')
          .update({ params })
          .eq('id', instance_id)
          .eq('workspace_id', workspace_id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'update_strategy_params',
          target_type: 'strategy_instance',
          target_id: instance_id,
          new_values: params,
        });

        return new Response(JSON.stringify({ instance }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_schedule': {
        const { instance_id, schedule } = body;

        const { data: updated, error } = await supabase
          .from('strategy_schedules')
          .update(schedule)
          .eq('instance_id', instance_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ schedule: updated }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set_mode': {
        const { instance_id, workspace_id, mode } = body;

        if (!['paper', 'live'].includes(mode)) {
          throw new Error('Invalid mode. Must be paper or live');
        }

        // Require confirmation for switching to live
        if (mode === 'live') {
          const { data: instance } = await supabase
            .from('strategy_instances')
            .select('name')
            .eq('id', instance_id)
            .single();

          console.log(`⚠️ Promoting ${instance?.name} to LIVE mode`);
        }

        const { data: instance, error } = await supabase
          .from('strategy_instances')
          .update({ mode, is_enabled: false }) // Always disable when switching modes
          .eq('id', instance_id)
          .eq('workspace_id', workspace_id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'change_trading_mode',
          target_type: 'strategy_instance',
          target_id: instance_id,
          new_values: { mode },
        });

        await supabase.from('notifications').insert({
          workspace_id,
          user_id: user.id,
          channel: 'in_app',
          title: `Mode Changed to ${mode.toUpperCase()}`,
          body: `${instance.name} is now in ${mode} trading mode`,
          severity: mode === 'live' ? 'warning' : 'info',
        });

        return new Response(JSON.stringify({ instance }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_instance': {
        const { instance_id, workspace_id } = body;

        const { error } = await supabase
          .from('strategy_instances')
          .delete()
          .eq('id', instance_id)
          .eq('workspace_id', workspace_id);

        if (error) throw error;

        await supabase.from('audit_logs').insert({
          workspace_id,
          actor_type: 'user',
          actor_id: user.id,
          action: 'delete_strategy_instance',
          target_type: 'strategy_instance',
          target_id: instance_id,
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Strategy error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
