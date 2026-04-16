import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Database } from '@/integrations/supabase/types';

type Strategy = Database['public']['Tables']['strategies']['Row'];

interface StrategyCatalogProps {
  strategies: Strategy[];
  isLoading: boolean;
  onSelect: (strategy: Strategy) => void;
  strategyTypeIcons: Record<string, React.ElementType>;
}

const strategyTypeLabels: Record<string, string> = {
  trend: 'Trend Following',
  mean_reversion: 'Mean Reversion',
  grid: 'Grid Trading',
  arbitrage: 'Arbitrage',
  ml_signal: 'ML Signal',
  dca: 'DCA',
  custom: 'Custom',
};

export function StrategyCatalog({ strategies, isLoading, onSelect, strategyTypeIcons }: StrategyCatalogProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <Card className="bg-card border-border border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No strategies available yet.
            <br />
            <span className="text-sm">Strategy templates are being set up.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {strategies.map((strategy, index) => {
        const Icon = strategyTypeIcons[strategy.strategy_type] || strategyTypeIcons.custom;
        
        return (
          <motion.div
            key={strategy.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="bg-card border-border hover:border-primary/50 transition-colors group cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {strategyTypeLabels[strategy.strategy_type] || strategy.strategy_type}
                      </Badge>
                    </div>
                  </div>
                  {strategy.is_public && (
                    <Badge className="bg-primary/20 text-primary border-0">
                      Public
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-3 line-clamp-2">
                  {strategy.description || 'No description available'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    v{strategy.version || '1.0'}
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="gap-1 text-primary hover:text-primary"
                    onClick={() => onSelect(strategy)}
                  >
                    Use Template
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
