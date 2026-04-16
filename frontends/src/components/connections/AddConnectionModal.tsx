import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Info, ShieldCheck } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

const connectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  provider: z.string().min(1, 'Provider is required'),
  api_key: z.string().min(1, 'API Key is required'),
  api_secret: z.string().min(1, 'API Secret is required'),
  passphrase: z.string().optional(),
  is_testnet: z.boolean().default(false),
});

type ConnectionFormData = z.infer<typeof connectionSchema>;

interface AddConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ConnectionFormData) => void;
  isLoading?: boolean;
}

const exchanges = [
  { id: 'binance', name: 'Binance', logo: 'BN', requiresPassphrase: false },
  { id: 'metal_broker', name: 'Metal Broker', logo: 'MB', requiresPassphrase: false },
  { id: 'coinbase', name: 'Coinbase Pro', logo: 'CB', requiresPassphrase: true },
  { id: 'kraken', name: 'Kraken', logo: 'KR', requiresPassphrase: false },
  { id: 'bybit', name: 'Bybit', logo: 'BB', requiresPassphrase: false },
  { id: 'okx', name: 'OKX', logo: 'OK', requiresPassphrase: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'KC', requiresPassphrase: true },
];

export function AddConnectionModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: AddConnectionModalProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      name: '',
      provider: '',
      api_key: '',
      api_secret: '',
      passphrase: '',
      is_testnet: false,
    },
  });

  const selectedProvider = form.watch('provider');
  const selectedExchange = exchanges.find(e => e.id === selectedProvider);

  const handleSubmit = (data: ConnectionFormData) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Exchange Connection</DialogTitle>
          <DialogDescription>
            Connect your exchange account to enable automated trading
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-primary/5 border-primary/20">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            Your API credentials are encrypted and stored securely. We recommend using 
            API keys with trade permissions only (no withdrawal access).
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an exchange" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exchanges.map((exchange) => (
                        <SelectItem key={exchange.id} value={exchange.id}>
                          <div className="flex items-center gap-2">
                            <span>{exchange.logo}</span>
                            <span>{exchange.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Main Trading Account" {...field} />
                  </FormControl>
                  <FormDescription>A friendly name to identify this connection</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showApiKey ? 'text' : 'password'} 
                        placeholder="Enter your API key" 
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
                  <FormLabel>API Secret</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showApiSecret ? 'text' : 'password'} 
                        placeholder="Enter your API secret" 
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

            {selectedExchange?.requiresPassphrase && (
              <FormField
                control={form.control}
                name="passphrase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Passphrase</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type={showPassphrase ? 'text' : 'password'} 
                          placeholder="Enter your API passphrase" 
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
                      Required for {selectedExchange.name}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_testnet"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Testnet Mode</FormLabel>
                    <FormDescription className="text-xs">
                      Use testnet/sandbox environment for paper trading
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
                {isLoading ? 'Adding...' : 'Add Connection'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

