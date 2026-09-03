import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Check, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useCreateInstance } from '@/hooks/useStrategy';
import { useConnections } from '@/hooks/useConnections';
import { ConnectionSelector } from './ConnectionSelector';
import type { Strategy } from '@/hooks/useStrategy';

interface CreateBotWizardProps {
  strategies: Strategy[];
  preSelectedStrategy: Strategy | null;
  onClose: () => void;
  strategyTypeIcons: Record<string, React.ElementType>;
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name too long'),
  strategyId: z.string().min(1, 'Select a strategy'),
  mode: z.enum(['paper', 'live']),
  connectionId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const defaultParams: Record<string, Record<string, number>> = {
  trend: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  mean_reversion: { period: 20, stdDev: 2, threshold: 0.5 },
  bollinger: { period: 20, stdDev: 2, threshold: 0.5 },
  rsi: { period: 14, overbought: 70, oversold: 30 },
  breakout: { lookback: 55, pullback: 1, stopMultiple: 2 },
  grid: { gridLevels: 10, gridSpacing: 1, baseSize: 100 },
  arbitrage: { minSpread: 0.5, maxExposure: 1000 },
  ml_signal: { lookback: 50, confidence: 0.7 },
  dca: { interval: 24, amount: 100, maxPositions: 10 },
  custom: { param1: 0, param2: 0 },
};

export function CreateBotWizard({ strategies, preSelectedStrategy, onClose, strategyTypeIcons }: CreateBotWizardProps) {
  const { currentWorkspace } = useWorkspace();
  const createInstance = useCreateInstance();
  const { data: connections } = useConnections(currentWorkspace?.id);
  const [step, setStep] = useState(preSelectedStrategy ? 2 : 1);
  const [params, setParams] = useState<Record<string, number>>({});

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      strategyId: preSelectedStrategy?.id || '',
      mode: 'paper',
      connectionId: undefined,
    },
  });

  const selectedStrategy = strategies.find(s => s.id === form.watch('strategyId')) || preSelectedStrategy;

  const handleNext = () => {
    if (step === 1 && !form.watch('strategyId')) return;
    if (step === 2) {
      const type = selectedStrategy?.category || 'custom';
      setParams(defaultParams[type] || {});
    }
    setStep(s => Math.min(s + 1, 4));
  };

  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async (data: FormData) => {
    if (!currentWorkspace) return;
    
    await createInstance.mutateAsync({
      workspaceId: currentWorkspace.id,
      strategyId: data.strategyId,
      name: data.name,
      mode: data.mode,
      params,
      connectionId: data.connectionId,
    });
    
    onClose();
  };

  const steps = ['Strategy', 'Details', 'Parameters', 'Review'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Create Trading Bot
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4 py-2">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                i + 1 < step 
                  ? 'bg-primary text-primary-foreground' 
                  : i + 1 === step 
                    ? 'bg-primary/20 text-primary border-2 border-primary' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1 < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`ml-2 text-sm hidden sm:inline ${
                i + 1 === step ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          {/* Step 1: Select Strategy */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 py-4"
            >
              <Label>Select a Strategy Template</Label>
              <RadioGroup
                value={form.watch('strategyId')}
                onValueChange={(val) => form.setValue('strategyId', val)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {strategies.map((strategy) => {
                  const Icon = strategyTypeIcons[strategy.category || 'custom'] || strategyTypeIcons.custom;
                  return (
                    <Label
                      key={strategy.id}
                      htmlFor={strategy.id}
                      className="cursor-pointer"
                    >
                      <Card className={`border-2 transition-colors ${
                        form.watch('strategyId') === strategy.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={strategy.id} id={strategy.id} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <span className="font-medium">{strategy.name}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {strategy.description || 'No description'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Label>
                  );
                })}
              </RadioGroup>
            </motion.div>
          )}

          {/* Step 2: Bot Details */}
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Bot Name</Label>
                <Input
                  id="name"
                  placeholder="My Trading Bot"
                  {...form.register('name')}
                  className="bg-background"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Trading Mode</Label>
                <RadioGroup
                  value={form.watch('mode')}
                  onValueChange={(val) => form.setValue('mode', val as 'paper' | 'live')}
                  className="grid grid-cols-2 gap-4"
                >
                  <Label htmlFor="paper" className="cursor-pointer">
                    <Card className={`border-2 transition-colors ${
                      form.watch('mode') === 'paper' 
                        ? 'border-[hsl(var(--paper))] bg-[hsl(var(--paper))]/5' 
                        : 'border-border hover:border-[hsl(var(--paper))]/50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="paper" id="paper" />
                          <div>
                            <span className="font-medium">Paper Trading</span>
                            <p className="text-xs text-muted-foreground">Simulate trades safely</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                  <Label htmlFor="live" className="cursor-pointer">
                    <Card className={`border-2 transition-colors ${
                      form.watch('mode') === 'live' 
                        ? 'border-[hsl(var(--live))] bg-[hsl(var(--live))]/5' 
                        : 'border-border hover:border-[hsl(var(--live))]/50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="live" id="live" />
                          <div>
                            <span className="font-medium">Live Trading</span>
                            <p className="text-xs text-muted-foreground">Real money trades</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Exchange Connection</Label>
                {connections && connections.length > 0 ? (
                  <ConnectionSelector
                    connections={connections}
                    value={form.watch('connectionId')}
                    onChange={(id) => form.setValue('connectionId', id)}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No connections available. Add one in Connections.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Parameters */}
          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 py-4"
            >
              <Label>Strategy Parameters</Label>
              <div className="space-y-6">
                {Object.entries(params).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
                      <span className="text-sm font-mono text-primary">{value}</span>
                    </div>
                    <Slider
                      value={[value]}
                      onValueChange={([val]) => setParams(p => ({ ...p, [key]: val }))}
                      max={key.includes('Period') ? 100 : key.includes('Levels') ? 50 : 1000}
                      step={key.includes('confidence') || key.includes('threshold') ? 0.1 : 1}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 py-4"
            >
              <Card className="bg-background border-border">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bot Name</span>
                    <span className="font-medium">{form.watch('name')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Strategy</span>
                    <span className="font-medium">{selectedStrategy?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Mode</span>
                    <Badge className={form.watch('mode') === 'live' 
                      ? 'bg-[hsl(var(--live))]/20 text-[hsl(var(--live))]' 
                      : 'bg-[hsl(var(--paper))]/20 text-[hsl(var(--paper))]'
                    }>
                      {form.watch('mode').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="border-t border-border pt-4">
                    <span className="text-sm text-muted-foreground">Parameters</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(params).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="font-mono">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={step === 1 ? onClose : handleBack}
              className="gap-1"
            >
              {step === 1 ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </>
              )}
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={handleNext} className="gap-1">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                className="gap-1 bg-primary hover:bg-primary/90"
                disabled={createInstance.isPending}
              >
                {createInstance.isPending ? 'Creating...' : 'Create Bot'}
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
