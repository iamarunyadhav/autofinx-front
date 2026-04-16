import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Clock, Zap, Settings2 } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSchedules } from '@/hooks/useScheduler';
import { useStrategyInstances } from '@/hooks/useStrategy';
import { ScheduleCard } from '@/components/scheduler/ScheduleCard';
import { ScheduleBuilder } from '@/components/scheduler/ScheduleBuilder';
import { ScheduleSimulator } from '@/components/scheduler/ScheduleSimulator';

export default function SchedulerPage() {
  const { currentWorkspace } = useWorkspace();
  const { data: schedules = [], isLoading } = useSchedules(currentWorkspace?.id);
  const { data: instances = [] } = useStrategyInstances(currentWorkspace?.id);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);

  // Instances without schedules
  const instancesWithoutSchedule = instances.filter(
    inst => !schedules.some(sch => sch.instance_id === inst.id)
  );

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Scheduler</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure when your trading bots are active
            </p>
          </div>
          <Button
            onClick={() => setShowBuilder(true)}
            disabled={instancesWithoutSchedule.length === 0}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Schedules</p>
                  <p className="text-2xl font-bold font-mono">
                    {schedules.filter(s => s.is_enabled).length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bots Scheduled</p>
                  <p className="text-2xl font-bold font-mono">{schedules.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unscheduled Bots</p>
                  <p className="text-2xl font-bold font-mono">{instancesWithoutSchedule.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-[hsl(var(--warning))]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Schedule List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Trading Schedules</h2>
            <Badge variant="outline" className="text-xs">
              {schedules.length} configured
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="bg-card border-border">
                  <CardHeader>
                    <Skeleton className="h-6 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-8 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : schedules.length === 0 ? (
            <Card className="bg-card border-border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No schedules configured yet.
                  <br />
                  <span className="text-sm">Add a schedule to control when your bots trade.</span>
                </p>
                {instancesWithoutSchedule.length > 0 && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowBuilder(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Schedule
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {schedules.map((schedule, index) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  index={index}
                  onEdit={() => setEditingSchedule(schedule.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Schedule Simulator */}
        {schedules.length > 0 && (
          <ScheduleSimulator schedules={schedules} />
        )}

        {/* Schedule Builder Modal */}
        {showBuilder && (
          <ScheduleBuilder
            instances={instancesWithoutSchedule}
            onClose={() => setShowBuilder(false)}
          />
        )}

        {/* Edit Schedule Modal */}
        {editingSchedule && (
          <ScheduleBuilder
            editScheduleId={editingSchedule}
            onClose={() => setEditingSchedule(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
