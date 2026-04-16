import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Bot,
  Brain,
  Calendar,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Link,
  MessageSquare,
  PlayCircle,
  Radio,
  ServerCog,
  Settings,
  Share2,
  Shield,
  Wallet,
  Waves,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface SidebarProps {
  activePath: string;
  collapsed: boolean;
  onNavigate: (path: string) => void;
  onCollapseChange: (collapsed: boolean) => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "strategies", label: "Strategies", icon: Bot, path: "/strategies" },
  { id: "trading", label: "Quick Trade", icon: CandlestickChart, path: "/trading" },
  { id: "deals", label: "Deals", icon: BriefcaseBusiness, path: "/deals" },
  { id: "robot-trading", label: "Robot Trade", icon: Bot, path: "/robot-trading" },
  { id: "trading-desk", label: "Trading Desk", icon: BarChart3, path: "/trading/desk" },
  { id: "auto-bot", label: "Auto Bot", icon: PlayCircle, path: "/auto-bot" },
  { id: "ratio-bot", label: "Ratio Bot", icon: Zap, path: "/ratio-bot" },
  { id: "scheduler", label: "Scheduler", icon: Calendar, path: "/scheduler" },
  { id: "risk", label: "Risk", icon: Shield, path: "/risk" },
  { id: "wallet", label: "Wallet", icon: Wallet, path: "/wallet" },
  { id: "portfolio-intelligence", label: "Portfolio IQ", icon: BarChart3, path: "/portfolio" },
  { id: "regime", label: "AI Regime", icon: Activity, path: "/regime" },
  { id: "ai-trading", label: "AI Trading", icon: Brain, path: "/ai-trading" },
  { id: "live-execution", label: "Execution", icon: Activity, path: "/live-execution" },
  { id: "futures", label: "Futures", icon: FlaskConical, path: "/futures" },
  { id: "integrations", label: "Integrations", icon: Link, path: "/integrations" },
  { id: "profit", label: "Profit Center", icon: Zap, path: "/profit" },
  { id: "copy-trading", label: "Copy Trading", icon: Share2, path: "/copy-trading" },
  { id: "signals", label: "Signals", icon: Radio, path: "/signals" },
  { id: "connections", label: "Connections", icon: Link, path: "/connections" },
  { id: "analytics", label: "Analytics", icon: Waves, path: "/analytics" },
  { id: "ops", label: "Ops", icon: ServerCog, path: "/ops" },
  { id: "billing", label: "Billing", icon: CreditCard, path: "/billing" },
  { id: "assistant", label: "AI Assistant", icon: MessageSquare, path: "/assistant" },
];

const bottomItems = [
  { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
];

interface SidebarContentProps {
  activePath: string;
  collapsed: boolean;
  isMobileView?: boolean;
  onNavigate: (path: string) => void;
  onCollapseChange: (collapsed: boolean) => void;
}

function SidebarContent({
  activePath,
  collapsed,
  isMobileView = false,
  onNavigate,
  onCollapseChange,
}: SidebarContentProps) {
  return (
    <div className="h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {(!collapsed || isMobileView) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <span className="font-bold text-lg text-foreground tracking-tight">
                  AutoFinX
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePath === item.path ||
            (item.path !== "/" && activePath.startsWith(`${item.path}/`));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg transition-all duration-200 group",
                isMobileView ? "px-3 py-3 min-h-11" : "px-3 py-2.5",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "w-5 h-5 shrink-0 transition-colors",
                  isActive && "text-sidebar-primary"
                )}
              />
              <AnimatePresence>
                {(!collapsed || isMobileView) && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && (!collapsed || isMobileView) && (
                <motion.div
                  layoutId={isMobileView ? undefined : "activeIndicator"}
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-running/10",
            collapsed && !isMobileView && "justify-center"
          )}
        >
          <div className="relative">
            <Activity className="w-5 h-5 text-running" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-running rounded-full animate-pulse" />
          </div>
          <AnimatePresence>
            {(!collapsed || isMobileView) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col"
              >
                <span className="text-xs font-medium text-running">LIVE</span>
                <span className="text-[10px] text-muted-foreground">
                  3 Active Strategies
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activePath === item.path ||
            (item.path !== "/" && activePath.startsWith(`${item.path}/`));

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg transition-all duration-200",
                isMobileView ? "px-3 py-3 min-h-11" : "px-3 py-2.5",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <AnimatePresence>
                {(!collapsed || isMobileView) && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        {!isMobileView && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapseChange(!collapsed)}
            className="w-full justify-center mt-2"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  activePath,
  collapsed,
  onNavigate,
  onCollapseChange,
  isMobile = false,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarProps) {
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="fixed left-0 top-0 hidden h-screen z-50 md:block"
      >
        <SidebarContent
          activePath={activePath}
          collapsed={collapsed}
          onNavigate={onNavigate}
          onCollapseChange={onCollapseChange}
        />
      </motion.aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[88vw] max-w-[320px] bg-sidebar p-0 border-r border-sidebar-border"
        >
          <SidebarContent
            activePath={activePath}
            collapsed={false}
            isMobileView={isMobile}
            onNavigate={onNavigate}
            onCollapseChange={onCollapseChange}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
