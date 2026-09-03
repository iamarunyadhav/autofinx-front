import { motion } from 'framer-motion';
import { Clock, Calendar, Zap, Settings, MoreVertical, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useToggleSchedule, useDeleteSchedule, type Schedule } from '@/hooks/useScheduler';

interface ScheduleCardProps {
  schedule: Schedule;
  index: number;
  onEdit: () => void;
}

const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ScheduleCard({ schedule, index, onEdit }: ScheduleCardProps) {
  const toggleSchedule = useToggleSchedule();
  const deleteSchedule = useDeleteSchedule();
  const [showDelete, setShowDelete] = useState(false);

  const activeDays = (schedule.active_days || [1, 2, 3, 4, 5]).map(d => dayNames[d]).join(', ');
  const interval = schedule.evaluation_interval_ms 
    ? `${(schedule.evaluation_interval_ms / 1000).toFixed(0)}s` 
    : '60s';

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="bg-card border-border hover:border-primary/30 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  {schedule.name || 'Unnamed Schedule'}
                </CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant="outline"
                    className={schedule.is_enabled
                      ? 'bg-[hsl(var(--running))]/10 text-[hsl(var(--running))] border-[hsl(var(--running))]/30'
                      : 'bg-muted text-muted-foreground'
                    }
                  >
                    {schedule.is_enabled ? 'Active' : 'Paused'}
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
                  <DropdownMenuItem onClick={onEdit}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Schedule
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowDelete(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Time Window */}
            <div className="flex items-center gap-3 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Active:</span>
              <span className="font-mono">
                {schedule.start_time || '09:00'} - {schedule.end_time || '17:00'}
              </span>
              <Badge variant="outline" className="text-xs ml-auto">
                {schedule.timezone || 'UTC'}
              </Badge>
            </div>

            {/* Active Days */}
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Days:</span>
              <span>{activeDays}</span>
            </div>

            {/* Frequency */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-muted-foreground text-xs">Interval</p>
                <p className="font-mono font-medium">{interval}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-muted-foreground text-xs">Max/Hour</p>
                <p className="font-mono font-medium">{schedule.max_trades_per_hour || 10}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 text-center">
                <p className="text-muted-foreground text-xs">Max/Day</p>
                <p className="font-mono font-medium">{schedule.max_trades_per_day || 50}</p>
              </div>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Schedule enabled</span>
              <Switch
                checked={schedule.is_enabled ?? false}
                onCheckedChange={(checked) => 
                  toggleSchedule.mutate({ scheduleId: schedule.id, isEnabled: checked })
                }
                disabled={toggleSchedule.isPending}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? The bot will no longer have time restrictions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSchedule.mutate(schedule.id)}
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
