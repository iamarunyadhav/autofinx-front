import { motion } from 'framer-motion';
import { BarChart3, Brain, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { Database } from '@/integrations/supabase/types';

type StrategyInstance = Database['public']['Tables']['strategy_instances']['Row'];

interface StrategyAnalysisPanelProps {
  instances: StrategyInstance[];
  selectedStrategy: string | null;
  analysis: string | null;
  isAnalyzing: boolean;
  onAnalyze: (instanceId: string) => void;
}

export function StrategyAnalysisPanel({
  instances,
  selectedStrategy,
  analysis,
  isAnalyzing,
  onAnalyze,
}: StrategyAnalysisPanelProps) {
  const selectedInstance = instances.find(i => i.id === selectedStrategy);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-80 shrink-0 hidden lg:block"
    >
      <Card className="bg-card border-border h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Strategy Analysis
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Strategy Selector */}
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Select a strategy to analyze</span>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {instances.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No strategies yet</p>
                ) : (
                  instances.map((instance) => (
                    <Button
                      key={instance.id}
                      variant={selectedStrategy === instance.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={() => onAnalyze(instance.id)}
                      disabled={isAnalyzing}
                    >
                      <Zap className="h-3 w-3" />
                      <span className="truncate">{instance.name}</span>
                      <Badge 
                        variant="outline" 
                        className={`ml-auto text-[10px] ${
                          instance.mode === 'live' 
                            ? 'text-[hsl(var(--live))]' 
                            : 'text-[hsl(var(--paper))]'
                        }`}
                      >
                        {instance.mode}
                      </Badge>
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Analysis Results */}
          <div className="flex-1 min-h-0">
            {isAnalyzing ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-primary">
                  <BarChart3 className="h-4 w-4 animate-pulse" />
                  Analyzing {selectedInstance?.name}...
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : analysis ? (
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Analysis Results</span>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {analysis}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Select a strategy above to get AI-powered analysis and recommendations
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
