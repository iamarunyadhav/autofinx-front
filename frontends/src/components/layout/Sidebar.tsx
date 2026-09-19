import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  Bot,
  Brain,
  Calendar,
  Cpu,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Gem,
  Grid3x3,
  LayoutDashboard,
  ListChecks,
  Link,
  MessageSquare,
  PlayCircle,
  Radio,
  SearchCheck,
  ServerCog,
  Settings,
  Share2,
  Shield,
  Wallet,
  Waves,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useWorkspace } from "@/hooks/useWorkspace";
import { MODULE_DEFINITIONS } from "@/lib/module-access";

interface SidebarProps {
  activePath: string;
  collapsed: boolean;
  onNavigate: (path: string) => void;
  onCollapseChange: (collapsed: boolean) => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const iconMap = {
  dashboard: LayoutDashboard,
  strategies: Bot,
  "quick-trade": CandlestickChart,
  deals: BriefcaseBusiness,
  "robot-trading": Bot,
  "trading-desk": BarChart3,
  "auto-bot": PlayCircle,
  "ratio-bot": Zap,
  "forex-grid": Grid3x3,
  pepperstone: Gem,
  fast2x: Zap,
  "future-trade": FlaskConical,
  audit: Workflow,
  "audit-research": SearchCheck,
  "nexus": SearchCheck,
  "intelligence-control": Cpu,
  scheduler: Calendar,
  risk: Shield,
  wallet: Wallet,
  "portfolio-intelligence": BarChart3,
  regime: Activity,
  "ai-trading": Brain,
  "live-execution": Activity,
  futures: FlaskConical,
  integrations: Link,
  profit: Zap,
  "copy-trading": Share2,
  signals: Radio,
  connections: Link,
  analytics: Waves,
  ops: ServerCog,
  jobs: ListChecks,
  billing: CreditCard,
  assistant: MessageSquare,
  access: Settings,
  settings: Settings,
} as const;

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
  const { currentWorkspace } = useWorkspace();
  const { definitions } = useModuleAccess(currentWorkspace?.id);
  const visibleModules = definitions.length > 0
    ? definitions.filter((definition) => definition.enabled)
    : MODULE_DEFINITIONS.filter((definition) => definition.defaultMode === "active");
  const navItems = visibleModules.filter((definition) => !["settings"].includes(definition.key));
  const bottomItems = visibleModules.filter((definition) => ["settings"].includes(definition.key));

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
          const Icon = iconMap[item.key as keyof typeof iconMap] ?? Settings;
          const isActive =
            activePath === item.path ||
            (item.path !== "/" && activePath.startsWith(`${item.path}/`));

          return (
            <button
              key={item.key}
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
          const Icon = iconMap[item.key as keyof typeof iconMap] ?? Settings;
          const isActive =
            activePath === item.path ||
            (item.path !== "/" && activePath.startsWith(`${item.path}/`));

          return (
            <button
              key={item.key}
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
