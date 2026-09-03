import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSimulateSchedule, type Schedule } from '@/hooks/useScheduler';

interface ScheduleSimulatorProps {
  schedules: Schedule[];
}

export function ScheduleSimulator({ schedules }: ScheduleSimulatorProps) {
  const simulateSchedule = useSimulateSchedule();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [timestamps, setTimestamps] = useState<string[]>([]);

  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
    }
  }, [schedules, selectedSchedule]);

  const handleSimulate = async () => {
    if (!selectedSchedule) return;
    
    const result = await simulateSchedule.mutateAsync({
      timezone: selectedSchedule.timezone || 'UTC',
      active_days: selectedSchedule.active_days || [1, 2, 3, 4, 5],
      start_time: selectedSchedule.start_time || '09:00',
      end_time: selectedSchedule.end_time || '17:00',
      max_trades_per_hour: selectedSchedule.max_trades_per_hour || 10,
      is_enabled: selectedSchedule.is_enabled ?? true,
    });
    
    setTimestamps(result.timestamps || []);
  };

  const activeHours = Math.round((timestamps.length * (selectedSchedule?.evaluation_interval_ms || 60000)) / 3600000 * 10) / 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Schedule Simulator
            </CardTitle>
            <Button
              size="sm"
              onClick={handleSimulate}
              disabled={simulateSchedule.isPending || !selectedSchedule}
              className="gap-1"
            >
              <Play className="h-3 w-3" />
              Simulate 24h
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {timestamps.length ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Active Hours</p>
                  <p className="text-xl font-bold font-mono">{activeHours}h</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Max Trades Possible</p>
                  <p className="text-xl font-bold font-mono">{timestamps.length}</p>
                </div>
              </div>

              {/* Hour-by-hour visualization */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">24-Hour Activity</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: 24 }).map((_, hour) => {
                    const hasTrigger = timestamps.some((ts) => new Date(ts).getHours() === hour);
                    return (
                    <div
                      key={hour}
                      className={`flex-1 h-8 rounded-sm transition-colors ${
                        hasTrigger 
                          ? 'bg-primary hover:bg-primary/80' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                      title={`Hour ${hour.toString().padStart(2, '0')}:00 ${hasTrigger ? 'Active' : 'Inactive'}`}
                    />
                  );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                First 5 triggers: {timestamps.slice(0, 5).join(', ') || 'none'}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Click "Simulate 24h" to see when your schedule will be active
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
