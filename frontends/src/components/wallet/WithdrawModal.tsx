import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWithdraw } from '@/hooks/useWallet';
import { usePaymentMethods, type PaymentMethod } from '@/hooks/usePaymentMethods';
import { ArrowUpFromLine, Loader2, AlertTriangle } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
type Ledger = { currency: string; available?: number; balance?: number };

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
  workspaceId: string | undefined;
  balances: Ledger[];
}

export function WithdrawModal({ open, onOpenChange, defaultCurrency, workspaceId, balances }: WithdrawModalProps) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [otp, setOtp] = useState('');
  const [payoutMethodId, setPayoutMethodId] = useState<string | undefined>();
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer');
  const [destinationAccount, setDestinationAccount] = useState('');
  
  const withdraw = useWithdraw();
  const { data: paymentMethods } = usePaymentMethods(workspaceId);

  const selectedBalance = balances.find(b => b.currency === currency);
  const availableBalance = Number(selectedBalance?.available ?? selectedBalance?.balance ?? 0) || 0;
  const insufficientFunds = parseFloat(amount) > availableBalance;
  const defaultPayout = useMemo(
    () => paymentMethods?.find((m) => m.is_default) || paymentMethods?.[0],
    [paymentMethods]
  );
  const selectedPayout = useMemo(
    () => paymentMethods?.find((m) => m.id === payoutMethodId) || defaultPayout,
    [paymentMethods, payoutMethodId, defaultPayout]
  );
  const getLabel = (method?: PaymentMethod) => {
    const meta = (method?.metadata as any) || {};
    return meta.label || method?.brand || method?.gateway;
  };

  useEffect(() => {
    if (defaultPayout) {
      setPayoutMethodId(defaultPayout.id);
    }
  }, [defaultPayout]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !amount || insufficientFunds) return;

    await withdraw.mutateAsync({
      workspaceId,
      currency,
      amount: parseFloat(amount),
      method: (selectedPayout?.gateway as string) || withdrawMethod,
      description,
      destinationMeta: {
        otp_code: otp || undefined,
        payout_method_id: payoutMethodId || undefined,
        payout_label: getLabel(selectedPayout) || undefined,
        destination_account: destinationAccount || undefined,
      },
    });

    setAmount('');
    setDescription('');
    setOtp('');
    onOpenChange(false);
  };

  const handleMaxClick = () => {
    setAmount(availableBalance.toString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
            Withdraw Funds
          </DialogTitle>
          <DialogDescription>
            Withdraw funds from your wallet to external account.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {balances.map((b) => {
                  const available = Number(b.available ?? b.balance ?? 0) || 0;
                  return (
                    <SelectItem key={b.currency} value={b.currency}>
                      {b.currency} (Available: {available.toFixed(2)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <Button type="button" variant="link" size="sm" onClick={handleMaxClick} className="h-auto p-0">
                Max: {availableBalance.toFixed(2)} {currency}
              </Button>
            </div>
            <Input
              id="amount"
              type="number"
              step="any"
              min="0"
              max={availableBalance}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {insufficientFunds && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient funds. Available balance: {availableBalance.toFixed(2)} {currency}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="method">Withdraw Method</Label>
            <Select value={withdrawMethod} onValueChange={setWithdrawMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select withdrawal method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="payoneer">Payoneer</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="stripe">Stripe/Card Refund</SelectItem>
                <SelectItem value="payhere">PayHere</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethods && paymentMethods.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="payout">Payout Method</Label>
                <p className="text-[10px] text-muted-foreground">
                  Selected: {getLabel(selectedPayout) || 'None'}
                </p>
              </div>
              <Select value={payoutMethodId} onValueChange={setPayoutMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payout rail" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {getLabel(method)} {method.is_default ? '(Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Bank Transfer / Payoneer will be used for off-ramp. Cards and PayPal for refunds.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="destination">Destination Account / Email</Label>
            <Input
              id="destination"
              placeholder="Bank account / email / wallet id"
              value={destinationAccount}
              onChange={(e) => setDestinationAccount(e.target.value)}
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

          <div className="space-y-2">
            <Label htmlFor="otp">2FA Code</Label>
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={withdraw.isPending || !amount || insufficientFunds}>
              {withdraw.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  Withdraw
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
