import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const body = await req.json();
    const { action } = body;

    console.log(`AI Assistant request: ${action}`, { user_id: user.id });

    switch (action) {
      case 'chat': {
        const { workspace_id, message, session_id, context } = body;

        // Get or create session
        let session;
        if (session_id) {
          const { data } = await supabase
            .from('assistant_sessions')
            .select('*')
            .eq('id', session_id)
            .single();
          session = data;
        }

        if (!session) {
          const { data: newSession } = await supabase
            .from('assistant_sessions')
            .insert({
              workspace_id,
              user_id: user.id,
              mode: 'suggest',
              messages: [],
            })
            .select()
            .single();
          session = newSession;
        }

        // Build context for AI
        const systemPrompt = `You are AutoFinX AI Assistant, an expert in autonomous trading, cryptocurrency, and stock markets.

Your capabilities:
- Explain trading strategies and market analysis
- Help configure trading bots and risk parameters
- Analyze portfolio performance
- Suggest optimizations for trading strategies
- Explain why trades happened and market movements

Current context:
- Workspace: ${workspace_id}
- Mode: ${session?.mode || 'suggest'} (suggest = advice only, execute = can make changes)

Guidelines:
- Be concise and actionable
- Use trading terminology appropriately
- Prioritize risk management in advice
- Never make unauthorized trades or changes
- Always explain risks clearly

${context ? `Additional context: ${JSON.stringify(context)}` : ''}`;

        const messages = [
          { role: 'system', content: systemPrompt },
          ...((session?.messages as Array<{ role: string; content: string }>) || []).slice(-10),
          { role: 'user', content: message },
        ];

        // Call Lovable AI
        const aiResponse = await fetch(LOVABLE_AI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages,
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', errorText);
          throw new Error('Failed to get AI response');
        }

        const aiData = await aiResponse.json();
        const assistantMessage = aiData.choices?.[0]?.message?.content || 'I apologize, I could not generate a response.';

        // Update session with new messages
        const updatedMessages = [
          ...((session?.messages as Array<{ role: string; content: string }>) || []),
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage },
        ];

        await supabase
          .from('assistant_sessions')
          .update({
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        return new Response(JSON.stringify({
          message: assistantMessage,
          session_id: session.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'analyze_strategy': {
        const { workspace_id, instance_id } = body;

        // Get strategy instance with orders
        const { data: instance } = await supabase
          .from('strategy_instances')
          .select('*, strategies(*)')
          .eq('id', instance_id)
          .single();

        // Get recent orders
        const { data: orders } = await supabase
          .from('orders')
          .select('*')
          .eq('instance_id', instance_id)
          .order('created_at', { ascending: false })
          .limit(20);

        const winRate = orders?.filter(o => (o.metadata as Record<string, number>)?.pnl > 0).length || 0;
        const totalOrders = orders?.length || 1;

        const analysisPrompt = `Analyze this trading strategy:
        
Strategy: ${instance?.strategies?.name}
Type: ${instance?.strategies?.strategy_type}
Mode: ${instance?.mode}
Parameters: ${JSON.stringify(instance?.params)}

Recent performance:
- Total orders: ${totalOrders}
- Win rate: ${(winRate / totalOrders * 100).toFixed(1)}%
- Orders: ${JSON.stringify(orders?.slice(0, 5))}

Provide:
1. Performance assessment
2. Parameter optimization suggestions
3. Risk considerations
4. Market conditions suitability`;

        const aiResponse = await fetch(LOVABLE_AI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are an expert trading strategy analyst. Provide concise, actionable insights.' },
              { role: 'user', content: analysisPrompt },
            ],
            max_tokens: 1024,
          }),
        });

        const aiData = await aiResponse.json();
        const analysis = aiData.choices?.[0]?.message?.content || 'Analysis unavailable';

        return new Response(JSON.stringify({ analysis }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'explain_trade': {
        const { order_id } = body;

        const { data: order } = await supabase
          .from('orders')
          .select('*, symbols(*), strategy_instances(*, strategies(*))')
          .eq('id', order_id)
          .single();

        if (!order) throw new Error('Order not found');

        const explainPrompt = `Explain why this trade was executed:

Order Details:
- Symbol: ${order.symbols?.symbol}
- Side: ${order.side}
- Type: ${order.order_type}
- Quantity: ${order.quantity}
- Price: ${order.price || order.avg_fill_price}
- Status: ${order.status}
- Strategy: ${order.strategy_instances?.strategies?.name || 'Manual'}
- Strategy Type: ${order.strategy_instances?.strategies?.strategy_type || 'N/A'}
- Parameters: ${JSON.stringify(order.strategy_instances?.params || {})}
- Executed: ${order.filled_at || order.created_at}

Explain in simple terms:
1. Why the strategy triggered this trade
2. What market conditions likely led to this signal
3. The expected outcome based on strategy type`;

        const aiResponse = await fetch(LOVABLE_AI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are a trading expert explaining autonomous trade decisions to users.' },
              { role: 'user', content: explainPrompt },
            ],
            max_tokens: 512,
          }),
        });

        const aiData = await aiResponse.json();
        const explanation = aiData.choices?.[0]?.message?.content || 'Explanation unavailable';

        return new Response(JSON.stringify({ explanation }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_sessions': {
        const { workspace_id } = body;

        const { data: sessions, error } = await supabase
          .from('assistant_sessions')
          .select('id, created_at, updated_at, mode')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        return new Response(JSON.stringify({ sessions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('AI Assistant error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
