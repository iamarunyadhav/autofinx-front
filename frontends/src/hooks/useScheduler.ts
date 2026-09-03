import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

// Was previously aliased from the auto-generated (stale) Supabase Database
// type, describing a `strategy_schedules` table that does not exist in the
// real Laravel schema at all — the real table is `schedules`
// (ScheduleController.php), flat (name/window_json/interval_ms/cooldown_s/
// max_trades_json/enabled), with no link to a strategy instance (no
// instance_id column). handleScheduler()'s mapScheduleToRichShape() (lib/api.ts)
// maps that flat shape to this richer one on every read/write so the
// existing UI (already written against this shape) works; there is no real
// `strategy_instances` link to provide, so that field is intentionally
// omitted here and every consumer already falls back gracefully (e.g.
// "Unknown Bot") when it's absent.
export interface Schedule {
  id: string;
  workspace_id: string;
  name: string;
  is_enabled: boolean;
  evaluation_interval_ms: number;
  cooldown_seconds: number;
  timezone?: string;
  active_days?: number[];
  start_time?: string;
  end_time?: string;
  max_trades_per_hour?: number;
  max_trades_per_day?: number;
  created_at: string;
  updated_at: string;
}

type ScheduleWithInstance = Schedule;

interface ScheduleData {
  timezone?: string;
  active_days?: number[];
  start_time?: string;
  end_time?: string;
  evaluation_interval_ms?: number;
  cooldown_seconds?: number;
  max_trades_per_hour?: number;
  max_trades_per_day?: number;
  is_enabled?: boolean;
}

interface SimulationResult {
  timestamps: string[];
}

export function useSchedules(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ schedules: ScheduleWithInstance[] }>('scheduler', {
        action: 'get_schedules',
        workspace_id: workspaceId,
      });
      return data.schedules;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ instanceId, scheduleData }: { instanceId: string; scheduleData: ScheduleData }) => {
      const data = await callEdgeFunction<{ schedule: Schedule }>('scheduler', {
        action: 'create_schedule',
        instance_id: instanceId,
        schedule_data: scheduleData,
      });
      return data.schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Created',
        description: 'Trading schedule has been configured',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, scheduleData }: { scheduleId: string; scheduleData: ScheduleData }) => {
      const data = await callEdgeFunction<{ schedule: Schedule }>('scheduler', {
        action: 'update_schedule',
        schedule_id: scheduleId,
        schedule_data: scheduleData,
      });
      return data.schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Updated',
        description: 'Changes saved successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useToggleSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ scheduleId, isEnabled }: { scheduleId: string; isEnabled: boolean }) => {
      const data = await callEdgeFunction<{ schedule: Schedule }>('scheduler', {
        action: 'toggle_schedule',
        schedule_id: scheduleId,
        is_enabled: isEnabled,
      });
      return data.schedule;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: variables.isEnabled ? 'Schedule Enabled' : 'Schedule Disabled',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Toggle Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      await callEdgeFunction<{ success: boolean }>('scheduler', {
        action: 'delete_schedule',
        schedule_id: scheduleId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({
        title: 'Schedule Deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSimulateSchedule() {
  return useMutation({
    mutationFn: async (scheduleData: ScheduleData) => {
      const payload = {
        window_json: {
          days: scheduleData.active_days ?? [1, 2, 3, 4, 5, 6, 0],
          start: scheduleData.start_time ?? '00:00',
          end: scheduleData.end_time ?? '23:59',
        },
        interval_ms: scheduleData.evaluation_interval_ms ?? 60000,
        cooldown_s: scheduleData.cooldown_seconds ?? 0,
        max_trades_json: {
          per_hour: scheduleData.max_trades_per_hour ?? 0,
          per_day: scheduleData.max_trades_per_day ?? 0,
        },
        timezone: scheduleData.timezone ?? 'Asia/Colombo',
      };
      const data = await callEdgeFunction<{ timestamps: string[] }>('scheduler', {
        action: 'simulate_schedule',
        schedule_data: payload,
      });
      return data;
    },
  });
}
