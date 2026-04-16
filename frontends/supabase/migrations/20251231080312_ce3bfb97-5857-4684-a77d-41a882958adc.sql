-- =============================================
-- AUTOFINX FULL DATABASE SCHEMA
-- =============================================

-- 1. ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'trader', 'viewer');
CREATE TYPE public.strategy_type AS ENUM ('trend', 'mean_reversion', 'grid', 'arbitrage', 'ml_signal', 'dca', 'custom');
CREATE TYPE public.trading_mode AS ENUM ('paper', 'live');
CREATE TYPE public.order_side AS ENUM ('buy', 'sell');
CREATE TYPE public.order_type AS ENUM ('market', 'limit', 'stop_loss', 'take_profit', 'trailing_stop');
CREATE TYPE public.order_status AS ENUM ('pending', 'submitted', 'partial', 'filled', 'cancelled', 'rejected', 'expired');
CREATE TYPE public.asset_type AS ENUM ('crypto', 'stock', 'forex', 'commodity');
CREATE TYPE public.notification_channel AS ENUM ('in_app', 'email', 'sms', 'whatsapp', 'telegram', 'push');
CREATE TYPE public.notification_severity AS ENUM ('info', 'success', 'warning', 'error', 'critical');
CREATE TYPE public.subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'paused', 'trialing');
CREATE TYPE public.payment_gateway AS ENUM ('payhere', 'paypal', 'payoneer', 'stripe', 'bank_transfer');
CREATE TYPE public.ledger_tx_type AS ENUM ('deposit', 'withdrawal', 'fee', 'pnl', 'transfer', 'subscription', 'refund');

-- 2. PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferred_language TEXT DEFAULT 'en',
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. USER ROLES TABLE (Security Best Practice)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 4. WORKSPACES (Teams/Organizations)
-- =============================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 5. WORKSPACE MEMBERS
-- =============================================
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Members can view workspace" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(id, auth.uid()) OR owner_id = auth.uid());

CREATE POLICY "Owners can update workspace" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspace" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners can manage members" ON public.workspace_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.workspaces WHERE id = workspace_id AND owner_id = auth.uid())
  );

-- 6. SYMBOLS (Trading Assets)
-- =============================================
CREATE TABLE public.symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_type asset_type NOT NULL,
  base_currency TEXT,
  quote_currency TEXT,
  exchange TEXT,
  exchange_symbol TEXT,
  icon_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view symbols" ON public.symbols
  FOR SELECT USING (TRUE);

-- 7. STRATEGIES (Template Library)
-- =============================================
CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  strategy_type strategy_type NOT NULL,
  version TEXT DEFAULT '1.0.0',
  default_params JSONB DEFAULT '{}',
  indicators JSONB DEFAULT '[]',
  is_public BOOLEAN DEFAULT FALSE,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public strategies" ON public.strategies
  FOR SELECT USING (is_public = TRUE OR author_id = auth.uid());

CREATE POLICY "Authors can manage strategies" ON public.strategies
  FOR ALL USING (author_id = auth.uid());

-- 8. STRATEGY INSTANCES (User's running bots)
-- =============================================
CREATE TABLE public.strategy_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  strategy_id UUID NOT NULL REFERENCES public.strategies(id),
  name TEXT NOT NULL,
  mode trading_mode NOT NULL DEFAULT 'paper',
  is_enabled BOOLEAN DEFAULT FALSE,
  params JSONB DEFAULT '{}',
  allowed_symbols UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.strategy_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view strategy instances" ON public.strategy_instances
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can manage strategy instances" ON public.strategy_instances
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 9. STRATEGY SCHEDULES
-- =============================================
CREATE TABLE public.strategy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.strategy_instances(id) ON DELETE CASCADE,
  timezone TEXT DEFAULT 'UTC',
  active_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  start_time TIME DEFAULT '00:00',
  end_time TIME DEFAULT '23:59',
  evaluation_interval_ms INTEGER DEFAULT 60000,
  cooldown_seconds INTEGER DEFAULT 60,
  max_trades_per_hour INTEGER DEFAULT 10,
  max_trades_per_day INTEGER DEFAULT 50,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.strategy_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schedule access via instance" ON public.strategy_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.strategy_instances si
      WHERE si.id = instance_id AND public.is_workspace_member(si.workspace_id, auth.uid())
    )
  );

-- 10. RISK PROFILES
-- =============================================
CREATE TABLE public.risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_position_percent DECIMAL(5,2) DEFAULT 10.00,
  max_daily_loss_percent DECIMAL(5,2) DEFAULT 5.00,
  max_drawdown_percent DECIMAL(5,2) DEFAULT 15.00,
  max_leverage DECIMAL(5,2) DEFAULT 1.00,
  stop_loss_percent DECIMAL(5,2) DEFAULT 2.00,
  take_profit_percent DECIMAL(5,2) DEFAULT 5.00,
  slippage_tolerance DECIMAL(5,4) DEFAULT 0.005,
  is_default BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view risk profiles" ON public.risk_profiles
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can manage risk profiles" ON public.risk_profiles
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 11. INSTANCE RISK PROFILE (Linking)
-- =============================================
CREATE TABLE public.instance_risk_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.strategy_instances(id) ON DELETE CASCADE,
  risk_profile_id UUID NOT NULL REFERENCES public.risk_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_id)
);

