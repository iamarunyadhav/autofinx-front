export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assistant_sessions: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          language: string | null
          messages: Json | null
          mode: string | null
          updated_at: string | null
          user_id: string
          voice_enabled: boolean | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          messages?: Json | null
          mode?: string | null
          updated_at?: string | null
          user_id: string
          voice_enabled?: boolean | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          messages?: Json | null
          mode?: string | null
          updated_at?: string | null
          user_id?: string
          voice_enabled?: boolean | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_connections: {
        Row: {
          api_key_encrypted: string | null
          api_secret_encrypted: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          is_testnet: boolean | null
          last_synced_at: string | null
          name: string
          passphrase_encrypted: string | null
          permissions: Json | null
          provider: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_testnet?: boolean | null
          last_synced_at?: string | null
          name: string
          passphrase_encrypted?: string | null
          permissions?: Json | null
          provider: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_testnet?: boolean | null
          last_synced_at?: string | null
          name?: string
          passphrase_encrypted?: string | null
          permissions?: Json | null
          provider?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_risk_profiles: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string
          risk_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_id: string
          risk_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string
          risk_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_risk_profiles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "strategy_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instance_risk_profiles_risk_profile_id_fkey"
            columns: ["risk_profile_id"]
            isOneToOne: false
            referencedRelation: "risk_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          metadata: Json | null
          paid_at: string | null
          pdf_url: string | null
          status: string | null
          subscription_id: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subscription_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string | null
          subscription_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string | null
          currency: string
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          tx_type: Database["public"]["Enums"]["ledger_tx_type"]
          workspace_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string | null
          currency: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tx_type: Database["public"]["Enums"]["ledger_tx_type"]
          workspace_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          tx_type?: Database["public"]["Enums"]["ledger_tx_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledgers: {
        Row: {
          available_balance: number | null
          balance: number | null
          currency: string
          id: string
          locked_balance: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          available_balance?: number | null
          balance?: number | null
          currency: string
          id?: string
          locked_balance?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          available_balance?: number | null
          balance?: number | null
          currency?: string
          id?: string
          locked_balance?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledgers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          marketing_emails: boolean | null
          push_enabled: boolean | null
          risk_alerts: boolean | null
          sms_enabled: boolean | null
          system_alerts: boolean | null
          telegram_chat_id: string | null
          telegram_enabled: boolean | null
          trade_alerts: boolean | null
          updated_at: string | null
          user_id: string
          whatsapp_enabled: boolean | null
          whatsapp_number: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          push_enabled?: boolean | null
          risk_alerts?: boolean | null
          sms_enabled?: boolean | null
          system_alerts?: boolean | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean | null
          trade_alerts?: boolean | null
          updated_at?: string | null
          user_id: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          marketing_emails?: boolean | null
          push_enabled?: boolean | null
          risk_alerts?: boolean | null
          sms_enabled?: boolean | null
          system_alerts?: boolean | null
          telegram_chat_id?: string | null
          telegram_enabled?: boolean | null
          trade_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string
          whatsapp_enabled?: boolean | null
          whatsapp_number?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"] | null
          created_at: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          read_at: string | null
          severity: Database["public"]["Enums"]["notification_severity"] | null
          title: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"] | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"] | null
          title: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_url?: string | null
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"] | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          severity?: Database["public"]["Enums"]["notification_severity"] | null
          title?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          avg_fill_price: number | null
          cancelled_at: string | null
          client_order_id: string | null
          connection_id: string | null
          created_at: string | null
          exchange_order_id: string | null
          fee_currency: string | null
          fees: number | null
          filled_at: string | null
          filled_quantity: number | null
          id: string
          instance_id: string | null
          metadata: Json | null
          mode: Database["public"]["Enums"]["trading_mode"]
          order_type: Database["public"]["Enums"]["order_type"]
          price: number | null
          quantity: number
          side: Database["public"]["Enums"]["order_side"]
          status: Database["public"]["Enums"]["order_status"]
          stop_price: number | null
          submitted_at: string | null
          symbol_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          avg_fill_price?: number | null
          cancelled_at?: string | null
          client_order_id?: string | null
          connection_id?: string | null
          created_at?: string | null
          exchange_order_id?: string | null
          fee_currency?: string | null
          fees?: number | null
          filled_at?: string | null
          filled_quantity?: number | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["trading_mode"]
          order_type?: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity: number
          side: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          stop_price?: number | null
          submitted_at?: string | null
          symbol_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          avg_fill_price?: number | null
          cancelled_at?: string | null
          client_order_id?: string | null
          connection_id?: string | null
          created_at?: string | null
          exchange_order_id?: string | null
          fee_currency?: string | null
          fees?: number | null
          filled_at?: string | null
          filled_quantity?: number | null
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["trading_mode"]
          order_type?: Database["public"]["Enums"]["order_type"]
          price?: number | null
          quantity?: number
          side?: Database["public"]["Enums"]["order_side"]
          status?: Database["public"]["Enums"]["order_status"]
          stop_price?: number | null
          submitted_at?: string | null
          symbol_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "strategy_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string | null
          expiry_month: number | null
          expiry_year: number | null
          gateway: Database["public"]["Enums"]["payment_gateway"]
          id: string
          is_default: boolean | null
          last_four: string | null
          metadata: Json | null
          token: string | null
          workspace_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          gateway: Database["public"]["Enums"]["payment_gateway"]
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          metadata?: Json | null
          token?: string | null
          workspace_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          expiry_month?: number | null
          expiry_year?: number | null
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          id?: string
          is_default?: boolean | null
          last_four?: string | null
          metadata?: Json | null
          token?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          failure_reason: string | null
          gateway: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          gateway: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          status?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          gateway_payment_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          features: Json | null
          id: string
          interval: string | null
          is_active: boolean | null
          limits: Json | null
          name: string
          price: number
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          limits?: Json | null
          name: string
          price: number
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          interval?: string | null
          is_active?: boolean | null
          limits?: Json | null
          name?: string
          price?: number
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      positions: {
        Row: {
          avg_entry_price: number | null
          connection_id: string | null
          current_price: number | null
          id: string
          mode: Database["public"]["Enums"]["trading_mode"]
          quantity: number | null
          realized_pnl: number | null
          symbol_id: string
          unrealized_pnl: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          avg_entry_price?: number | null
          connection_id?: string | null
          current_price?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["trading_mode"]
          quantity?: number | null
          realized_pnl?: number | null
          symbol_id: string
          unrealized_pnl?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          avg_entry_price?: number | null
          connection_id?: string | null
          current_price?: number | null
          id?: string
          mode?: Database["public"]["Enums"]["trading_mode"]
          quantity?: number | null
          realized_pnl?: number | null
          symbol_id?: string
          unrealized_pnl?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "exchange_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_symbol_id_fkey"
            columns: ["symbol_id"]
            isOneToOne: false
            referencedRelation: "symbols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          timezone: string | null
          two_factor_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          timezone?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      risk_profiles: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          max_daily_loss_percent: number | null
          max_drawdown_percent: number | null
          max_leverage: number | null
          max_position_percent: number | null
          name: string
          settings: Json | null
          slippage_tolerance: number | null
          stop_loss_percent: number | null
          take_profit_percent: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          max_daily_loss_percent?: number | null
          max_drawdown_percent?: number | null
          max_leverage?: number | null
          max_position_percent?: number | null
          name: string
          settings?: Json | null
          slippage_tolerance?: number | null
          stop_loss_percent?: number | null
          take_profit_percent?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          max_daily_loss_percent?: number | null
          max_drawdown_percent?: number | null
          max_leverage?: number | null
          max_position_percent?: number | null
          name?: string
          settings?: Json | null
          slippage_tolerance?: number | null
          stop_loss_percent?: number | null
          take_profit_percent?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          author_id: string | null
          created_at: string | null
          default_params: Json | null
          description: string | null
          id: string
          indicators: Json | null
          is_public: boolean | null
          name: string
          strategy_type: Database["public"]["Enums"]["strategy_type"]
          updated_at: string | null
          version: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          default_params?: Json | null
          description?: string | null
          id?: string
          indicators?: Json | null
          is_public?: boolean | null
          name: string
          strategy_type: Database["public"]["Enums"]["strategy_type"]
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          default_params?: Json | null
          description?: string | null
          id?: string
          indicators?: Json | null
          is_public?: boolean | null
          name?: string
          strategy_type?: Database["public"]["Enums"]["strategy_type"]
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      strategy_instances: {
        Row: {
          allowed_symbols: string[] | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          mode: Database["public"]["Enums"]["trading_mode"]
          name: string
          params: Json | null
          strategy_id: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          allowed_symbols?: string[] | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          mode?: Database["public"]["Enums"]["trading_mode"]
          name: string
          params?: Json | null
          strategy_id: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          allowed_symbols?: string[] | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          mode?: Database["public"]["Enums"]["trading_mode"]
          name?: string
          params?: Json | null
          strategy_id?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_instances_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategy_instances_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_schedules: {
        Row: {
          active_days: number[] | null
          cooldown_seconds: number | null
          created_at: string | null
          end_time: string | null
          evaluation_interval_ms: number | null
          id: string
          instance_id: string
          is_enabled: boolean | null
          max_trades_per_day: number | null
          max_trades_per_hour: number | null
          start_time: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          active_days?: number[] | null
          cooldown_seconds?: number | null
          created_at?: string | null
          end_time?: string | null
          evaluation_interval_ms?: number | null
          id?: string
          instance_id: string
          is_enabled?: boolean | null
          max_trades_per_day?: number | null
          max_trades_per_hour?: number | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          active_days?: number[] | null
          cooldown_seconds?: number | null
          created_at?: string | null
          end_time?: string | null
          evaluation_interval_ms?: number | null
          id?: string
          instance_id?: string
          is_enabled?: boolean | null
          max_trades_per_day?: number | null
          max_trades_per_hour?: number | null
          start_time?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategy_schedules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "strategy_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          gateway: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_customer_id: string | null
          gateway_subscription_id: string | null
          id: string
          metadata: Json | null
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: Database["public"]["Enums"]["payment_gateway"] | null
          gateway_customer_id?: string | null
          gateway_subscription_id?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      symbols: {
        Row: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          base_currency: string | null
          created_at: string | null
          exchange: string | null
          exchange_symbol: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          name: string
          quote_currency: string | null
          symbol: string
        }
        Insert: {
          asset_type: Database["public"]["Enums"]["asset_type"]
          base_currency?: string | null
          created_at?: string | null
          exchange?: string | null
          exchange_symbol?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name: string
          quote_currency?: string | null
          symbol: string
        }
        Update: {
          asset_type?: Database["public"]["Enums"]["asset_type"]
          base_currency?: string | null
          created_at?: string | null
          exchange?: string | null
          exchange_symbol?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          name?: string
          quote_currency?: string | null
          symbol?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          default_risk_profile_id: string | null
          global_trading_enabled: boolean | null
          id: string
          maintenance_mode: boolean | null
          max_concurrent_strategies: number | null
          settings: Json | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          default_risk_profile_id?: string | null
          global_trading_enabled?: boolean | null
          id?: string
          maintenance_mode?: boolean | null
          max_concurrent_strategies?: number | null
          settings?: Json | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          default_risk_profile_id?: string | null
          global_trading_enabled?: boolean | null
          id?: string
          maintenance_mode?: boolean | null
          max_concurrent_strategies?: number | null
          settings?: Json | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_default_risk_profile_id_fkey"
            columns: ["default_risk_profile_id"]
            isOneToOne: false
            referencedRelation: "risk_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          executed_at: string | null
          fee: number | null
          fee_currency: string | null
          id: string
          metadata: Json | null
          order_id: string
          price: number
          quantity: number
          trade_id: string | null
        }
        Insert: {
          executed_at?: string | null
          fee?: number | null
          fee_currency?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          price: number
          quantity: number
          trade_id?: string | null
        }
        Update: {
          executed_at?: string | null
          fee?: number | null
          fee_currency?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          price?: number
          quantity?: number
          trade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trades_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "trader" | "viewer"
      asset_type: "crypto" | "stock" | "forex" | "commodity"
      ledger_tx_type:
        | "deposit"
        | "withdrawal"
        | "fee"
        | "pnl"
        | "transfer"
        | "subscription"
        | "refund"
      notification_channel:
        | "in_app"
        | "email"
        | "sms"
        | "whatsapp"
        | "telegram"
        | "push"
      notification_severity:
        | "info"
        | "success"
        | "warning"
        | "error"
        | "critical"
      order_side: "buy" | "sell"
      order_status:
        | "pending"
        | "submitted"
        | "partial"
        | "filled"
        | "cancelled"
        | "rejected"
        | "expired"
      order_type:
        | "market"
        | "limit"
        | "stop_loss"
        | "take_profit"
        | "trailing_stop"
      payment_gateway:
        | "payhere"
        | "paypal"
        | "payoneer"
        | "stripe"
        | "bank_transfer"
      strategy_type:
        | "trend"
        | "mean_reversion"
        | "grid"
        | "arbitrage"
        | "ml_signal"
        | "dca"
        | "custom"
      subscription_status:
        | "active"
        | "past_due"
        | "cancelled"
        | "paused"
        | "trialing"
      trading_mode: "paper" | "live"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "trader", "viewer"],
      asset_type: ["crypto", "stock", "forex", "commodity"],
      ledger_tx_type: [
        "deposit",
        "withdrawal",
        "fee",
        "pnl",
        "transfer",
        "subscription",
        "refund",
      ],
      notification_channel: [
        "in_app",
        "email",
        "sms",
        "whatsapp",
        "telegram",
        "push",
      ],
      notification_severity: [
        "info",
        "success",
        "warning",
        "error",
        "critical",
      ],
      order_side: ["buy", "sell"],
      order_status: [
        "pending",
        "submitted",
        "partial",
        "filled",
        "cancelled",
        "rejected",
        "expired",
      ],
      order_type: [
        "market",
        "limit",
        "stop_loss",
        "take_profit",
        "trailing_stop",
      ],
      payment_gateway: [
        "payhere",
        "paypal",
        "payoneer",
        "stripe",
        "bank_transfer",
      ],
      strategy_type: [
        "trend",
        "mean_reversion",
        "grid",
        "arbitrage",
        "ml_signal",
        "dca",
        "custom",
      ],
      subscription_status: [
        "active",
        "past_due",
        "cancelled",
        "paused",
        "trialing",
      ],
      trading_mode: ["paper", "live"],
    },
  },
} as const
