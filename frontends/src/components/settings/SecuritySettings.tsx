import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { authHeaders } from '@/lib/auth';
import { Shield, Key, LogOut, Loader2, CheckCircle, AlertTriangle, Lock, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

interface SecuritySettingsProps {
  userId: string | undefined;
  userEmail: string | undefined;
}

export function SecuritySettings({ userId, userEmail }: SecuritySettingsProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  useEffect(() => {
    const loadTwoFAStatus = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/me`, {
          headers: await authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const confirmed = !!data?.user?.two_factor_confirmed_at;
        setTwoFAEnabled(confirmed);
      } catch (err) {
        // ignore; non-blocking status fetch
      }
    };
    loadTwoFAStatus();
  }, []);
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = async () => {
    setPasswordError('');
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
      
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: 'Failed to change password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSignOutAllDevices = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut({ scope: 'global' });
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out all devices:', error);
      toast({
        title: 'Error',
        description: 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const startTwoFA = async () => {
    setTwoFALoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/2fa/setup`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to start 2FA');
      const data = await res.json();
      setTwoFASecret(data.secret);
      setRecoveryCodes(data.recovery_codes || []);
      toast({ title: '2FA Setup', description: 'Enter the code from your authenticator app.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const confirmTwoFA = async () => {
    if (!twoFACode) return;
    setTwoFALoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/2fa/confirm`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ code: twoFACode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Invalid code');
      }
      setTwoFAEnabled(true);
      toast({ title: '2FA Enabled', description: 'Two-factor authentication is now active.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const disableTwoFA = async () => {
    setTwoFALoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/2fa/disable`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to disable 2FA');
      setTwoFAEnabled(false);
      setTwoFASecret(null);
      setRecoveryCodes([]);
      setTwoFACode('');
      toast({ title: '2FA Disabled', description: 'Two-factor authentication has been disabled.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTwoFALoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Security
          </CardTitle>
          <CardDescription>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Email Address</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
            <Badge variant="outline" className="text-green-500 border-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
            </div>
            {twoFAEnabled ? (
              <Button variant="destructive" size="sm" onClick={disableTwoFA} disabled={twoFALoading}>
                {twoFALoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Disable 2FA
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startTwoFA} disabled={twoFALoading}>
                {twoFALoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Enable 2FA
              </Button>
            )}
          </div>

          {twoFASecret && (
            <div className="p-4 rounded-lg border border-dashed border-primary/50 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="h-4 w-4 text-primary" />
                <span className="font-medium">Secret</span>
              </div>
              <code className="block p-2 rounded bg-muted text-sm font-mono break-all">{twoFASecret}</code>
              <div className="space-y-2">
                <Label htmlFor="twofa-code">Enter code from authenticator</Label>
                <div className="flex gap-2">
                  <Input
                    id="twofa-code"
                    placeholder="123456"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value)}
                  />
                  <Button onClick={confirmTwoFA} disabled={twoFALoading || !twoFACode}>
                    {twoFALoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Confirm
                  </Button>
                </div>
              </div>
              {recoveryCodes.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Recovery codes (store securely):</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {recoveryCodes.map((code) => (
                      <div key={code} className="px-2 py-1 rounded bg-muted/70">{code}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password regularly for better security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter new password"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handlePasswordChange} 
              disabled={changingPassword || !passwordForm.newPassword}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleSignOutAllDevices}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Sign Out All Devices
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Signing out of all devices will invalidate all your active sessions.
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
