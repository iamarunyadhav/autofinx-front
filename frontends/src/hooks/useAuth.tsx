import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authHeaders, setAuthToken, clearAuthToken, getAuthToken } from '@/lib/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

interface AuthContextType {
  user: any | null;
  session: any | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string, twoFactorCode?: string) => Promise<{ error: Error | null; twoFactorRequired: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('Auth check failed');
        const data = await res.json();
        setUser(data.user);
        setSession({ token });
      })
      .catch(() => {
        clearAuthToken();
        setUser(null);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
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

      const res = await fetch(`${API_BASE}/auth/login`, {
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
      await fetch(`${API_BASE}/auth/logout`, {
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
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
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
