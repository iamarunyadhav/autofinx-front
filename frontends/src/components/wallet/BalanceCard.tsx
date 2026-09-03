import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

// This is the shape useBalances() (hooks/useWallet.ts) actually returns
// (GET /workspaces/{id}/wallet/accounts) — a per-currency account row, not
// the raw single-row-per-workspace `ledgers` table (which has no `currency`
// column at all).
interface BalanceCardProps {
  balance: { id: string; currency: string; balance: number | null; available?: number | null; locked_balance?: number | null; available_balance?: number | null };
  onDeposit: () => void;
  onWithdraw: () => void;
}

// Use ASCII-safe markers to avoid encoding issues in builds
const currencyIcons: Record<string, string> = {
  USD: '$',
  USDT: 'T',
  BTC: 'B',
  ETH: 'E',
  EUR: 'EUR',
  GBP: 'GBP',
};

const currencyColors: Record<string, string> = {
  USD: 'from-green-500/20 to-green-600/10',
  USDT: 'from-emerald-500/20 to-emerald-600/10',
  BTC: 'from-orange-500/20 to-orange-600/10',
  ETH: 'from-blue-500/20 to-blue-600/10',
  EUR: 'from-indigo-500/20 to-indigo-600/10',
  GBP: 'from-purple-500/20 to-purple-600/10',
};

export function BalanceCard({ balance, onDeposit, onWithdraw }: BalanceCardProps) {
  const icon = currencyIcons[balance.currency] || '$';
  const colorClass = currencyColors[balance.currency] || 'from-gray-500/20 to-gray-600/10';

  // Normalize amounts regardless of shape returned from API
  const totalBalance = balance.balance ?? 0;
  const availableBalance =
    (balance as any).available_balance ?? (balance as any).available ?? totalBalance;
  const lockedBalance =
    (balance as any).locked_balance ?? Math.max(0, totalBalance - availableBalance);

  const formatAmount = (amount: number | null | undefined) => {
    const safeAmount = typeof amount === 'number' ? amount : 0;
    if (balance.currency === 'BTC') {
      return safeAmount.toFixed(8);
    }
    if (balance.currency === 'ETH') {
      return safeAmount.toFixed(6);
    }
    return safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClass} border-border/50 hover:border-border transition-colors`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <CardTitle className="text-lg font-semibold">{balance.currency}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-2xl font-bold">
            {formatAmount(totalBalance)}
          </p>
          <p className="text-sm text-muted-foreground">Total Balance</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Available</p>
            <p className="font-medium text-green-500">{formatAmount(availableBalance)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Locked</p>
            <p className="font-medium text-yellow-500">{formatAmount(lockedBalance)}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onDeposit}
          >
            <ArrowDownToLine className="h-4 w-4 mr-1" />
            Deposit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onWithdraw}
          >
            <ArrowUpFromLine className="h-4 w-4 mr-1" />
            Withdraw
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
