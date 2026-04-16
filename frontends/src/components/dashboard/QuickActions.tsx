import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  Calendar,
  Shield,
  MessageSquare,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  route: string;
  color: string;
  bgColor: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'deposit',
    label: 'Deposit',
    description: 'Add funds to wallet',
    icon: ArrowDownToLine,
    route: '/wallet',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 hover:bg-green-500/20',
  },
  {
    id: 'withdraw',
    label: 'Withdraw',
    description: 'Withdraw funds',
    icon: ArrowUpFromLine,
    route: '/wallet',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
  },
  {
    id: 'create-strategy',
    label: 'New Strategy',
    description: 'Create trading bot',
    icon: Bot,
    route: '/strategies',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'Set trading hours',
    icon: Calendar,
    route: '/scheduler',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
  },
  {
    id: 'risk',
    label: 'Risk Settings',
    description: 'Configure limits',
    icon: Shield,
    route: '/risk',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10 hover:bg-yellow-500/20',
  },
  {
    id: 'assistant',
    label: 'AI Assistant',
    description: 'Get help',
    icon: MessageSquare,
    route: '/assistant',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10 hover:bg-cyan-500/20',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <Card variant="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Quick Actions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Button
                variant="ghost"
                className={`w-full h-auto min-h-24 flex flex-col items-center gap-2 py-4 ${action.bgColor} transition-all duration-200`}
                onClick={() => navigate(action.route)}
              >
                <action.icon className={`w-5 h-5 ${action.color}`} />
                <div className="text-center">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground hidden sm:block">{action.description}</p>
                </div>
              </Button>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
