import { useMemo, useState } from 'react';
import { CreditCard, ShieldCheck, Trash2, Star, KeyRound, Banknote, Link, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { usePaymentMethods, useAddPaymentMethod, useSetDefaultPaymentMethod, useDeletePaymentMethod } from '@/hooks/usePaymentMethods';
import type { Database } from '@/integrations/supabase/types';

type Gateway = Database['public']['Enums']['payment_gateway'];

const gatewayFields: Record<Gateway, Array<{ key: string; label: string; placeholder?: string; type?: string }>> = {
  stripe: [
    { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_live_...' },
    { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password' },
    { key: 'webhook_secret', label: 'Webhook Secret', placeholder: 'whsec_...', type: 'password' },
  ],
  paypal: [
    { key: 'client_id', label: 'Client ID', placeholder: 'PayPal client id' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'PayPal secret', type: 'password' },
    { key: 'webhook_id', label: 'Webhook ID', placeholder: 'Optional webhook id' },
  ],
  payoneer: [
    { key: 'program_id', label: 'Program ID' },
    { key: 'api_username', label: 'API Username' },
    { key: 'api_password', label: 'API Password', type: 'password' },
  ],
  bank_transfer: [
    { key: 'account_holder', label: 'Account Holder' },
    { key: 'account_number', label: 'Account Number' },
    { key: 'routing_number', label: 'Routing/IFSC/Swift' },
    { key: 'bank_name', label: 'Bank Name' },
  ],
  payhere: [
    { key: 'merchant_id', label: 'Merchant ID' },
    { key: 'merchant_secret', label: 'Merchant Secret', type: 'password' },
  ],
};

const gatewayLabels: Record<Gateway, string> = {
  stripe: 'Stripe (Cards, ACH, UPI)',
  paypal: 'PayPal',
  payoneer: 'Payoneer',
  bank_transfer: 'Bank Transfer',
  payhere: 'PayHere',
};

export function PaymentMethods({ workspaceId }: { workspaceId?: string }) {
  const { data: methods, isLoading } = usePaymentMethods(workspaceId);
  const addMethod = useAddPaymentMethod();
  const setDefault = useSetDefaultPaymentMethod();
  const deleteMethod = useDeletePaymentMethod();

  const [gateway, setGateway] = useState<Gateway>('stripe');
  const [label, setLabel] = useState('');
  const [brand, setBrand] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [token, setToken] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const fields = useMemo(() => gatewayFields[gateway] || [], [gateway]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    addMethod.mutate({
      workspaceId,
      gateway,
      brand: brand || gatewayLabels[gateway],
      last_four: lastFour || undefined,
      token: token || undefined,
      expiry_month: expiryMonth ? Number(expiryMonth) : undefined,
      expiry_year: expiryYear ? Number(expiryYear) : undefined,
      metadata: {
        label: label || gatewayLabels[gateway],
        credentials,
      },
    });
  };

  const resetForm = () => {
    setLabel('');
    setBrand('');
    setLastFour('');
    setToken('');
    setExpiryMonth('');
    setExpiryYear('');
    setCredentials({});
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Method Credentials
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Store gateway API keys or bank payout details. Secrets stay inside Supabase.
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="w-3 h-3" />
              Encrypted at rest
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="gateway">Gateway</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(gatewayLabels) as Gateway[]).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant={gateway === key ? 'default' : 'outline'}
                      className="justify-start"
                      onClick={() => {
                        setGateway(key);
                        setCredentials({});
                      }}
                    >
                      <span>{gatewayLabels[key]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="label">Display Label</Label>
                <Input
                  id="label"
                  placeholder="e.g. Stripe Live, PayPal Sandbox"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="brand">Card/Bank Name</Label>
                  <Input
                    id="brand"
                    placeholder="Bank / Card brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastFour">Last 4 / Account Suffix</Label>
                  <Input
                    id="lastFour"
                    placeholder="1234"
                    value={lastFour}
                    onChange={(e) => setLastFour(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="expiryMonth">Expiry Month</Label>
                  <Input
                    id="expiryMonth"
                    placeholder="MM"
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="expiryYear">Expiry Year</Label>
                  <Input
                    id="expiryYear"
                    placeholder="YYYY"
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="token">Vault Token (optional)</Label>
                <Input
                  id="token"
                  placeholder="Store a tokenized reference instead of raw key"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Credentials</Label>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  {fields.map((field) => (
                    <div className="space-y-1" key={field.key}>
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input
                        type={field.type || 'text'}
                        placeholder={field.placeholder}
                        value={credentials[field.key] || ''}
                        onChange={(e) =>
                          setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Select a gateway to configure its credentials.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={!workspaceId || addMethod.isPending}>
                  {addMethod.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Method
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Clear
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              Connected Payment Methods
            </CardTitle>
            <p className="text-sm text-muted-foreground">Choose default funding and withdrawal rails.</p>
          </div>
          <Badge variant="secondary">{methods?.length || 0} saved</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading methods…</p>
          ) : methods && methods.length > 0 ? (
            methods.map((method) => (
              <div
                key={method.id}
                className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{gatewayLabels[method.gateway]}</Badge>
                    {method.is_default && (
                      <Badge variant="running" className="gap-1">
                        <Star className="w-3 h-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-foreground">
                    {(method.metadata as any)?.label || method.brand || gatewayLabels[method.gateway]}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <KeyRound className="w-3 h-3" />
                    {(method.metadata as any)?.credentials
                      ? Object.keys((method.metadata as any).credentials).join(', ') || 'Credentials stored'
                      : 'No credentials attached'}
                  </p>
                  {method.last_four && (
                    <p className="text-xs text-muted-foreground">Ending in {method.last_four}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!method.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        workspaceId && setDefault.mutate({ id: method.id, workspaceId })
                      }
                      disabled={setDefault.isPending}
                    >
                      {setDefault.isPending ? 'Updating…' : 'Set Default'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => workspaceId && deleteMethod.mutate({ id: method.id, workspaceId })}
                    disabled={deleteMethod.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Link className="w-4 h-4" />
              No payment methods added yet. Save a gateway above to enable deposits and withdrawals.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Ops Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Deposits</p>
            <p className="text-xs text-muted-foreground">
              Stripe/PayPal keys are used for fiat on-ramps. Connect at least one card processor.
            </p>
          </div>
          <Separator orientation="vertical" className="hidden md:block" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Payouts</p>
            <p className="text-xs text-muted-foreground">
              Bank Transfer or Payoneer method will be picked as the default withdrawal rail.
            </p>
          </div>
          <Separator orientation="vertical" className="hidden md:block" />
          <div className="space-y-1">
            <p className="text-sm font-semibold">Exchanges</p>
            <p className="text-xs text-muted-foreground">
              Keep exchange API keys in Connections → Add Connection (Binance, OKX, etc) for live sync.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
