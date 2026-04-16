import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "border-border text-foreground",
        success:
          "border-success/30 bg-success/20 text-success",
        warning:
          "border-warning/30 bg-warning/20 text-warning",
        live:
          "border-live/30 bg-live/20 text-live",
        paper:
          "border-paper/30 bg-paper/20 text-paper",
        running:
          "border-running/30 bg-running/20 text-running",
        paused:
          "border-paused/30 bg-paused/20 text-paused",
        error:
          "border-error/30 bg-error/20 text-error",
        profit:
          "border-profit/30 bg-profit/20 text-profit",
        loss:
          "border-loss/30 bg-loss/20 text-loss",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean;
}

function Badge({ className, variant, pulse, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant }),
        pulse && "animate-pulse-live",
        className
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
