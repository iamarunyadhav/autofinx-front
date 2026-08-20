import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Clock, CheckCircle2, AlertTriangle, RefreshCcw } from 'lucide-react';

interface TimelineItem {
  title: string;
  body?: string;
  status: 'pending' | 'success' | 'error';
  at?: string;
}

interface PayoutTimelineProps {
  title?: string;
  reference?: string;
  status?: string;
  events?: TimelineItem[];
}

export function PayoutTimeline({ title = 'Payout Status', reference, status, events = [] }: PayoutTimelineProps) {
  const badgeVariant = status === 'succeeded' ? 'running' : status === 'failed' ? 'destructive' : 'outline';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {reference && <p className="text-xs text-muted-foreground">Ref: {reference}</p>}
        </div>
        {status && <Badge variant={badgeVariant}>{status}</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout updates yet.</p>
        ) : (
          events.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.at && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(item.at), 'MMM d, yyyy HH:mm')}
                    </span>
                  )}
                </div>
                {item.body && <p className="text-xs text-muted-foreground">{item.body}</p>}
                {idx < events.length - 1 && <Separator className="my-2" />}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function StatusIcon({ status }: { status: 'pending' | 'success' | 'error' }) {
  const map = {
    pending: <Clock className="w-4 h-4 text-muted-foreground" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    error: <AlertTriangle className="w-4 h-4 text-red-500" />,
  };
  return map[status] || <RefreshCcw className="w-4 h-4 text-muted-foreground" />;
}
