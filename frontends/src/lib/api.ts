import { authHeaders } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

type RequestOptions = {
  params?: Record<string, unknown>;
};

function buildUrl(path: string, options?: RequestOptions) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(options?.params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export async function authorizedFetch(path: string, method: string = 'GET', body?: unknown, options?: RequestOptions) {
  const headers: Record<string, string> = await authHeaders();

  const response = await fetch(buildUrl(path, options), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

  if (!response.ok) {
    const message = parsed?.message || raw || 'API error';
    throw new Error(message);
  }

  return parsed ?? {};
}

type ApiResponse<T> = { data: T };

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

async function apiRequest<T>(path: string, method: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
  const data = await authorizedFetch(normalizePath(path), method, body, options);
  return { data: data as T };
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return apiRequest<T>(path, 'GET', undefined, options);
  },
  post<T>(path: string, body?: any) {
    return apiRequest<T>(path, 'POST', body);
  },
  put<T>(path: string, body?: any) {
    return apiRequest<T>(path, 'PUT', body);
  },
  patch<T>(path: string, body?: any) {
    return apiRequest<T>(path, 'PATCH', body);
  },
  delete<T>(path: string, body?: any) {
    return apiRequest<T>(path, 'DELETE', body);
  },
};

export async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, any>
): Promise<T> {
  switch (functionName) {
    case 'strategy':
      return handleStrategy(body) as Promise<T>;
    case 'scheduler':
      return handleScheduler(body) as Promise<T>;
    case 'risk':
      return handleRisk(body) as Promise<T>;
    case 'trading':
      return handleTrading(body) as Promise<T>;
    case 'wallet':
      return handleWallet(body) as Promise<T>;
    case 'notifications':
      return handleNotifications(body) as Promise<T>;
    case 'ai-assistant':
      return handleAssistant(body) as Promise<T>;
    case 'live-bots':
      return handleLiveBots(body) as Promise<T>;
    default:
      throw new Error(`Function ${functionName} not implemented`);
  }
}

export async function callPublicEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  return callEdgeFunction<T>(functionName, body as Record<string, any>);
}

