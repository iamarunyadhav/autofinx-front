import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSettings, useUpdateNotificationSettings } from '@/hooks/useNotifications';
import { Bell, Mail, Smartphone, MessageSquare, Save, Loader2, TrendingUp, AlertTriangle, Megaphone } from 'lucide-react';

interface NotificationSettingsProps {
  userId: string | undefined;
}

interface NotificationPrefs {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  telegram_enabled: boolean;
  telegram_chat_id: string;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
  trade_alerts: boolean;
  risk_alerts: boolean;
  system_alerts: boolean;
  marketing_emails: boolean;
}

const defaultPrefs: NotificationPrefs = {
  email_enabled: true,
  push_enabled: true,
  sms_enabled: false,
  telegram_enabled: false,
  telegram_chat_id: '',
  whatsapp_enabled: false,
  whatsapp_number: '',
  trade_alerts: true,
  risk_alerts: true,
  system_alerts: true,
  marketing_emails: false,
};

export function NotificationSettings({ userId }: NotificationSettingsProps) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useNotificationSettings(Boolean(userId));
  const updateSettings = useUpdateNotificationSettings();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  const initialPrefs = useMemo<NotificationPrefs>(() => {
    const stored = (settings as any)?.preferences as NotificationPrefs | undefined;
    return {
      ...defaultPrefs,
      ...(stored || {}),
    };
  }, [settings]);

  useEffect(() => {
    if (userId) {
      setPrefs(initialPrefs);
    }
  }, [userId, initialPrefs]);

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
  };

  const handleInputChange = (key: keyof NotificationPrefs, value: string) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
  };

  const handleSave = async () => {
    if (!userId || !prefs) return;

    try {
      await updateSettings.mutateAsync(prefs);

      toast({
        title: 'Settings Saved',
        description: 'Your notification preferences have been updated.',
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading || !prefs) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="email_enabled" className="text-sm font-medium">
                  Email Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
            </div>
            <Switch
              id="email_enabled"
              checked={prefs.email_enabled}
              onCheckedChange={(checked) => handleToggle('email_enabled', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="push_enabled" className="text-sm font-medium">
                  Push Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Browser and mobile push notifications
                </p>
              </div>
            </div>
            <Switch
              id="push_enabled"
              checked={prefs.push_enabled}
              onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="telegram_enabled" className="text-sm font-medium">
                    Telegram
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get alerts via Telegram bot
                  </p>
                </div>
              </div>
              <Switch
                id="telegram_enabled"
                checked={prefs.telegram_enabled}
                onCheckedChange={(checked) => handleToggle('telegram_enabled', checked)}
              />
            </div>
            {prefs.telegram_enabled && (
              <Input
                placeholder="Enter Telegram Chat ID"
                value={prefs.telegram_chat_id}
                onChange={(e) => handleInputChange('telegram_chat_id', e.target.value)}
                className="ml-8"
              />
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="whatsapp_enabled" className="text-sm font-medium">
                    WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive WhatsApp messages
                  </p>
                </div>
              </div>
              <Switch
                id="whatsapp_enabled"
                checked={prefs.whatsapp_enabled}
                onCheckedChange={(checked) => handleToggle('whatsapp_enabled', checked)}
              />
            </div>
            {prefs.whatsapp_enabled && (
              <Input
                placeholder="Enter WhatsApp number with country code"
                value={prefs.whatsapp_number}
                onChange={(e) => handleInputChange('whatsapp_number', e.target.value)}
                className="ml-8"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Types */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Types</CardTitle>
          <CardDescription>
            Choose which types of alerts you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <Label htmlFor="trade_alerts" className="text-sm font-medium">
                  Trade Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Order executions, fills, and trade updates
                </p>
              </div>
            </div>
            <Switch
              id="trade_alerts"
              checked={prefs.trade_alerts}
              onCheckedChange={(checked) => handleToggle('trade_alerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <Label htmlFor="risk_alerts" className="text-sm font-medium">
                  Risk Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  Drawdown warnings, position limits, and risk events
                </p>
              </div>
            </div>
            <Switch
              id="risk_alerts"
              checked={prefs.risk_alerts}
              onCheckedChange={(checked) => handleToggle('risk_alerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-blue-500" />
              <div>
                <Label htmlFor="system_alerts" className="text-sm font-medium">
                  System Alerts
                </Label>
                <p className="text-xs text-muted-foreground">
                  System status, maintenance, and important updates
                </p>
              </div>
            </div>
            <Switch
              id="system_alerts"
              checked={prefs.system_alerts}
              onCheckedChange={(checked) => handleToggle('system_alerts', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-purple-500" />
              <div>
                <Label htmlFor="marketing_emails" className="text-sm font-medium">
                  Marketing Emails
                </Label>
                <p className="text-xs text-muted-foreground">
                  Product updates, tips, and promotional content
                </p>
              </div>
            </div>
            <Switch
              id="marketing_emails"
              checked={prefs.marketing_emails}
              onCheckedChange={(checked) => handleToggle('marketing_emails', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
