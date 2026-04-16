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

    console.log(`Scheduler request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'get_schedules': {
        const { workspace_id } = body;

        const { data: schedules, error } = await supabase
          .from('strategy_schedules')
          .select(`
            *,
            strategy_instances (
              id,
              name,
              mode,
              is_enabled,
              strategies (name, strategy_type)
            )
          `)
          .eq('strategy_instances.workspace_id', workspace_id);

        if (error) throw error;

        return new Response(JSON.stringify({ schedules: schedules || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_schedule': {
        const { schedule_id } = body;

        const { data: schedule, error } = await supabase
          .from('strategy_schedules')
          .select(`
            *,
            strategy_instances (
              id,
              name,
              mode,
              is_enabled,
              workspace_id,
              strategies (name, strategy_type)
            )
          `)
          .eq('id', schedule_id)
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ schedule }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_schedule': {
        const { instance_id, schedule_data } = body;

        // Verify instance ownership
        const { data: instance } = await supabase
          .from('strategy_instances')
          .select('workspace_id')
          .eq('id', instance_id)
          .single();

        if (!instance) throw new Error('Strategy instance not found');

        const { data: schedule, error } = await supabase
          .from('strategy_schedules')
          .insert({
            instance_id,
            timezone: schedule_data.timezone || 'UTC',
            active_days: schedule_data.active_days || [1, 2, 3, 4, 5],
            start_time: schedule_data.start_time || '09:00',
            end_time: schedule_data.end_time || '17:00',
            evaluation_interval_ms: schedule_data.evaluation_interval_ms || 60000,
            cooldown_seconds: schedule_data.cooldown_seconds || 30,
            max_trades_per_hour: schedule_data.max_trades_per_hour || 10,
            max_trades_per_day: schedule_data.max_trades_per_day || 50,
            is_enabled: schedule_data.is_enabled ?? true,
          })
          .select()
          .single();

        if (error) throw error;

        console.log('Schedule created:', schedule.id);

        return new Response(JSON.stringify({ schedule }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_schedule': {
        const { schedule_id, schedule_data } = body;

        const { data: schedule, error } = await supabase
          .from('strategy_schedules')
          .update({
            ...schedule_data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schedule_id)
          .select()
          .single();

        if (error) throw error;

        console.log('Schedule updated:', schedule_id);

        return new Response(JSON.stringify({ schedule }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'toggle_schedule': {
        const { schedule_id, is_enabled } = body;

        const { data: schedule, error } = await supabase
          .from('strategy_schedules')
          .update({ 
            is_enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', schedule_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ schedule }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_schedule': {
        const { schedule_id } = body;

        const { error } = await supabase
          .from('strategy_schedules')
          .delete()
          .eq('id', schedule_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'simulate_schedule': {
        const { schedule_data } = body;
        
        // Simulate next 24 hours of schedule
        const now = new Date();
        const slots: Array<{ start: string; end: string; active: boolean }> = [];
        
        for (let hour = 0; hour < 24; hour++) {
          const slotTime = new Date(now);
          slotTime.setHours(hour, 0, 0, 0);
          
          const dayOfWeek = slotTime.getDay() || 7; // Convert Sunday from 0 to 7
          const timeStr = `${hour.toString().padStart(2, '0')}:00`;
          
          const isActiveDay = schedule_data.active_days?.includes(dayOfWeek) ?? true;
          const startTime = schedule_data.start_time || '09:00';
          const endTime = schedule_data.end_time || '17:00';
          
          let isActiveTime = false;
          if (endTime > startTime) {
            isActiveTime = timeStr >= startTime && timeStr < endTime;
          } else {
            // Crosses midnight
            isActiveTime = timeStr >= startTime || timeStr < endTime;
          }
          
          slots.push({
            start: timeStr,
            end: `${(hour + 1).toString().padStart(2, '0')}:00`,
            active: isActiveDay && isActiveTime && (schedule_data.is_enabled ?? true),
          });
        }

        return new Response(JSON.stringify({ 
          simulation: {
            slots,
            active_hours: slots.filter(s => s.active).length,
            max_trades_possible: slots.filter(s => s.active).length * (schedule_data.max_trades_per_hour || 10),
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Scheduler error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