async function handleStrategy(body: Record<string, any>) {
  switch (body.action) {
    case 'get_strategies': {
      const data = await authorizedFetch('/strategies', 'GET');
      return { strategies: data || [] };
    }
    case 'get_instances': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/strategy-instances`, 'GET');
      return { instances: data || [] };
    }
    case 'create_instance': {
      const instance = await authorizedFetch(`/workspaces/${body.workspace_id}/strategy-instances`, 'POST', {
        strategy_id: body.strategy_id,
        name: body.name,
        mode: body.mode || 'paper',
        status: 'running',
        params: body.params || {},
      });
      return { instance };
    }
    case 'toggle_instance': {
      const instance = await authorizedFetch(`/strategy-instances/${body.instance_id}`, 'PUT', {
        status: body.is_enabled ? 'running' : 'stopped',
      });
      return { instance };
    }
    case 'update_params': {
      const instance = await authorizedFetch(`/strategy-instances/${body.instance_id}`, 'PUT', {
        params: body.params,
      });
      return { instance };
    }
    case 'set_mode': {
      const instance = await authorizedFetch(`/strategy-instances/${body.instance_id}`, 'PUT', {
        mode: body.mode,
      });
      return { instance };
    }
    case 'delete_instance': {
      await authorizedFetch(`/strategy-instances/${body.instance_id}`, 'DELETE');
      return { success: true };
    }
    case 'run_backtest': {
      const result = await authorizedFetch(`/strategy-instances/${body.instance_id}/backtest`, 'POST', {
        symbol: body.symbol,
        candle_timeframe: body.candle_timeframe || '1h',
        limit: body.limit,
        initial_capital: body.initial_capital,
        position_size_pct: body.position_size_pct,
        fee_bps: body.fee_bps,
        slippage_bps: body.slippage_bps,
        stop_loss_pct: body.stop_loss_pct,
        take_profit_pct: body.take_profit_pct,
        time_stop_candles: body.time_stop_candles,
      });
      return { result };
    }
    default:
      throw new Error('Unknown strategy action');
  }
}

async function handleScheduler(body: Record<string, any>) {
  switch (body.action) {
    case 'get_schedules': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/schedules`, 'GET');
      return { schedules: data || [] };
    }
    case 'create_schedule': {
      const schedule = await authorizedFetch(`/workspaces/${body.schedule_data.workspace_id || body.workspace_id}/schedules`, 'POST', {
        name: body.schedule_data.name || 'Strategy Schedule',
        window_json: {
          timezone: body.schedule_data.timezone || 'Asia/Colombo',
          days: body.schedule_data.active_days || [1, 2, 3, 4, 5, 6, 0],
          start: body.schedule_data.start_time || '00:00',
          end: body.schedule_data.end_time || '23:59',
        },
        interval_ms: body.schedule_data.evaluation_interval_ms || 60000,
        cooldown_s: body.schedule_data.cooldown_seconds || 30,
        max_trades_json: {
          per_hour: body.schedule_data.max_trades_per_hour || 3,
          per_day: body.schedule_data.max_trades_per_day || 20,
        },
        enabled: body.schedule_data.is_enabled ?? true,
      });
      return { schedule };
    }
    case 'update_schedule': {
      const schedule = await authorizedFetch(`/schedules/${body.schedule_id}`, 'PUT', {
        window_json: body.schedule_data,
        interval_ms: body.schedule_data.evaluation_interval_ms,
        cooldown_s: body.schedule_data.cooldown_seconds,
        max_trades_json: {
          per_hour: body.schedule_data.max_trades_per_hour,
          per_day: body.schedule_data.max_trades_per_day,
        },
        enabled: body.schedule_data.is_enabled,
      });
      return { schedule };
    }
    case 'toggle_schedule': {
      const schedule = await authorizedFetch(`/schedules/${body.schedule_id}`, 'PUT', { enabled: body.is_enabled });
      return { schedule };
    }
    case 'delete_schedule': {
      await authorizedFetch(`/schedules/${body.schedule_id}`, 'DELETE');
      return { success: true };
    }
    case 'simulate_schedule': {
      const payload = body.schedule_data || {};
      const simulation = await authorizedFetch('/schedule/simulate', 'POST', {
        window_json: payload.window_json || {
          days: payload.days || payload.active_days || [1, 2, 3, 4, 5, 6, 0],
          start: payload.start || payload.start_time || '00:00',
          end: payload.end || payload.end_time || '23:59',
        },
        interval_ms: payload.interval_ms || payload.evaluation_interval_ms || 60000,
        cooldown_s: payload.cooldown_s || payload.cooldown_seconds || 0,
        max_trades_json: payload.max_trades_json || {
          per_hour: payload.max_trades_per_hour || 0,
          per_day: payload.max_trades_per_day || 0,
        },
        timezone: payload.timezone || 'Asia/Colombo',
      });
      return simulation;
    }
    default:
      throw new Error('Unknown scheduler action');
  }
}

async function handleRisk(body: Record<string, any>) {
  switch (body.action) {
    case 'get_profiles': {
      const profiles = await authorizedFetch(`/workspaces/${body.workspace_id}/risk-profiles`, 'GET');
      return { profiles: profiles || [] };
    }
    case 'create_profile': {
      const profile = await authorizedFetch(`/workspaces/${body.workspace_id}/risk-profiles`, 'POST', {
        name: body.name,
        ...(body.limits || {}),
      });
      return { profile };
    }
    case 'update_profile': {
      const profile = await authorizedFetch(`/workspaces/${body.workspace_id}/risk-profiles/${body.profile_id}`, 'PATCH', {
        ...body.updates,
      });
      return { profile };
    }
    case 'validate_order':
    case 'validate_trade': {
      return {
        valid: true,
        validations: [{ rule: 'max_position_percent', valid: true }],
        portfolio_value: 100000,
        daily_pnl: 500,
      };
    }
    case 'global_kill_switch':
    case 'toggle_global_trading': {
      const data = await authorizedFetch('/ops/kill-switch', 'POST', {
        workspace_id: body.workspace_id,
        enabled: body.enabled,
        reason: body.reason || (body.enabled ? 'manual_resume' : 'manual_kill_switch'),
      });
      return {
        success: true,
        global_trading_enabled: data.global_trading_enabled,
        kill_switch_active: data.kill_switch_active,
        state: data.state,
      };
    }
    case 'get_system_settings': {
      const data = await authorizedFetch(
        `/settings?group=${encodeURIComponent('ops')}&workspace_id=${encodeURIComponent(body.workspace_id)}`,
        'GET'
      );
      const killSwitch = data?.kill_switch || {};
      const isActive = !!killSwitch?.active;
      return {
        settings: {
          id: body.workspace_id || 'local',
          workspace_id: body.workspace_id,
          global_trading_enabled: !isActive,
          kill_switch_active: isActive,
          kill_switch_reason: killSwitch?.reason || null,
          kill_switch_activated_at: killSwitch?.activated_at || null,
          default_risk_profile_id: null,
          maintenance_mode: false,
          max_concurrent_strategies: null,
          created_at: new Date().toISOString(),
        },
      };
    }
    default:
      throw new Error('Unknown risk action');
  }
}

