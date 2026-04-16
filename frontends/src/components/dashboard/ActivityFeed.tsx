import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  type: "trade" | "signal" | "alert" | "system";
  action: "buy" | "sell" | "alert" | "info";
  title: string;
  description: string;
  time: string;
  amount?: string;
  price?: string;
}

const activities: Activity[] = [
  {
    id: "1",
    type: "trade",
    action: "buy",
    title: "BUY BTC/USDT",
    description: "MA Crossover Strategy",
    time: "2m ago",
    amount: "0.15 BTC",
    price: "$42,150.00",
  },
  {
    id: "2",
    type: "signal",
    action: "info",
    title: "SIGNAL: RSI Oversold",
    description: "ETH/USDT on 15m timeframe",
    time: "5m ago",
  },
  {
    id: "3",
    type: "trade",
    action: "sell",
    title: "SELL ETH/USDT",
    description: "Grid Trading Bot",
    time: "8m ago",
    amount: "2.5 ETH",
    price: "$2,285.50",
  },
  {
    id: "4",
    type: "alert",
    action: "alert",
    title: "Risk Threshold Reached",
    description: "Daily loss limit at 80%",
    time: "12m ago",
  },
  {
    id: "5",
    type: "trade",
    action: "buy",
    title: "BUY SOL/USDT",
    description: "Mean Reversion Strategy",
    time: "15m ago",
    amount: "45 SOL",
    price: "$98.75",
  },
];

export function ActivityFeed() {
  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Activity Feed</CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px]">
            LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
        {activities.map((activity, index) => (
          <ActivityItem key={activity.id} activity={activity} index={index} />
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityItem({ activity, index }: { activity: Activity; index: number }) {
  const actionIcons = {
    buy: ArrowUpRight,
    sell: ArrowDownRight,
    alert: Clock,
    info: ArrowRight,
  };

  const actionColors = {
    buy: "text-profit bg-profit/10",
    sell: "text-loss bg-loss/10",
    alert: "text-warning bg-warning/10",
    info: "text-primary bg-primary/10",
  };

  const Icon = actionIcons[activity.action];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          actionColors[activity.action]
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{activity.title}</p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {activity.time}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {activity.description}
        </p>
        {activity.amount && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono text-foreground">
              {activity.amount}
            </span>
            <span className="text-xs text-muted-foreground">@</span>
            <span className="text-xs font-mono text-muted-foreground">
              {activity.price}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
