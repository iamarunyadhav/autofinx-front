import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useUpdateParams, type StrategyInstanceWithRelations } from '@/hooks/useStrategy';

type StrategyInstance = StrategyInstanceWithRelations;

interface ParameterEditorProps {
  instance: StrategyInstance;
  onClose: () => void;
}

// The backend returns `params` as an eager-loaded array of
// {key, value} StrategyParam rows (see StrategyController::instances()'s
// ->with(['strategy','params','connection'])), not a flat object — this
// UI edits a flat key/value map, so convert on the way in/out.
function paramsToRecord(instance: StrategyInstance): Record<string, number | string | boolean> {
  const record: Record<string, number | string | boolean> = {};
  for (const p of instance.params ?? []) {
    record[p.key] = p.value;
  }
  return record;
}

export function ParameterEditor({ instance, onClose }: ParameterEditorProps) {
  const { currentWorkspace } = useWorkspace();
  const updateParams = useUpdateParams();
  const [params, setParams] = useState<Record<string, number | string | boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setParams(paramsToRecord(instance));
    setHasChanges(false);
  }, [instance]);

  const handleParamChange = (key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentWorkspace) return;
    await updateParams.mutateAsync({
      instanceId: instance.id,
      workspaceId: currentWorkspace.id,
      params: params as Record<string, unknown>,
    });
    setHasChanges(false);
    onClose();
  };

  const handleReset = () => {
    setParams(paramsToRecord(instance));
    setHasChanges(false);
  };

  const renderParamInput = (key: string, value: number | string | boolean) => {
    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center justify-between py-2">
          <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
          <Switch
            checked={value}
            onCheckedChange={(checked) => handleParamChange(key, checked)}
          />
        </div>
      );
    }

    if (typeof value === 'number') {
      const isPercentage = key.includes('percent') || key.includes('Percent');
      const isSmall = key.includes('confidence') || key.includes('threshold') || isPercentage;
      const max = isSmall ? 1 : key.includes('Period') ? 200 : 1000;
      const step = isSmall ? 0.01 : 1;

      return (
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
            <span className="text-sm font-mono text-primary">
              {isPercentage ? `${(value * 100).toFixed(0)}%` : value}
            </span>
          </div>
          <Slider
            value={[value]}
            onValueChange={([val]) => handleParamChange(key, val)}
            max={max}
            step={step}
            className="w-full"
          />
        </div>
      );
    }

    return (
      <div className="space-y-2 py-2">
        <Label className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</Label>
        <Input
          value={value}
          onChange={(e) => handleParamChange(key, e.target.value)}
          className="bg-background"
        />
      </div>
    );
  };

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>Edit Parameters</span>
            <Badge className={instance.mode === 'live' 
              ? 'bg-[hsl(var(--live))]/20 text-[hsl(var(--live))]' 
              : 'bg-[hsl(var(--paper))]/20 text-[hsl(var(--paper))]'
            }>
              {instance.mode?.toUpperCase()}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-1"
        >
          <div className="text-sm text-muted-foreground mb-4">
            Editing: <span className="text-foreground font-medium">{instance.name}</span>
          </div>

          <div className="divide-y divide-border">
            {Object.entries(params).length > 0 ? (
              Object.entries(params).map(([key, value]) => (
                <div key={key}>
                  {renderParamInput(key, value)}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No configurable parameters for this strategy.
              </div>
            )}
          </div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex-1 gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateParams.isPending}
            className="flex-1 gap-1 bg-primary hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {updateParams.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
