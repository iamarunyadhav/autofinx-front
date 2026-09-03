import { motion } from 'framer-motion';
import { Play, Pause, Settings, BarChart3, Trash2, MoreVertical, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToggleInstance, useSetMode, useDeleteInstance, type StrategyInstanceWithRelations } from '@/hooks/useStrategy';
import { useConnections } from '@/hooks/useConnections';
import { ConnectionSelector } from './ConnectionSelector';

type StrategyInstance = StrategyInstanceWithRelations;

interface StrategyInstancesProps {
  instances: StrategyInstance[];
  isLoading: boolean;
  onEdit: (instance: StrategyInstance) => void;
  onBacktest: (instance: StrategyInstance) => void;
  strategyTypeIcons: Record<string, React.ElementType>;
}

export function StrategyInstances({ instances, isLoading, onEdit, onBacktest, strategyTypeIcons }: StrategyInstancesProps) {
  const { currentWorkspace } = useWorkspace();
  const toggleInstance = useToggleInstance();
  const setMode = useSetMode();
  const deleteInstance = useDeleteInstance();
  const [deleteTarget, setDeleteTarget] = useState<StrategyInstance | null>(null);
  const { data: connections } = useConnections(currentWorkspace?.id);

  const handleToggle = (instance: StrategyInstance) => {
    if (!currentWorkspace) return;
    toggleInstance.mutate({
      instanceId: instance.id,
      workspaceId: currentWorkspace.id,
      isEnabled: instance.status !== 'running',
    });
  };

  const handleModeSwitch = (instance: StrategyInstance) => {
    if (!currentWorkspace) return;
    setMode.mutate({
      instanceId: instance.id,
      workspaceId: currentWorkspace.id,
      mode: instance.mode === 'paper' ? 'live' : 'paper',
      connectionId: instance.connection_id || connections?.[0]?.id,
    });
  };

  const handleDelete = () => {
    if (!currentWorkspace || !deleteTarget) return;
    deleteInstance.mutate({
      instanceId: deleteTarget.id,
      workspaceId: currentWorkspace.id,
    });
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No active bots yet.
            <br />
            <span className="text-sm">Create your first trading bot to get started.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances.map((instance, index) => (
          <motion.div
            key={instance.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{instance.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge 
                        variant="outline" 
                        className={instance.mode === 'live' 
                          ? 'bg-[hsl(var(--live))]/10 text-[hsl(var(--live))] border-[hsl(var(--live))]/30' 
                          : 'bg-[hsl(var(--paper))]/10 text-[hsl(var(--paper))] border-[hsl(var(--paper))]/30'
                        }
                      >
                        {instance.mode === 'live' ? '● LIVE' : '◌ PAPER'}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={instance.status === 'running'
                          ? 'bg-[hsl(var(--running))]/10 text-[hsl(var(--running))] border-[hsl(var(--running))]/30'
                          : 'bg-[hsl(var(--paused))]/10 text-[hsl(var(--paused))] border-[hsl(var(--paused))]/30'
                        }
                      >
                        {instance.status === 'running' ? 'Running' : 'Paused'}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      <DropdownMenuItem onClick={() => onEdit(instance)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Parameters
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onBacktest(instance)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Run Backtest
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <div className="px-2 py-1.5">
                          <p className="text-xs text-muted-foreground mb-1">Connection</p>
                          <ConnectionSelector
                            connections={connections || []}
                            value={instance.connection_id}
                            onChange={(id) => {
                              if (!currentWorkspace) return;
                              setMode.mutate({
                                instanceId: instance.id,
                                workspaceId: currentWorkspace.id,
                                mode: instance.mode as 'paper' | 'live',
                                connectionId: id,
                              });
                            }}
                          />
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleModeSwitch(instance)}>
                        {instance.mode === 'paper' ? (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Switch to Live
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 mr-2" />
                            Switch to Paper
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget(instance)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Bot
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>
                      {instance.allowed_symbols?.length 
                        ? `${instance.allowed_symbols.length} symbols` 
                        : 'All symbols'
                      }
                    </span>
                    <span className="text-xs text-primary flex items-center gap-1">
                      Connection: {connections?.find((c) => c.id === instance.connection_id)?.name || 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {instance.status === 'running' ? 'On' : 'Off'}
                    </span>
                    <Switch
                      checked={instance.status === 'running'}
                      onCheckedChange={() => handleToggle(instance)}
                      disabled={toggleInstance.isPending}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
