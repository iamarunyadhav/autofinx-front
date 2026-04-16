import { Badge } from '@/components/ui/badge';

export function OrderStatusBadge({ status }: { status?: string | null }) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'filled') return <Badge variant="running">Filled</Badge>;
  if (normalized === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (normalized === 'pending_provider' || normalized === 'pending') return <Badge variant="outline">Pending Provider</Badge>;
  return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
}
