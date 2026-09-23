import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authHeaders, setAuthToken, clearAuthToken, getAuthToken } from '@/lib/auth';
import { initializeApiBase } from '@/lib/api-base';

// How long we wait for the API base to resolve + /auth/me to respond before
// treating the auth check as failed (but NOT logging the user out — see
// below). Keeps the auth-loading spinner from hanging forever on a
// slow/dead origin.
const AUTH_CHECK_TIMEOUT_MS = 12000;

// Resolves the shared API base (does not block app render — see main.tsx)
// and fires a fetch against it. Centralizing here means auth never reads
// import.meta.env.VITE_API_BASE_URL directly and risks drifting from the
// base the rest of the app actually resolved to.
async function authFetch(path: string, init?: RequestInit) {
  const base = await initializeApiBase();
  return fetch(`${base}${path}`, init);
}

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  authError: boolean;
  retryAuthCheck: () => void;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, twoFactorCode?: string) => Promise<{ error: Error | null; twoFactorRequired: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const { toast } = useToast();

  const runAuthCheck = useCallback(() => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setSession(null);
      setAuthError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setAuthError(false);

    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS);

      try {
        const res = await authFetch('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (res.status === 401 || res.status === 403) {
          // Definitively invalid/expired session — safe to clear.
          clearAuthToken();
          setUser(null);
          setSession(null);
          setAuthError(false);
          return;
        }

        if (!res.ok) {
          throw new Error('Auth check failed');
        }

        const data = await res.json();
        setUser(data.user);
        setSession({ token });
        setAuthError(false);
      } catch {
        // Network error / timeout / transient server failure: the token
        // may still be perfectly valid, we just couldn't confirm it. Do
        // NOT clear it or bounce the user to the login screen — surface a
        // retryable error state instead (see ProtectedRoute).
        setAuthError(true);
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    runAuthCheck();
  }, [runAuthCheck]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const res = await authFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: fullName || email.split('@')[0],
          email,
          password,
          password_confirmation: password,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.message || 'Sign up failed');
        toast({ title: 'Sign up failed', description: err.message, variant: 'destructive' });
        return { error: err };
      }

      const data = await res.json();
      setAuthToken(data.token);
      setUser(data.user);
      setSession({ token: data.token });
      toast({ title: 'Welcome to AutoFinX!', description: 'Your account has been created.' });
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { error };
    }
  };

  const signIn = async (email: string, password: string, twoFactorCode?: string) => {
    try {
      const body: Record<string, string> = { email, password };
      if (twoFactorCode) body.code = twoFactorCode;

      const res = await authFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        const message: string = resBody.message || 'Sign in failed';
        const twoFactorRequired = message.toLowerCase().includes('two-factor') || message.toLowerCase().includes('2fa');
        if (twoFactorRequired) {
          return { error: null, twoFactorRequired: true };
        }
        const err = new Error(message);
        toast({ title: 'Sign in failed', description: message, variant: 'destructive' });
        return { error: err, twoFactorRequired: false };
      }

      const data = await res.json();
      setAuthToken(data.token);
      setUser(data.user);
      setSession({ token: data.token });
      toast({ title: 'Welcome back!', description: 'You have successfully signed in.' });
      return { error: null, twoFactorRequired: false };
    } catch (err) {
      const error = err as Error;
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { error, twoFactorRequired: false };
    }
  };

  const signOut = async () => {
    const token = getAuthToken();
    if (token) {
      await authFetch('/auth/logout', {
        method: 'POST',
        headers: await authHeaders(),
      }).catch(() => {});
    }
    clearAuthToken();
    setUser(null);
    setSession(null);
    toast({ title: 'Signed out', description: 'You have been signed out successfully.' });
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, authError, retryAuthCheck: runAuthCheck, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
