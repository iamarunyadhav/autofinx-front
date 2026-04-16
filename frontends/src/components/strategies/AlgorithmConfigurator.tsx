import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, SlidersHorizontal, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useUpdateParams } from '@/hooks/useStrategy';
import type { Database } from '@/integrations/supabase/types';

type StrategyInstance = Database['public']['Tables']['strategy_instances']['Row'];

type TemplateKey = 'ma_crossover' | 'bollinger' | 'rsi' | 'breakout';

interface TemplateField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  helper?: string;
}

const templates: Record<TemplateKey, { label: string; description: string; fields: TemplateField[] }> = {
  ma_crossover: {
    label: 'MA Crossover',
    description: 'Fast/slow moving average crossover with trend confirmation.',
    fields: [
      { key: 'fastPeriod', label: 'Fast MA', min: 5, max: 50, step: 1, default: 12 },
      { key: 'slowPeriod', label: 'Slow MA', min: 20, max: 200, step: 1, default: 26 },
      { key: 'signalPeriod', label: 'Signal', min: 3, max: 50, step: 1, default: 9, helper: 'Used for MACD-like smoothing' },
    ],
  },
  bollinger: {
    label: 'Bollinger Bands',
    description: 'Bands-based mean reversion and breakout detector.',
    fields: [
      { key: 'period', label: 'Period', min: 5, max: 60, step: 1, default: 20 },
      { key: 'stdDev', label: 'Std Dev', min: 1, max: 4, step: 0.1, default: 2 },
      { key: 'threshold', label: 'Entry Threshold', min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
    ],
  },
  rsi: {
    label: 'RSI Swing',
    description: 'RSI overbought/oversold swing trader.',
    fields: [
      { key: 'period', label: 'Period', min: 5, max: 30, step: 1, default: 14 },
      { key: 'overbought', label: 'Overbought', min: 50, max: 90, step: 1, default: 70 },
      { key: 'oversold', label: 'Oversold', min: 10, max: 50, step: 1, default: 30 },
    ],
  },
  breakout: {
    label: 'Breakout',
    description: 'High/low channel breakout with pullback filter.',
    fields: [
      { key: 'lookback', label: 'Lookback', min: 10, max: 200, step: 5, default: 55 },
      { key: 'pullback', label: 'Pullback %', min: 0.1, max: 5, step: 0.1, default: 1 },
      { key: 'stopMultiple', label: 'Stop ATR x', min: 1, max: 5, step: 0.1, default: 2 },
    ],
  },
};

interface AlgorithmConfiguratorProps {
  instances: StrategyInstance[];
  isLoading?: boolean;
}

export function AlgorithmConfigurator({ instances, isLoading }: AlgorithmConfiguratorProps) {
  const { currentWorkspace } = useWorkspace();
  const updateParams = useUpdateParams();
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateKey>('ma_crossover');
  const [values, setValues] = useState<Record<string, number>>({});

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId) || null,
    [instances, selectedInstanceId]
  );

  useEffect(() => {
    setSelectedInstanceId(instances[0]?.id ?? null);
  }, [instances]);

  useEffect(() => {
    const defaults = templates[template].fields.reduce(
      (acc, field) => ({ ...acc, [field.key]: field.default }),
      {}
    );
    setValues(defaults);
  }, [template]);

  const handleFieldChange = (key: string, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = async () => {
    if (!currentWorkspace || !selectedInstance) return;
    await updateParams.mutateAsync({
      instanceId: selectedInstance.id,
      workspaceId: currentWorkspace.id,
      params: values,
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Algorithm Configurator
          </CardTitle>
          <CardDescription>Select a bot and tune preset strategies.</CardDescription>
        </div>
        <Badge variant="outline" className="gap-1">
          <SlidersHorizontal className="h-4 w-4" />
          Tunable presets
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Bot / Instance</Label>
            <Select
              value={selectedInstanceId ?? undefined}
              onValueChange={(val) => setSelectedInstanceId(val)}
              disabled={isLoading || instances.length === 0}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={isLoading ? 'Loading...' : 'Choose bot'} />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name} {inst.mode === 'live' ? '• LIVE' : '• PAPER'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Template</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(templates) as TemplateKey[]).map((key) => (
                <Button
                  key={key}
                  variant={template === key ? 'default' : 'outline'}
                  className="justify-start"
                  onClick={() => setTemplate(key)}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  {templates[key].label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-4">
          <div className="text-sm text-muted-foreground">
            {templates[template].description}
          </div>
          {templates[template].fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{field.label}</Label>
                <span className="text-xs font-mono text-primary">{values[field.key] ?? field.default}</span>
              </div>
              <Slider
                value={[values[field.key] ?? field.default]}
                min={field.min}
                max={field.max}
                step={field.step}
                onValueChange={([val]) => handleFieldChange(field.key, val)}
              />
              {field.helper && <p className="text-xs text-muted-foreground">{field.helper}</p>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleApply}
            disabled={!selectedInstance || updateParams.isPending}
          >
            {updateParams.isPending ? 'Saving...' : 'Save to Bot'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
