import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, TrendingUp, Zap, Grid3X3, ArrowLeftRight, Brain, DollarSign, Code } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useStrategies, useStrategyInstances } from '@/hooks/useStrategy';
import { StrategyCatalog } from '@/components/strategies/StrategyCatalog';
import { StrategyInstances } from '@/components/strategies/StrategyInstances';
import { CreateBotWizard } from '@/components/strategies/CreateBotWizard';
import { ParameterEditor } from '@/components/strategies/ParameterEditor';
import { BacktestPanel } from '@/components/strategies/BacktestPanel';
import { AlgorithmConfigurator } from '@/components/strategies/AlgorithmConfigurator';
import { ArbitragePanel } from '@/components/strategies/ArbitragePanel';
import type { Database } from '@/integrations/supabase/types';

type Strategy = Database['public']['Tables']['strategies']['Row'];
type StrategyInstance = Database['public']['Tables']['strategy_instances']['Row'];

const strategyTypeIcons: Record<string, React.ElementType> = {
  trend: TrendingUp,
  mean_reversion: Zap,
  grid: Grid3X3,
  arbitrage: ArrowLeftRight,
  ml_signal: Brain,
  dca: DollarSign,
  custom: Code,
};

export default function StrategiesPage() {
  const { currentWorkspace } = useWorkspace();
  const { data: strategies = [], isLoading: loadingStrategies } = useStrategies();
  const { data: instances = [], isLoading: loadingInstances } = useStrategyInstances(currentWorkspace?.id);
  
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [editingInstance, setEditingInstance] = useState<StrategyInstance | null>(null);
  const [backtestInstance, setBacktestInstance] = useState<StrategyInstance | null>(null);

  const filteredStrategies = strategies.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredInstances = instances.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
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
            <h1 className="text-2xl font-semibold text-foreground">Strategies</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your trading bots and strategy configurations
            </p>
          </div>
          <Button 
            onClick={() => setShowWizard(true)}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Bot
          </Button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search strategies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="instances" className="space-y-4">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="instances" className="data-[state=active]:bg-primary/20">
              My Bots ({instances.length})
            </TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-primary/20">
              Strategy Catalog
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instances" className="mt-4">
            <StrategyInstances
              instances={filteredInstances}
              isLoading={loadingInstances}
              onEdit={setEditingInstance}
              onBacktest={setBacktestInstance}
              strategyTypeIcons={strategyTypeIcons}
            />
            <div className="mt-6">
              <AlgorithmConfigurator instances={filteredInstances} isLoading={loadingInstances} />
            </div>
          </TabsContent>

          <TabsContent value="catalog" className="mt-4">
            <StrategyCatalog
              strategies={filteredStrategies}
              isLoading={loadingStrategies}
              onSelect={(strategy) => {
                setSelectedStrategy(strategy);
                setShowWizard(true);
              }}
              strategyTypeIcons={strategyTypeIcons}
            />
            <div className="mt-6">
              <ArbitragePanel />
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Bot Wizard */}
        <AnimatePresence>
          {showWizard && (
            <CreateBotWizard
              strategies={strategies}
              preSelectedStrategy={selectedStrategy}
              onClose={() => {
                setShowWizard(false);
                setSelectedStrategy(null);
              }}
              strategyTypeIcons={strategyTypeIcons}
            />
          )}
        </AnimatePresence>

        {/* Parameter Editor */}
        <AnimatePresence>
          {editingInstance && (
            <ParameterEditor
              instance={editingInstance}
              onClose={() => setEditingInstance(null)}
            />
          )}
        </AnimatePresence>

        {/* Backtest Panel */}
        <AnimatePresence>
          {backtestInstance && (
            <BacktestPanel
              instance={backtestInstance}
              onClose={() => setBacktestInstance(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
