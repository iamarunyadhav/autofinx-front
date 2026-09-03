import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Calendar, Zap, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent } from '@/components/ui/card';
import { useCreateSchedule, useUpdateSchedule } from '@/hooks/useScheduler';
import type { StrategyInstanceWithRelations } from '@/hooks/useStrategy';

type StrategyInstance = StrategyInstanceWithRelations;

interface ScheduleBuilderProps {
  instances?: StrategyInstance[];
  editScheduleId?: string;
  onClose: () => void;
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
];

const dayOptions = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '7', label: 'Sun' },
];

export function ScheduleBuilder({ instances, editScheduleId, onClose }: ScheduleBuilderProps) {
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const isEditing = !!editScheduleId;

  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [timezone, setTimezone] = useState('UTC');
  const [activeDays, setActiveDays] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [intervalMs, setIntervalMs] = useState(60000);
  const [cooldown, setCooldown] = useState(30);
  const [maxTradesPerHour, setMaxTradesPerHour] = useState(10);
  const [maxTradesPerDay, setMaxTradesPerDay] = useState(50);
  const [isEnabled, setIsEnabled] = useState(true);

  const handleSubmit = async () => {
    const scheduleData = {
      timezone,
      active_days: activeDays.map(Number),
      start_time: startTime,
      end_time: endTime,
      evaluation_interval_ms: intervalMs,
      cooldown_seconds: cooldown,
      max_trades_per_hour: maxTradesPerHour,
      max_trades_per_day: maxTradesPerDay,
      is_enabled: isEnabled,
    };

    if (isEditing) {
      await updateSchedule.mutateAsync({
        scheduleId: editScheduleId,
        scheduleData,
      });
    } else {
      await createSchedule.mutateAsync({
        instanceId: selectedInstance,
        scheduleData,
      });
    }
    onClose();
  };

  const isPending = createSchedule.isPending || updateSchedule.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Schedule' : 'Create Schedule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Select Bot (only for new schedules) */}
          {!isEditing && instances && (
            <div className="space-y-2">
              <Label>Trading Bot</Label>
              <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a bot to schedule" />
                </SelectTrigger>
                <SelectContent>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Days */}
          <div className="space-y-2">
            <Label>Active Days</Label>
            <ToggleGroup
              type="multiple"
              value={activeDays}
              onValueChange={setActiveDays}
              className="justify-start flex-wrap"
            >
              {dayOptions.map((day) => (
                <ToggleGroupItem
                  key={day.value}
                  value={day.value}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {day.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Time Window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Start Time
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                End Time
              </Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          {/* Evaluation Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Evaluation Interval</Label>
              <span className="text-sm font-mono text-primary">
                {intervalMs >= 60000 ? `${intervalMs / 60000}m` : `${intervalMs / 1000}s`}
              </span>
            </div>
            <Slider
              value={[intervalMs]}
              onValueChange={([val]) => setIntervalMs(val)}
              min={5000}
              max={300000}
              step={5000}
            />
            <p className="text-xs text-muted-foreground">
              How often the strategy evaluates market conditions
            </p>
          </div>

          {/* Cooldown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Cooldown After Trade</Label>
              <span className="text-sm font-mono text-primary">{cooldown}s</span>
            </div>
            <Slider
              value={[cooldown]}
              onValueChange={([val]) => setCooldown(val)}
              min={0}
              max={300}
              step={5}
            />
          </div>

          {/* Trade Limits */}
          <Card className="bg-background border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-primary" />
                Trade Limits
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Max Trades/Hour</Label>
                  <Input
                    type="number"
                    value={maxTradesPerHour}
                    onChange={(e) => setMaxTradesPerHour(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Max Trades/Day</Label>
                  <Input
                    type="number"
                    value={maxTradesPerDay}
                    onChange={(e) => setMaxTradesPerDay(Number(e.target.value))}
                    min={1}
                    max={500}
                    className="bg-card"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <Label>Enable schedule immediately</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || (!isEditing && !selectedInstance)}
            className="gap-1 bg-primary hover:bg-primary/90"
          >
            {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Schedule'}
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
