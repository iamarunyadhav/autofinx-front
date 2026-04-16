import { Shield, Edit, Percent, TrendingDown, Scale, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface RiskProfileCardProps {
  profile: {
    id: string;
    name: string;
    is_default: boolean;
    max_position_percent: number;
    max_daily_loss_percent: number;
    max_drawdown_percent: number;
    max_leverage: number;
    stop_loss_percent: number;
    take_profit_percent: number;
    slippage_tolerance: number;
  };
  onEdit: () => void;
}

export function RiskProfileCard({ profile, onEdit }: RiskProfileCardProps) {
  const riskLevel = profile.max_leverage > 3 || profile.max_position_percent > 20 
    ? 'high' 
    : profile.max_leverage > 1.5 || profile.max_position_percent > 10 
      ? 'medium' 
      : 'low';

  const riskColors = {
    low: 'bg-green-500/10 text-green-500 border-green-500/20',
    medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    high: 'bg-destructive/10 text-destructive border-destructive/20'
  };

  return (
    <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                {profile.name}
                {profile.is_default && (
                  <Badge variant="secondary" className="text-xs">Default</Badge>
                )}
              </h3>
              <Badge variant="outline" className={`text-xs mt-1 ${riskColors[riskLevel]}`}>
                {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Max Position */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Percent className="h-3.5 w-3.5" />
              Max Position
            </div>
            <div className="flex items-center gap-2">
              <Progress value={profile.max_position_percent} className="h-2 flex-1" />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {profile.max_position_percent}%
              </span>
            </div>
          </div>

          {/* Max Daily Loss */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" />
              Daily Loss Limit
            </div>
            <div className="flex items-center gap-2">
              <Progress 
                value={profile.max_daily_loss_percent * 10} 
                className="h-2 flex-1" 
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {profile.max_daily_loss_percent}%
              </span>
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Max Drawdown
            </div>
            <div className="flex items-center gap-2">
              <Progress 
                value={profile.max_drawdown_percent * 5} 
                className="h-2 flex-1" 
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {profile.max_drawdown_percent}%
              </span>
            </div>
          </div>

          {/* Max Leverage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Scale className="h-3.5 w-3.5" />
              Max Leverage
            </div>
            <div className="flex items-center gap-2">
              <Progress 
                value={(profile.max_leverage / 10) * 100} 
                className="h-2 flex-1" 
              />
              <span className="text-sm font-medium text-foreground w-12 text-right">
                {profile.max_leverage}x
              </span>
            </div>
          </div>
        </div>

        {/* Additional Settings */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
          <div className="text-sm">
            <span className="text-muted-foreground">Stop Loss: </span>
            <span className="text-foreground font-medium">{profile.stop_loss_percent}%</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Take Profit: </span>
            <span className="text-foreground font-medium">{profile.take_profit_percent}%</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Slippage: </span>
            <span className="text-foreground font-medium">{(profile.slippage_tolerance * 100).toFixed(2)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
