import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MoreVertical, 
  Power, 
  Trash2, 
  Edit, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  TestTube,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Database } from '@/integrations/supabase/types';

type ExchangeConnection = Database['public']['Tables']['exchange_connections']['Row'] & {
  masked_api_key?: string | null;
  masked_api_secret?: string | null;
  masked_passphrase?: string | null;
};

interface ConnectionCardProps {
  connection: ExchangeConnection;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  onSync: (id: string) => void;
  onEdit: (connection: ExchangeConnection) => void;
  onRotate: (id: string) => void;
  isTesting?: boolean;
  isSyncing?: boolean;
}

const exchangeLogos: Record<string, string> = {
  binance: '🟡',
  coinbase: '🔵',
  kraken: '🟣',
  bybit: '🟠',
  okx: '⚪',
  kucoin: '🟢',
};

const exchangeColors: Record<string, string> = {
  binance: 'from-yellow-500/20 to-yellow-600/5',
  coinbase: 'from-blue-500/20 to-blue-600/5',
  kraken: 'from-purple-500/20 to-purple-600/5',
  bybit: 'from-orange-500/20 to-orange-600/5',
  okx: 'from-gray-500/20 to-gray-600/5',
  kucoin: 'from-green-500/20 to-green-600/5',
};

export function ConnectionCard({ 
  connection, 
  onToggle, 
  onDelete, 
  onTest,
  onSync,
  onEdit,
  onRotate,
  isTesting,
  isSyncing
}: ConnectionCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const permissions = connection.permissions as { trade?: boolean; read?: boolean; withdraw?: boolean } | null;

  const formatLastSynced = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        layout
      >
        <Card className={`relative overflow-hidden bg-gradient-to-br ${exchangeColors[connection.provider] || 'from-muted/50 to-muted/20'}`}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">
                  {exchangeLogos[connection.provider] || '🔗'}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{connection.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{connection.provider}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={connection.is_enabled ?? false}
                  onCheckedChange={(checked) => onToggle(connection.id, checked)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => onSync(connection.id)}
                      disabled={!connection.is_enabled || isSyncing}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Balances'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onTest(connection.id)}>
                      <TestTube className="mr-2 h-4 w-4" />
                      Test Connection
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(connection)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onRotate(connection.id)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rotate Secrets
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              {connection.is_enabled ? (
                <Badge variant="outline" className="bg-running/10 text-running border-running/30">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  <XCircle className="mr-1 h-3 w-3" />
                  Disabled
                </Badge>
              )}
              {connection.is_testnet && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  Testnet
                </Badge>
              )}
              {isTesting && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  Testing...
                </Badge>
              )}
              {isSyncing && (
                <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/30">
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  Syncing...
                </Badge>
              )}
            </div>

            {/* Permissions */}
            <div className="flex flex-wrap gap-2">
              {permissions?.read && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Read
                </span>
              )}
              {permissions?.trade && (
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  Trade
                </span>
              )}
              {permissions?.withdraw && (
                <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                  Withdraw
                </span>
              )}
            </div>

            {/* Last Synced */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last synced: {formatLastSynced(connection.last_synced_at)}</span>
            </div>

            {connection.masked_api_key && (
              <div className="text-xs text-muted-foreground">
                API Key: <span className="font-mono text-foreground">{connection.masked_api_key}</span>
              </div>
            )}
            {connection.masked_api_secret && (
              <div className="text-xs text-muted-foreground">
                Secret: <span className="font-mono text-foreground">{connection.masked_api_secret}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{connection.name}"? This will stop all trading 
              activities using this connection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(connection.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
