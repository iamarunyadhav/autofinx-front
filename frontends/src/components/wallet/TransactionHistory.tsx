import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Receipt, DollarSign, RefreshCcw, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
type LedgerTransaction = {
  id: string;
  currency?: string;
  amount: number;
  tx_type: string;
  balance_after?: number | null;
  description?: string;
  created_at?: string;
  meta?: any;
};

interface TransactionHistoryProps {
  transactions: LedgerTransaction[];
  isLoading: boolean;
}

const txTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  deposit: { icon: ArrowDownToLine, color: 'text-green-500', label: 'Deposit' },
  withdrawal: { icon: ArrowUpFromLine, color: 'text-orange-500', label: 'Withdrawal' },
  transfer: { icon: ArrowLeftRight, color: 'text-blue-500', label: 'Transfer' },
  fee: { icon: Receipt, color: 'text-red-500', label: 'Fee' },
  pnl: { icon: DollarSign, color: 'text-purple-500', label: 'P&L' },
  subscription: { icon: Receipt, color: 'text-yellow-500', label: 'Subscription' },
  refund: { icon: RefreshCcw, color: 'text-cyan-500', label: 'Refund' },
};

export function TransactionHistory({ transactions, isLoading }: TransactionHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No transactions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const config = txTypeConfig[tx.tx_type] || { icon: Receipt, color: 'text-muted-foreground', label: tx.tx_type };
              const Icon = config.icon;
              const isPositive = ['deposit', 'refund', 'pnl'].includes(tx.tx_type) && tx.amount > 0;
              
              return (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${config.color}`} />
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{tx.currency}</TableCell>
                  <TableCell>
                    <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                      {isPositive ? '+' : ''}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.balance_after?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }) || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[240px] truncate">
                    <div className="space-y-1">
                      <p className="truncate">{tx.description || '-'}</p>
                      {tx.meta?.payment_id && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">Payout</Badge>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto px-0 py-0 text-[12px]"
                            onClick={() => window.open(`/payouts/${tx.meta?.payment_id}`, '_blank')}
                          >
                            View timeline <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {tx.created_at ? format(new Date(tx.created_at), 'MMM d, yyyy HH:mm') : '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