async function handleTrading(body: Record<string, any>) {
  switch (body.action) {
    case 'get_orders': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/orders`, 'GET');
      return { orders: data };
    }
    case 'get_positions': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/positions`, 'GET');
      return { positions: data };
    }
    case 'get_trades': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/trades`, 'GET');
      return { trades: data };
    }
    case 'place_order': {
      const isLive = body.mode === 'live';
      if (isLive) {
        if (!body.integration_id) {
          throw new Error('Live orders require an active integration_id.');
        }

        const data = await authorizedFetch(`/live/orders`, 'POST', {
          workspace_id: body.workspace_id,
          integration_id: body.integration_id,
          instance_id: body.instance_id,
          symbol: body.symbol,
          side: body.side,
          type: body.order_type || body.type || 'market',
          qty: body.quantity ?? body.qty,
          price: body.price,
          idempotency_key: body.idempotency_key,
        });
        return { order: data.order ?? data };
      }

      const data = await authorizedFetch(`/orders`, 'POST', {
        workspace_id: body.workspace_id,
        instance_id: body.instance_id,
        symbol: body.symbol,
        side: body.side,
        order_type: body.order_type || 'market',
        mode: 'paper',
        quantity: body.quantity ?? body.qty,
        price: body.price,
        idempotency_key: body.idempotency_key,
      });
      return { order: data.order };
    }
    case 'cancel_order': {
      const data = await authorizedFetch(`/live/orders/${body.order_id}`, 'DELETE', {
        workspace_id: body.workspace_id,
      });
      return { order: data.order ?? data };
    }
    default:
      throw new Error('Unknown trading action');
  }
}

async function handleWallet(body: Record<string, any>) {
  switch (body.action) {
    case 'get_balances': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/ledger`, 'GET');
      const currency = data?.meta?.currency || 'USD';
      return {
        balances: [
          {
            id: data.id,
            currency,
            balance: data.balance,
            available: data.balance,
            meta: data.meta,
          },
        ],
      };
    }
    case 'get_transactions': {
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/ledger`, 'GET');
      const currency = data?.meta?.currency || 'USD';
      const transactions = (data.transactions || []).map((tx: any) => ({
        id: tx.id,
        currency,
        amount: tx.amount,
        tx_type: tx.type,
        balance_after: null,
        description: tx.meta?.description ?? tx.meta?.source ?? '',
        created_at: tx.created_at,
      }));
      return { transactions };
    }
    case 'deposit': {
      const data = await authorizedFetch(`/wallet/deposit/intent`, 'POST', {
        workspace_id: body.workspace_id,
        amount: body.amount,
        currency: body.currency || 'USD',
        gateway: body.gateway || 'payhere',
      });
      return {
        transaction: { id: data.payment_id || 'deposit_intent', amount: body.amount, currency: body.currency || 'USD' },
        checkout: data.checkout,
        status: data.checkout?.status || 'pending',
      };
    }
    case 'withdraw':
    case 'transfer': {
      return {
        transaction: { id: 'mock', amount: -Math.abs(body.amount || 0) },
        new_balance: 0,
      };
    }
    default:
      throw new Error('Unknown wallet action');
  }
}

async function handleNotifications(body: Record<string, any>) {
  switch (body.action) {
    case 'list': {
      const data = await authorizedFetch('/notifications', 'GET');
      return { notifications: data };
    }
    case 'count': {
      const data = await authorizedFetch('/notifications', 'GET');
      return { count: data.length };
    }
    case 'mark_read': {
      await authorizedFetch('/notifications/read', 'POST', { ids: body.ids || [] });
      return { success: true };
    }
    case 'get_settings': {
      const data = await authorizedFetch('/notification-settings', 'GET');
      return { settings: data || { preferences: {} } };
    }
    case 'update_settings': {
      const data = await authorizedFetch('/notification-settings', 'PATCH', { preferences: body.preferences || {} });
      return { settings: data };
    }
    default:
      throw new Error('Unknown notification action');
  }
}

async function handleAssistant(body: Record<string, any>) {
  switch (body.action) {
    case 'chat': {
      const data = await authorizedFetch('/assistant/chat', 'POST', {
        message: body.message,
        session_id: body.session_id,
      });
      return { message: data.reply, session_id: data.session_id };
    }
    case 'analyze': {
      return { analysis: 'Strategy performing within expected parameters.' };
    }
    case 'explain_trade': {
      return { explanation: 'Trade executed based on MA crossover signal with RSI confirmation.' };
    }
    case 'list_sessions': {
      return { sessions: [] };
    }
    default:
      return { message: 'Assistant action handled' };
  }
}

async function handleLiveBots(body: Record<string, any>) {
  switch (body.action) {
    case 'get_bots': {
      const params = new URLSearchParams();
      if (body.asset_class) params.set('asset_class', body.asset_class);
      if (body.metal_type) params.set('metal_type', body.metal_type);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await authorizedFetch(`/workspaces/${body.workspace_id}/bots${suffix}`, 'GET');
      return { bots: data || [] };
    }
    case 'create_bot': {
      const bot = await authorizedFetch(`/workspaces/${body.workspace_id}/bots`, 'POST', body.payload || {});
      return { bot };
    }
    case 'update_bot': {
      const bot = await authorizedFetch(`/bots/${body.bot_id}`, 'PATCH', body.payload || {});
      return { bot };
    }
    case 'delete_bot': {
      await authorizedFetch(`/bots/${body.bot_id}`, 'DELETE');
      return { success: true };
    }
    case 'start_bot': {
      const bot = await authorizedFetch(`/bots/${body.bot_id}/start`, 'POST', {});
      return { bot };
    }
    case 'pause_bot': {
      const bot = await authorizedFetch(`/bots/${body.bot_id}/pause`, 'POST', {});
      return { bot };
    }
    case 'stop_bot': {
      const bot = await authorizedFetch(`/bots/${body.bot_id}/stop`, 'POST', {});
      return { bot };
    }
    case 'emergency_stop': {
      const data = await authorizedFetch(`/bots/${body.bot_id}/emergency-stop`, 'POST', {});
      return data;
    }
    case 'close_position': {
      const data = await authorizedFetch(`/bots/${body.bot_id}/close-position`, 'POST', body.payload || {});
      return data;
    }
    case 'monitor_bot': {
      const data = await authorizedFetch(`/bots/${body.bot_id}/monitor`, 'GET');
      return data;
    }
    case 'bot_logs': {
      const suffix = body.trace_id ? `?trace_id=${encodeURIComponent(body.trace_id)}` : '';
      const logs = await authorizedFetch(`/bots/${body.bot_id}/logs${suffix}`, 'GET');
      return { logs: logs || [] };
    }
    case 'ai_recommendations': {
      const suffix = body.query ? String(body.query) : '';
      return authorizedFetch(`/bots/${body.bot_id}/ai/recommendations${suffix}`, 'GET');
    }
    case 'ai_apply_recommendation': {
      return authorizedFetch(`/bots/${body.bot_id}/ai/apply-recommendation`, 'POST', {
        recommendation_id: body.recommendation_id || undefined,
      });
    }
    case 'market_price': {
      const params = new URLSearchParams();
      if (body.asset_class) params.set('asset_class', body.asset_class);
      if (body.asset_code) params.set('asset_code', body.asset_code);
      if (body.provider) params.set('provider', body.provider);
      if (body.quote) params.set('quote', body.quote);
      if (!body.asset_class) {
        params.set('exchange', body.exchange || body.provider || 'binance');
      }
      if (!body.asset_code && body.symbol) {
        params.set('symbol', body.symbol);
      }
      const data = await authorizedFetch(`/market/price?${params.toString()}`, 'GET');
      return data;
    }
    case 'market_fx': {
      const base = body.base || 'USD';
      const quote = body.quote || 'LKR';
      return authorizedFetch(`/market/fx?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(quote)}`, 'GET');
    }
    case 'get_assets': {
      const suffix = body.asset_class ? `?asset_class=${encodeURIComponent(body.asset_class)}` : '';
      return authorizedFetch(`/assets${suffix}`, 'GET');
    }
    case 'metals_rates': {
      const provider = body.provider || 'metal_broker';
      return authorizedFetch(`/metals/rates?provider=${encodeURIComponent(provider)}`, 'GET');
    }
    default:
      throw new Error('Unknown live-bots action');
  }
}
