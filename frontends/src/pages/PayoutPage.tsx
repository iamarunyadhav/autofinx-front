import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePayout, useRetryPayout } from '@/hooks/usePayouts';
import { PayoutTimeline } from '@/components/wallet/PayoutTimeline';
import { format } from 'date-fns';

export default function PayoutPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, refetch } = usePayout(id);
  const retry = useRetryPayout();

  const payout = data?.payout;
  const events = payout?.events || [];

  const handleRetry = async () => {
    if (!id) return;
    await retry.mutateAsync(id);
    refetch();
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Payout Timeline</h1>
          <p className="text-muted-foreground">Status, history, and actions for payout #{id}</p>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payout Details</CardTitle>
              {payout?.reference && <p className="text-xs text-muted-foreground">Ref: {payout.reference}</p>}
            </div>
            <Badge variant={payout?.status === 'succeeded' ? 'running' : payout?.status === 'failed' ? 'destructive' : 'outline'}>
              {payout?.status || 'unknown'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : payout ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Amount: {payout.amount} {payout.currency || 'USD'} · Provider: {payout.provider || 'N/A'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Created: {payout.created_at ? format(new Date(payout.created_at), 'PPpp') : 'N/A'}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isLoading}>
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRetry} disabled={retry.isPending}>
                    {retry.isPending ? 'Retrying...' : 'Retry'}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Payout not found.</p>
            )}
          </CardContent>
        </Card>

        <PayoutTimeline reference={payout?.reference} status={payout?.status} events={events} />
      </div>
    </AppShell>
  );
}