ALTER TABLE public.instance_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via instance" ON public.instance_risk_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.strategy_instances si
      WHERE si.id = instance_id AND public.is_workspace_member(si.workspace_id, auth.uid())
    )
  );

-- 12. EXCHANGE CONNECTIONS
-- =============================================
CREATE TABLE public.exchange_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  passphrase_encrypted TEXT,
  permissions JSONB DEFAULT '{}',
  is_testnet BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exchange_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view connections" ON public.exchange_connections
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can manage connections" ON public.exchange_connections
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 13. ORDERS
-- =============================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.strategy_instances(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES public.exchange_connections(id),
  symbol_id UUID NOT NULL REFERENCES public.symbols(id),
  client_order_id TEXT UNIQUE,
  exchange_order_id TEXT,
  side order_side NOT NULL,
  order_type order_type NOT NULL DEFAULT 'market',
  quantity DECIMAL(20,8) NOT NULL,
  price DECIMAL(20,8),
  stop_price DECIMAL(20,8),
  filled_quantity DECIMAL(20,8) DEFAULT 0,
  avg_fill_price DECIMAL(20,8),
  status order_status NOT NULL DEFAULT 'pending',
  mode trading_mode NOT NULL DEFAULT 'paper',
  fees DECIMAL(20,8) DEFAULT 0,
  fee_currency TEXT,
  metadata JSONB DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  filled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view orders" ON public.orders
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can create orders" ON public.orders
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can update orders" ON public.orders
  FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 14. TRADES (Fills)
-- =============================================
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  trade_id TEXT,
  quantity DECIMAL(20,8) NOT NULL,
  price DECIMAL(20,8) NOT NULL,
  fee DECIMAL(20,8) DEFAULT 0,
  fee_currency TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via order" ON public.trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND public.is_workspace_member(o.workspace_id, auth.uid())
    )
  );

-- 15. POSITIONS
-- =============================================
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  symbol_id UUID NOT NULL REFERENCES public.symbols(id),
  connection_id UUID REFERENCES public.exchange_connections(id),
  quantity DECIMAL(20,8) DEFAULT 0,
  avg_entry_price DECIMAL(20,8) DEFAULT 0,
  current_price DECIMAL(20,8) DEFAULT 0,
  unrealized_pnl DECIMAL(20,8) DEFAULT 0,
  realized_pnl DECIMAL(20,8) DEFAULT 0,
  mode trading_mode NOT NULL DEFAULT 'paper',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, symbol_id, connection_id, mode)
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view positions" ON public.positions
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can manage positions" ON public.positions
  FOR ALL USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 16. LEDGER BALANCES
-- =============================================
CREATE TABLE public.ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,
  balance DECIMAL(20,8) DEFAULT 0,
  available_balance DECIMAL(20,8) DEFAULT 0,
  locked_balance DECIMAL(20,8) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, currency)
);

ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ledgers" ON public.ledgers
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 17. LEDGER TRANSACTIONS
-- =============================================
CREATE TABLE public.ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tx_type ledger_tx_type NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency TEXT NOT NULL,
  balance_after DECIMAL(20,8),
  reference_type TEXT,
  reference_id UUID,
  description TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transactions" ON public.ledger_transactions
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 18. BILLING PLANS
-- =============================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  interval TEXT DEFAULT 'monthly',
  features JSONB DEFAULT '[]',
  limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans" ON public.plans
  FOR SELECT USING (is_active = TRUE);

-- 19. SUBSCRIPTIONS
-- =============================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status subscription_status NOT NULL DEFAULT 'active',
  gateway payment_gateway,
  gateway_subscription_id TEXT,
  gateway_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view subscriptions" ON public.subscriptions
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 20. PAYMENT METHODS
-- =============================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  gateway payment_gateway NOT NULL,
  token TEXT,
  last_four TEXT,
  brand TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payment methods" ON public.payment_methods
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 21. INVOICES
-- =============================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id),
  invoice_number TEXT UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invoices" ON public.invoices
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 22. PAYMENTS
-- =============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  gateway payment_gateway NOT NULL,
  gateway_payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view payments" ON public.payments
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 23. NOTIFICATIONS
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel notification_channel DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT,
  severity notification_severity DEFAULT 'info',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 24. NOTIFICATION SETTINGS
-- =============================================
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT TRUE,
  telegram_enabled BOOLEAN DEFAULT FALSE,
  telegram_chat_id TEXT,
  whatsapp_enabled BOOLEAN DEFAULT FALSE,
  whatsapp_number TEXT,
  trade_alerts BOOLEAN DEFAULT TRUE,
  risk_alerts BOOLEAN DEFAULT TRUE,
  system_alerts BOOLEAN DEFAULT TRUE,
  marketing_emails BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON public.notification_settings
  FOR ALL USING (auth.uid() = user_id);

