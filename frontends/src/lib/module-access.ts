export type ModuleMode = "active" | "deactive";

export interface ModuleDefinition {
  key: string;
  label: string;
  path: string;
  description: string;
  defaultMode: ModuleMode;
  manageable?: boolean;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: "dashboard", label: "Dashboard", path: "/", description: "Main trading overview and health snapshot.", defaultMode: "active", manageable: false },
  { key: "access", label: "Access", path: "/access", description: "Control which modules are visible and usable.", defaultMode: "active", manageable: false },
  { key: "quick-trade", label: "Quick Trade", path: "/trading", description: "Core quick trade workflow.", defaultMode: "active" },
  { key: "deals", label: "Deals", path: "/deals", description: "Quick trade active and historical deals.", defaultMode: "active" },
  { key: "robot-trading", label: "Robot Trade", path: "/robot-trading", description: "Core robot session trading workflow.", defaultMode: "active" },
  { key: "trading-desk", label: "Trading Desk", path: "/trading/desk", description: "Manual trading desk and execution panel.", defaultMode: "active" },
  { key: "ratio-bot", label: "Ratio Bot", path: "/ratio-bot", description: "Core ratio bot trading module.", defaultMode: "active" },
  { key: "forex-grid", label: "Forex Grid", path: "/forex-grid", description: "Grid trading module for forex/metals via OANDA.", defaultMode: "active" },
  { key: "pepperstone", label: "Metals & Energy", path: "/pepperstone", description: "Gold, Silver, Platinum, and Crude Oil CFD basket trading via Pepperstone.", defaultMode: "active" },
  { key: "fast2x", label: "Fast2X", path: "/fast2x", description: "Core Fast2X trading module.", defaultMode: "active" },
  { key: "future-trade", label: "Future Trade", path: "/future-trade", description: "Core Future Trade futures scanner bot.", defaultMode: "active" },
  { key: "audit", label: "Audit", path: "/audit", description: "Live workflow tracing for Future Trade, Robot Trade, queues, and server processes.", defaultMode: "active" },
  { key: "audit-research", label: "Audit Research", path: "/audit-research", description: "Ratio Bot decision audit sessions: event timeline, rule-level decision explainability, incidents, and prediction-accuracy reporting.", defaultMode: "active" },
  { key: "intelligence-control", label: "Intelligence Control", path: "/intelligence-control", description: "On/off switches for AI/automation capabilities: Unified Forecast Engine shadow/live modes and scheduled backtest/calibration jobs.", defaultMode: "active" },
  { key: "scheduler", label: "Scheduler", path: "/scheduler", description: "Scheduler controls required for automation timing.", defaultMode: "active" },
  { key: "risk", label: "Risk", path: "/risk", description: "Risk and kill switch controls.", defaultMode: "active" },
  { key: "wallet", label: "Wallet", path: "/wallet", description: "Wallet balances and transfer flows.", defaultMode: "active" },
  { key: "connections", label: "Connections", path: "/connections", description: "Exchange connection management for core modules.", defaultMode: "active" },
  { key: "live-execution", label: "Execution", path: "/live-execution", description: "Binance execution monitoring and reconciliation.", defaultMode: "active" },
  { key: "ops", label: "Ops", path: "/ops", description: "Operational health and incident tools for trading.", defaultMode: "active" },
  { key: "jobs", label: "Jobs", path: "/jobs", description: "Queue and worker monitoring.", defaultMode: "active" },
  { key: "settings", label: "Settings", path: "/settings", description: "Workspace settings and provider credentials.", defaultMode: "active", manageable: false },

  { key: "strategies", label: "Strategies", path: "/strategies", description: "Legacy strategy builder and instances.", defaultMode: "deactive" },
  { key: "auto-bot", label: "Metal Bot", path: "/auto-bot", description: "Metals-focused live bot workflow for gold and silver automation.", defaultMode: "active" },
  { key: "portfolio-intelligence", label: "Portfolio IQ", path: "/portfolio", description: "Portfolio intelligence and allocation tooling.", defaultMode: "deactive" },
  { key: "regime", label: "AI Regime", path: "/regime", description: "AI regime classification tools.", defaultMode: "deactive" },
  { key: "ai-trading", label: "AI Trading", path: "/ai-trading", description: "AI decisioning and approval flows.", defaultMode: "deactive" },
  { key: "futures", label: "Futures", path: "/futures", description: "Generic futures groundwork module.", defaultMode: "deactive" },
  { key: "integrations", label: "Integrations", path: "/integrations", description: "Additional integrations center.", defaultMode: "deactive" },
  { key: "profit", label: "Profit Center", path: "/profit", description: "Yield, arbitrage, and profit-center tools.", defaultMode: "deactive" },
  { key: "copy-trading", label: "Copy Trading", path: "/copy-trading", description: "Copy trading module.", defaultMode: "deactive" },
  { key: "signals", label: "Signals", path: "/signals", description: "Signal feed and history UI.", defaultMode: "deactive" },
  { key: "analytics", label: "Analytics", path: "/analytics", description: "Analytics dashboards and exports.", defaultMode: "deactive" },
  { key: "billing", label: "Billing", path: "/billing", description: "Subscription and billing controls.", defaultMode: "deactive" },
  { key: "assistant", label: "AI Assistant", path: "/assistant", description: "Assistant chat and actions.", defaultMode: "deactive" },
];

export const MODULE_DEFINITION_MAP = Object.fromEntries(
  MODULE_DEFINITIONS.map((definition) => [definition.key, definition])
) as Record<string, ModuleDefinition>;

export function getModuleDefinition(moduleKey: string): ModuleDefinition | undefined {
  return MODULE_DEFINITION_MAP[moduleKey];
}

export function getDefaultModuleMode(moduleKey: string): ModuleMode {
  return MODULE_DEFINITION_MAP[moduleKey]?.defaultMode ?? "deactive";
}

export function isModuleAccessible(mode: string | null | undefined, moduleKey: string): boolean {
  const effectiveMode = (mode ?? getDefaultModuleMode(moduleKey)).toLowerCase();
  return effectiveMode === "active";
}
