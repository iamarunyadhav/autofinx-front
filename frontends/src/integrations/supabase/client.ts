import type { Database } from './types';

type SupabaseSession = { access_token: string; user?: SupabaseUser } | null;
type SupabaseUser = { id: string; email: string | null; [key: string]: unknown };
type AuthChangeHandler = (event: string, session: SupabaseSession) => void;

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'autofinx_token';

class TableQuery {
  private filters: Record<string, unknown> = {};
  private orderBy?: { column: string; direction: 'asc' | 'desc' };
  private data: any;
  private mode: 'get' | 'post' | 'patch' | 'delete' = 'get';
  private returnSingle = false;

  constructor(private table: string, private client: ApiClient) {}

  select() {
    this.mode = this.mode ?? 'get';
    return this;
  }

  insert(payload: any) {
    this.mode = 'post';
    this.data = payload;
    return this;
  }

  update(payload: any) {
    this.mode = 'patch';
    this.data = payload;
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, direction: options?.ascending === false ? 'desc' : 'asc' };
    return this;
  }

  single() {
    this.returnSingle = true;
    return this;
  }

  private async run() {
    const result = await this.client.request(this.mode, `/table/${this.table}`, {
      filters: this.filters,
      order: this.orderBy,
      data: this.data,
      single: this.returnSingle,
    });
    return result;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.run().then(onfulfilled, onrejected);
  }
}

class ApiClient {
  private listeners: Set<AuthChangeHandler> = new Set();
  private currentUser: SupabaseUser | null = null;

  get token() {
    return localStorage.getItem(TOKEN_KEY);
  }

  set token(value: string | null) {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      this.currentUser = null;
    }
    this.notify('TOKEN_CHANGE', this.getSessionSync());
  }

  private notify(event: string, session: SupabaseSession) {
    this.listeners.forEach((listener) => listener(event, session));
  }

  private get headers() {
    // Force API to treat requests as JSON to avoid HTML redirects that break CORS
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(method: string, path: string, body?: Record<string, unknown>) {
    const url = new URL(`${API_BASE}${path}`);
    if (method === 'get' || method === 'delete') {
      Object.entries(body || {}).forEach(([key, value]) => {
        url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: this.headers,
      body: method === 'get' || method === 'delete' ? undefined : JSON.stringify(body),
    });

    const raw = await response.text(); // read once to avoid "body stream already read" errors
    const parsed = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

    if (!response.ok) {
      const message = parsed?.message || raw || 'API error';
      throw new Error(message);
    }

    return { data: parsed ?? {}, error: null };
  }

  auth = {
    signUp: async ({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      try {
        const result = await this.request('post', '/auth/register', {
          email,
          password,
          password_confirmation: password,
          name: options?.data?.full_name || email,
        });
        this.token = result.data.token;
        this.currentUser = result.data.user as SupabaseUser;
        return { data: { user: this.currentUser }, error: null };
      } catch (error: any) {
        return { data: null, error };
      }
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      try {
        const result = await this.request('post', '/auth/login', { email, password });
        this.token = result.data.token;
        this.currentUser = result.data.user as SupabaseUser;
        return { data: { user: this.currentUser }, error: null };
      } catch (error: any) {
        return { data: null, error };
      }
    },
    signOut: async () => {
      if (this.token) {
        await this.request('post', '/auth/logout');
      }
      this.token = null;
      return { error: null };
    },
    getSession: async (): Promise<{ data: { session: SupabaseSession } }> => {
      if (this.token && !this.currentUser) {
        await this.refreshUser();
      }
      return { data: { session: this.getSessionSync() } };
    },
    onAuthStateChange: (callback: AuthChangeHandler) => {
      this.listeners.add(callback);
      const subscription = {
        unsubscribe: () => this.listeners.delete(callback),
      };
      return { data: { subscription } };
    },
  };

  private getSessionSync(): SupabaseSession {
    const token = this.token;
    if (!token) return null;
    return { access_token: token, user: this.currentUser } as SupabaseSession;
  }

  from(table: keyof Database['public']['Tables'] | string) {
    return new TableQuery(table as string, this);
  }

  private async refreshUser() {
    if (!this.token) return null;
    try {
      const result = await this.request('get', '/auth/me');
      this.currentUser = result.data.user as SupabaseUser;
      return this.currentUser;
    } catch {
      this.currentUser = null;
      this.token = null;
      return null;
    }
  }

  functions = {
    invoke: async <T>(name: string, { body }: { body: Record<string, unknown> }) => {
      if (name === 'sync-connection') {
        const now = new Date().toISOString();
        const balances = [
          { currency: 'BTC', available: 0.5, locked: 0, total: 0.5 },
          { currency: 'ETH', available: 2.3, locked: 0, total: 2.3 },
          { currency: 'USDT', available: 10000, locked: 0, total: 10000 },
        ];
        return { data: { success: true, balances, syncedAt: now } as T, error: null };
      }
      return this.request('post', `/functions/${name}`, body);
    },
  };
}

export const supabase = new ApiClient();
