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

    console.log(`Notification request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'get_notifications': {
        const { workspace_id, unread_only = false, limit = 50 } = body;

        let query = supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (workspace_id) {
          query = query.eq('workspace_id', workspace_id);
        }

        if (unread_only) {
          query = query.eq('is_read', false);
        }

        const { data: notifications, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ notifications }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'mark_read': {
        const { notification_ids } = body;

        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in('id', notification_ids)
          .eq('user_id', user.id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'mark_all_read': {
        const { workspace_id } = body;

        let query = supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (workspace_id) {
          query = query.eq('workspace_id', workspace_id);
        }

        const { error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_settings': {
        const { workspace_id } = body;

        let { data: settings } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('user_id', user.id)
          .eq('workspace_id', workspace_id)
          .single();

        if (!settings) {
          // Create default settings
          const { data: newSettings } = await supabase
            .from('notification_settings')
            .insert({
              user_id: user.id,
              workspace_id,
            })
            .select()
            .single();
          settings = newSettings;
        }

        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_settings': {
        const { workspace_id, updates } = body;

        const { data: settings, error } = await supabase
          .from('notification_settings')
          .update(updates)
          .eq('user_id', user.id)
          .eq('workspace_id', workspace_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'send_notification': {
        const { workspace_id, user_ids, title, body: notifBody, severity = 'info', channel = 'in_app' } = body;

        const notifications = user_ids.map((userId: string) => ({
          workspace_id,
          user_id: userId,
          channel,
          title,
          body: notifBody,
          severity,
        }));

        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, count: user_ids.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_unread_count': {
        const { workspace_id } = body;

        let query = supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (workspace_id) {
          query = query.eq('workspace_id', workspace_id);
        }

        const { count, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ count: count || 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Notification error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
