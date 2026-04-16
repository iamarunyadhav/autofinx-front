import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTransfer } from '@/hooks/useWallet';
import { ArrowLeftRight, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
type Ledger = { currency: string; available?: number; balance?: number };

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  balances: Ledger[];
}

export function TransferModal({ open, onOpenChange, workspaceId, balances }: TransferModalProps) {
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('USDT');
  const [amount, setAmount] = useState('');
  
  const transfer = useTransfer();

  const fromBalance = balances.find(b => b.currency === fromCurrency);
  const availableBalance = Number(fromBalance?.available ?? fromBalance?.balance ?? 0) || 0;
  const insufficientFunds = parseFloat(amount) > availableBalance;
  const sameCurrency = fromCurrency === toCurrency;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !amount || insufficientFunds || sameCurrency) return;

    await transfer.mutateAsync({
      workspaceId,
      fromCurrency,
      toCurrency,
      amount: parseFloat(amount),
    });

    setAmount('');
    onOpenChange(false);
  };

  const handleMaxClick = () => {
    setAmount(availableBalance.toString());
  };

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-500" />
            Transfer Funds
          </DialogTitle>
          <DialogDescription>
            Transfer funds between currencies in your wallet.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>From</Label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => (
                    <SelectItem key={b.currency} value={b.currency}>
                      {b.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button type="button" variant="ghost" size="icon" onClick={handleSwap}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <div className="flex-1 space-y-2">
              <Label>To</Label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => (
                    <SelectItem key={b.currency} value={b.currency}>
                      {b.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sameCurrency && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Cannot transfer to the same currency
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount</Label>
              <Button type="button" variant="link" size="sm" onClick={handleMaxClick} className="h-auto p-0">
                Max: {availableBalance.toFixed(2)} {fromCurrency}
              </Button>
            </div>
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

          {insufficientFunds && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Insufficient funds. Available: {availableBalance.toFixed(2)} {fromCurrency}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={transfer.isPending || !amount || insufficientFunds || sameCurrency}>
              {transfer.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
