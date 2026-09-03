import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ExchangeConnection } from '@/hooks/useConnections';

const editConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  passphrase: z.string().optional(),
  is_testnet: z.boolean().default(false),
  is_enabled: z.boolean().default(true),
});

type EditConnectionFormData = z.infer<typeof editConnectionSchema>;

interface EditConnectionModalProps {
  connection: ExchangeConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, data: Partial<EditConnectionFormData>) => void;
  isLoading?: boolean;
}

const exchangeLogos: Record<string, string> = {
  binance: 'BN',
  metal_broker: 'MB',
  coinbase: 'CB',
  kraken: 'KR',
  bybit: 'BB',
  okx: 'OK',
  kucoin: 'KC',
};

const exchangesRequiringPassphrase = ['coinbase', 'okx', 'kucoin'];

export function EditConnectionModal({
  connection,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: EditConnectionModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [updateCredentials, setUpdateCredentials] = useState(false);

  const form = useForm<EditConnectionFormData>({
    resolver: zodResolver(editConnectionSchema),
    defaultValues: {
      name: '',
      api_key: '',
      api_secret: '',
      passphrase: '',
      is_testnet: false,
      is_enabled: true,
    },
  });

  useEffect(() => {
    if (connection) {
      form.reset({
        name: connection.name,
        api_key: '',
        api_secret: '',
        passphrase: '',
        is_testnet: connection.is_testnet ?? false,
        is_enabled: connection.is_enabled ?? true,
      });
      setUpdateCredentials(false);
    }
  }, [connection, form]);

  const requiresPassphrase = connection && exchangesRequiringPassphrase.includes(connection.provider);

  const handleSubmit = (data: EditConnectionFormData) => {
    if (!connection) return;
    
    const updates: Partial<EditConnectionFormData> = {
      name: data.name,
      is_testnet: data.is_testnet,
      is_enabled: data.is_enabled,
    };

    if (updateCredentials) {
      if (data.api_key) updates.api_key = data.api_key;
      if (data.api_secret) updates.api_secret = data.api_secret;
      if (data.passphrase) updates.passphrase = data.passphrase;
    }

    onSubmit(connection.id, updates);
  };

  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{exchangeLogos[connection.provider] || '🔗'}</span>
            Edit Connection
          </DialogTitle>
          <DialogDescription>
            Update settings for your {connection.provider} connection
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Main Trading Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Update API Credentials</p>
                <p className="text-xs text-muted-foreground">
                  Enable to change your API keys
                </p>
              </div>
              <Switch
                checked={updateCredentials}
                onCheckedChange={setUpdateCredentials}
              />
            </div>

            {updateCredentials && (
              <>
                <Alert className="bg-primary/5 border-primary/20">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    Enter new credentials to replace the existing ones. Leave fields empty to keep current values.
                  </AlertDescription>
                </Alert>

                <FormField
                  control={form.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New API Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showApiKey ? 'text' : 'password'} 
                            placeholder="Enter new API key (optional)" 
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="api_secret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New API Secret</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showApiSecret ? 'text' : 'password'} 
                            placeholder="Enter new API secret (optional)" 
                            {...field} 
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowApiSecret(!showApiSecret)}
                          >
                            {showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {requiresPassphrase && (
                  <FormField
                    control={form.control}
                    name="passphrase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New API Passphrase</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassphrase ? 'text' : 'password'} 
                              placeholder="Enter new passphrase (optional)" 
                              {...field} 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full px-3"
                              onClick={() => setShowPassphrase(!showPassphrase)}
                            >
                              {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Required for {connection.provider}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            <FormField
              control={form.control}
              name="is_testnet"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Testnet Mode</FormLabel>
                    <FormDescription className="text-xs">
                      Use testnet/sandbox environment
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Connection Enabled</FormLabel>
                    <FormDescription className="text-xs">
                      Allow trading with this connection
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

