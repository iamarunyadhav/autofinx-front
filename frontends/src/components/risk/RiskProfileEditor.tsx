import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Save, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const riskProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  is_default: z.boolean(),
  max_position_percent: z.number().min(1).max(100),
  max_daily_loss_percent: z.number().min(0.5).max(20),
  max_drawdown_percent: z.number().min(1).max(50),
  max_leverage: z.number().min(1).max(10),
  stop_loss_percent: z.number().min(0.5).max(20),
  take_profit_percent: z.number().min(0.5).max(50),
  slippage_tolerance: z.number().min(0.001).max(0.1),
});

type RiskProfileFormData = z.infer<typeof riskProfileSchema>;

interface RiskProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: any;
  onSave: (data: RiskProfileFormData) => Promise<void>;
  isSaving: boolean;
}

export function RiskProfileEditor({ 
  open, 
  onOpenChange, 
  profile, 
  onSave, 
  isSaving 
}: RiskProfileEditorProps) {
  const form = useForm<RiskProfileFormData>({
    resolver: zodResolver(riskProfileSchema),
    defaultValues: {
      name: "",
      is_default: false,
      max_position_percent: 10,
      max_daily_loss_percent: 5,
      max_drawdown_percent: 15,
      max_leverage: 1,
      stop_loss_percent: 2,
      take_profit_percent: 5,
      slippage_tolerance: 0.005,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        is_default: profile.is_default,
        max_position_percent: profile.max_position_percent,
        max_daily_loss_percent: profile.max_daily_loss_percent,
        max_drawdown_percent: profile.max_drawdown_percent,
        max_leverage: profile.max_leverage,
        stop_loss_percent: profile.stop_loss_percent,
        take_profit_percent: profile.take_profit_percent,
        slippage_tolerance: profile.slippage_tolerance,
      });
    } else {
      form.reset({
        name: "",
        is_default: false,
        max_position_percent: 10,
        max_daily_loss_percent: 5,
        max_drawdown_percent: 15,
        max_leverage: 1,
        stop_loss_percent: 2,
        take_profit_percent: 5,
        slippage_tolerance: 0.005,
      });
    }
  }, [profile, form]);

  const handleSubmit = async (data: RiskProfileFormData) => {
    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {profile ? "Edit Risk Profile" : "Create Risk Profile"}
          </DialogTitle>
          <DialogDescription>
            Configure position limits, loss thresholds, and trading constraints
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Conservative, Aggressive, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Default Profile</FormLabel>
                      <FormDescription>
                        Use this profile for new strategy instances
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Position Limits */}
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Position Limits</h4>
              
              <FormField
                control={form.control}
                name="max_position_percent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Max Position Size</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum percentage of portfolio per position
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_leverage"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Max Leverage</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}x</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={1}
                        max={10}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum leverage allowed for positions
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Loss Limits */}
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Loss Limits</h4>
              
              <FormField
                control={form.control}
                name="max_daily_loss_percent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Max Daily Loss</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Trading stops when daily loss exceeds this limit
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_drawdown_percent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Max Drawdown</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={1}
                        max={50}
                        step={1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum portfolio drawdown from peak
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stop_loss_percent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Default Stop Loss</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0.5}
                        max={20}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Default stop loss percentage per trade
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Profit & Execution */}
            <div className="space-y-4">
              <h4 className="font-medium text-foreground">Profit & Execution</h4>
              
              <FormField
                control={form.control}
                name="take_profit_percent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Default Take Profit</FormLabel>
                      <span className="text-sm text-muted-foreground">{field.value}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0.5}
                        max={50}
                        step={0.5}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Default take profit percentage per trade
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slippage_tolerance"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Slippage Tolerance</FormLabel>
                      <span className="text-sm text-muted-foreground">
                        {(field.value * 100).toFixed(2)}%
                      </span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0.001}
                        max={0.1}
                        step={0.001}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    </FormControl>
                    <FormDescription>
                      Maximum acceptable slippage for order execution
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {profile ? "Update Profile" : "Create Profile"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
