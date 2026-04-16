import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDeposit } from '@/hooks/useWallet';
import { ArrowDownToLine, Loader2 } from 'lucide-react';

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  workspaceId: string | undefined;
}

const currencies = ['USD', 'LKR', 'USDT', 'BTC', 'ETH', 'EUR', 'GBP'];
const gateways = [
  { value: 'payhere', label: 'PayHere (Sri Lanka)' },
  { value: 'card', label: 'Credit / Debit Card' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'payoneer', label: 'Payoneer' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

const gatewayHints: Record<string, string> = {
  card: 'Card details are entered on a secure Stripe-hosted page (PCI-safe).',
  stripe: 'Stripe hosted checkout opens after you click Deposit.',
  payhere: 'PayHere checkout opens in the next step.',
  paypal: 'PayPal approval page opens in the next step.',
  payoneer: 'Payoneer checkout link opens in the next step.',
  bank_transfer: 'A bank-transfer reference will be created for manual settlement.',
};

export function DepositModal({ open, onOpenChange, defaultCurrency, workspaceId }: DepositModalProps) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('');
  const [gateway, setGateway] = useState('payhere');
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [description, setDescription] = useState('');
  
  const deposit = useDeposit();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !amount) return;

    const result = await deposit.mutateAsync({
      workspaceId,
      currency,
      amount: parseFloat(amount),
      gateway,
      environment,
      description: description || undefined,
    });

    const checkoutUrl = result?.checkout?.checkout_url;
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }

    setAmount('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-green-500" />
            Deposit Funds
          </DialogTitle>
          <DialogDescription>
            Add funds to your wallet. Select currency and enter amount.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gateway">Payment Method</Label>
            <Select value={gateway} onValueChange={setGateway}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment gateway" />
              </SelectTrigger>
              <SelectContent>
                {gateways.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{gatewayHints[gateway]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Select value={environment} onValueChange={(v: 'sandbox' | 'live') => setEnvironment(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (test money)</SelectItem>
                <SelectItem value="live">Live (real money)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a note..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={deposit.isPending || !amount}>
              {deposit.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Continue to Pay
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
