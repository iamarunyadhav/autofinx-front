import { Power, AlertTriangle, ShieldOff, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface KillSwitchControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  isLoading: boolean;
}

export function KillSwitchControl({ enabled, onToggle, isLoading }: KillSwitchControlProps) {
  return (
    <Card className={`border-2 transition-colors ${
      enabled 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-destructive/30 bg-destructive/5'
    }`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
              enabled ? 'bg-green-500/20' : 'bg-destructive/20'
            }`}>
              {enabled ? (
                <Power className="h-7 w-7 text-green-500" />
              ) : (
                <ShieldOff className="h-7 w-7 text-destructive" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-foreground">
                  Global Kill Switch
                </h3>
                <Badge variant={enabled ? "default" : "destructive"} className="gap-1">
                  {enabled ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                      Trading Active
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Trading Halted
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {enabled 
                  ? "All strategy instances are allowed to execute trades" 
                  : "All trading activity has been suspended across all strategies"}
              </p>
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant={enabled ? "destructive" : "default"} 
                size="lg"
                className="gap-2 min-w-[160px]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : enabled ? (
                  <>
                    <ShieldOff className="h-5 w-5" />
                    Stop All Trading
                  </>
                ) : (
                  <>
                    <Power className="h-5 w-5" />
                    Resume Trading
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {enabled ? (
                    <>
                      <ShieldOff className="h-5 w-5 text-destructive" />
                      Halt All Trading?
                    </>
                  ) : (
                    <>
                      <Power className="h-5 w-5 text-green-500" />
                      Resume Trading?
                    </>
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {enabled ? (
                    <>
                      This will immediately stop all active strategy instances from 
                      executing any new trades. Existing open positions will remain 
                      unchanged. Use this in emergency situations or market volatility.
                    </>
                  ) : (
                    <>
                      This will re-enable trading across all strategy instances. 
                      Make sure you have reviewed market conditions before resuming 
                      automated trading.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onToggle(!enabled)}
                  className={enabled ? "bg-destructive hover:bg-destructive/90" : ""}
                >
                  {enabled ? "Yes, Stop Trading" : "Yes, Resume Trading"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