-- 25. AUDIT LOGS
-- =============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  ip_address INET,
  user_agent TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- 26. AI ASSISTANT SESSIONS
-- =============================================
CREATE TABLE public.assistant_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT DEFAULT 'suggest',
  language TEXT DEFAULT 'en',
  voice_enabled BOOLEAN DEFAULT FALSE,
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.assistant_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions" ON public.assistant_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 27. SYSTEM SETTINGS (Global Kill Switch, etc.)
-- =============================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  global_trading_enabled BOOLEAN DEFAULT TRUE,
  maintenance_mode BOOLEAN DEFAULT FALSE,
  max_concurrent_strategies INTEGER DEFAULT 10,
  default_risk_profile_id UUID REFERENCES public.risk_profiles(id),
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view settings" ON public.system_settings
  FOR SELECT USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members can update settings" ON public.system_settings
  FOR UPDATE USING (public.is_workspace_member(workspace_id, auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_strategy_instances_updated_at BEFORE UPDATE ON public.strategy_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_orders_workspace ON public.orders(workspace_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_trades_order ON public.trades(order_id);
CREATE INDEX idx_positions_workspace ON public.positions(workspace_id);
CREATE INDEX idx_ledger_tx_workspace ON public.ledger_transactions(workspace_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_workspace ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_strategy_instances_workspace ON public.strategy_instances(workspace_id);

-- =============================================
-- SEED: Default Billing Plans
-- =============================================
INSERT INTO public.plans (name, slug, description, price, currency, interval, features, limits, sort_order) VALUES
  ('Free', 'free', 'Get started with paper trading', 0, 'USD', 'monthly', 
   '["Paper trading only", "1 strategy", "Basic indicators", "Community support"]',
   '{"max_strategies": 1, "max_orders_per_day": 50, "live_trading": false}', 1),
  ('Pro', 'pro', 'For serious traders', 29, 'USD', 'monthly',
   '["Paper + Live trading", "5 strategies", "All indicators", "Email support", "Backtesting"]',
   '{"max_strategies": 5, "max_orders_per_day": 500, "live_trading": true}', 2),
  ('Elite', 'elite', 'Professional trading suite', 99, 'USD', 'monthly',
   '["Unlimited strategies", "Priority execution", "ML signals", "24/7 support", "API access"]',
   '{"max_strategies": -1, "max_orders_per_day": -1, "live_trading": true, "api_access": true}', 3);

-- =============================================
-- SEED: Sample Symbols
-- =============================================
INSERT INTO public.symbols (symbol, name, asset_type, base_currency, quote_currency, exchange, exchange_symbol) VALUES
  ('BTC/USDT', 'Bitcoin', 'crypto', 'BTC', 'USDT', 'binance', 'BTCUSDT'),
  ('ETH/USDT', 'Ethereum', 'crypto', 'ETH', 'USDT', 'binance', 'ETHUSDT'),
  ('SOL/USDT', 'Solana', 'crypto', 'SOL', 'USDT', 'binance', 'SOLUSDT'),
  ('XRP/USDT', 'Ripple', 'crypto', 'XRP', 'USDT', 'binance', 'XRPUSDT'),
  ('AAPL', 'Apple Inc.', 'stock', 'AAPL', 'USD', 'nasdaq', 'AAPL'),
  ('TSLA', 'Tesla Inc.', 'stock', 'TSLA', 'USD', 'nasdaq', 'TSLA'),
  ('GOOGL', 'Alphabet Inc.', 'stock', 'GOOGL', 'USD', 'nasdaq', 'GOOGL'),
  ('MSFT', 'Microsoft Corp.', 'stock', 'MSFT', 'USD', 'nasdaq', 'MSFT');

-- =============================================
-- SEED: Sample Strategies
-- =============================================
INSERT INTO public.strategies (name, description, strategy_type, default_params, indicators, is_public) VALUES
  ('MA Crossover', 'Classic moving average crossover strategy', 'trend',
   '{"fast_period": 9, "slow_period": 21, "timeframe": "1h"}',
   '["SMA", "EMA"]', TRUE),
  ('RSI Reversal', 'Mean reversion based on RSI oversold/overbought', 'mean_reversion',
   '{"rsi_period": 14, "oversold": 30, "overbought": 70, "timeframe": "15m"}',
   '["RSI"]', TRUE),
  ('Bollinger Bounce', 'Trade bounces off Bollinger Bands', 'mean_reversion',
   '{"period": 20, "std_dev": 2, "timeframe": "1h"}',
   '["BB", "SMA"]', TRUE),
  ('Grid Bot', 'Place orders at fixed price intervals', 'grid',
   '{"grid_levels": 10, "grid_spacing_percent": 1, "order_size_percent": 10}',
   '[]', TRUE),
  ('DCA Bot', 'Dollar cost averaging on schedule', 'dca',
   '{"investment_amount": 100, "frequency": "weekly", "day_of_week": 1}',
   '[]', TRUE);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;