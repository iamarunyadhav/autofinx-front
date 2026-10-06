import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleRoute } from "@/components/auth/ModuleRoute";
import { Loader2 } from "lucide-react";

// Every page is code-split per route so opening any single route only
// downloads that page's JS, instead of the whole app's ~2.5MB bundle up
// front. <Suspense> below renders a lightweight fallback while a route's
// chunk loads — it does not depend on any API call, so it can never hang.
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const StrategiesPage = lazy(() => import("./pages/StrategiesPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const RiskPage = lazy(() => import("./pages/RiskPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const ConnectionsPage = lazy(() => import("./pages/ConnectionsPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const TradingPage = lazy(() => import("./pages/TradingPage"));
const QuickTradePage = lazy(() => import("./pages/QuickTradePage"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const LiveBotsPage = lazy(() => import("./pages/LiveBotsPage"));
const RobotTradingPage = lazy(() => import("./pages/RobotTradingPage"));
const RegimePage = lazy(() => import("./pages/RegimePage"));
const CopyTradingPage = lazy(() => import("./pages/CopyTradingPage"));
const SignalsPage = lazy(() => import("./pages/SignalsPage"));
const SettingsCenterPage = lazy(() => import("./pages/SettingsCenterPage"));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage"));
const ProfitCenterPage = lazy(() => import("./pages/ProfitCenterPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OpsPage = lazy(() => import("./pages/OpsPage"));
const PayoutPage = lazy(() => import("./pages/PayoutPage"));
const AiTradingPage = lazy(() => import("./pages/AiTradingPage"));
const LiveExecutionPage = lazy(() => import("./pages/LiveExecutionPage"));
const FuturesGroundworkPage = lazy(() => import("./pages/FuturesGroundworkPage"));
const PortfolioIntelligencePage = lazy(() => import("./pages/PortfolioIntelligencePage"));
const RatioBotPage = lazy(() => import("./pages/RatioBotPage"));
const ForexGridBotPage = lazy(() => import("./pages/ForexGridBotPage"));
const PepperstoneBotPage = lazy(() => import("./pages/PepperstoneBotPage"));
const Fast2XPage = lazy(() => import("./pages/Fast2XPage"));
const FutureTradeBotPage = lazy(() => import("./pages/FutureTradeBotPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const AuditResearchPage = lazy(() => import("./pages/AuditResearchPage"));
const NexusPage = lazy(() => import("./pages/NexusPage"));
const IntelligenceControlPage = lazy(() => import("./pages/IntelligenceControlPage"));
const MlOverviewPage = lazy(() => import("./pages/ml-training/MlOverviewPage"));
const MlCandlesPage = lazy(() => import("./pages/ml-training/MlCandlesPage"));
const MlRunsPage = lazy(() => import("./pages/ml-training/MlRunsPage"));
const MlModelsPage = lazy(() => import("./pages/ml-training/MlModelsPage"));
const MlSystemPage = lazy(() => import("./pages/ml-training/MlSystemPage"));
const JobsPage = lazy(() => import("./pages/JobsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AccessPage = lazy(() => import("./pages/AccessPage"));

const queryClient = new QueryClient();

// Lightweight, dependency-free fallback — renders instantly, never itself
// waits on any API call or data.
const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/nexus" element={<ModuleRoute moduleKey="nexus"><NexusPage /></ModuleRoute>} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              } />
              <Route path="/strategies" element={
                <ModuleRoute moduleKey="strategies">
                  <StrategiesPage />
                </ModuleRoute>
              } />
              <Route path="/assistant" element={
                <ModuleRoute moduleKey="assistant">
                  <AssistantPage />
                </ModuleRoute>
              } />
              <Route path="/trading" element={
                <ModuleRoute moduleKey="quick-trade">
                  <QuickTradePage />
                </ModuleRoute>
              } />
              <Route path="/trading/desk" element={
                <ModuleRoute moduleKey="trading-desk">
                  <TradingPage />
                </ModuleRoute>
              } />
              <Route path="/deals" element={
                <ModuleRoute moduleKey="deals">
                  <DealsPage />
                </ModuleRoute>
              } />
              <Route path="/robot-trading" element={
                <ModuleRoute moduleKey="robot-trading">
                  <RobotTradingPage />
                </ModuleRoute>
              } />
              <Route path="/auto-bot" element={
                <ModuleRoute moduleKey="auto-bot">
                  <LiveBotsPage />
                </ModuleRoute>
              } />
              <Route path="/live-bots" element={
                <ProtectedRoute>
                  <Navigate to="/auto-bot" replace />
                </ProtectedRoute>
              } />
              <Route path="/scheduler" element={
                <ModuleRoute moduleKey="scheduler">
                  <SchedulerPage />
                </ModuleRoute>
              } />
              <Route path="/risk" element={
                <ModuleRoute moduleKey="risk">
                  <RiskPage />
                </ModuleRoute>
              } />
              <Route path="/wallet" element={
                <ModuleRoute moduleKey="wallet">
                  <WalletPage />
                </ModuleRoute>
              } />
              <Route path="/account" element={<Navigate to="/wallet" replace />} />
              <Route path="/portfolio" element={
                <ModuleRoute moduleKey="portfolio-intelligence">
                  <PortfolioIntelligencePage />
                </ModuleRoute>
              } />
              <Route path="/portfolio-intelligence" element={
                <ModuleRoute moduleKey="portfolio-intelligence">
                  <PortfolioIntelligencePage />
                </ModuleRoute>
              } />
              <Route path="/access" element={
                <ProtectedRoute>
                  <AccessPage />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsCenterPage />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/regime" element={
                <ModuleRoute moduleKey="regime">
                  <RegimePage />
                </ModuleRoute>
              } />
              <Route path="/copy-trading" element={
                <ModuleRoute moduleKey="copy-trading">
                  <CopyTradingPage />
                </ModuleRoute>
              } />
              <Route path="/signals" element={
                <ModuleRoute moduleKey="signals">
                  <SignalsPage />
                </ModuleRoute>
              } />
              <Route path="/connections" element={
                <ModuleRoute moduleKey="connections">
                  <ConnectionsPage />
                </ModuleRoute>
              } />
              <Route path="/integrations" element={
                <ModuleRoute moduleKey="integrations">
                  <IntegrationsPage />
                </ModuleRoute>
              } />
              <Route path="/profit" element={
                <ModuleRoute moduleKey="profit">
                  <ProfitCenterPage />
                </ModuleRoute>
              } />
              <Route path="/analytics" element={
                <ModuleRoute moduleKey="analytics">
                  <AnalyticsPage />
                </ModuleRoute>
              } />
              <Route path="/billing" element={
                <ModuleRoute moduleKey="billing">
                  <BillingPage />
                </ModuleRoute>
              } />
              <Route path="/ops" element={
                <ModuleRoute moduleKey="ops">
                  <OpsPage />
                </ModuleRoute>
              } />
              <Route path="/jobs" element={
                <ModuleRoute moduleKey="jobs">
                  <JobsPage />
                </ModuleRoute>
              } />
              <Route path="/ai-trading" element={
                <ModuleRoute moduleKey="ai-trading">
                  <AiTradingPage />
                </ModuleRoute>
              } />
              <Route path="/live-execution" element={
                <ModuleRoute moduleKey="live-execution">
                  <LiveExecutionPage />
                </ModuleRoute>
              } />
              <Route path="/futures" element={
                <ModuleRoute moduleKey="futures">
                  <FuturesGroundworkPage />
                </ModuleRoute>
              } />
              <Route path="/ratio-bot" element={
                <ModuleRoute moduleKey="ratio-bot">
                  <RatioBotPage />
                </ModuleRoute>
              } />
              <Route path="/forex-grid" element={
                <ModuleRoute moduleKey="forex-grid">
                  <ForexGridBotPage />
                </ModuleRoute>
              } />
              <Route path="/pepperstone" element={
                <ModuleRoute moduleKey="pepperstone">
                  <PepperstoneBotPage />
                </ModuleRoute>
              } />
              <Route path="/fast2x" element={
                <ModuleRoute moduleKey="fast2x">
                  <Fast2XPage />
                </ModuleRoute>
              } />
              <Route path="/future-trade" element={
                <ModuleRoute moduleKey="future-trade">
                  <FutureTradeBotPage />
                </ModuleRoute>
              } />
              <Route path="/audit" element={
                <ModuleRoute moduleKey="audit">
                  <AuditPage />
                </ModuleRoute>
              } />
              <Route path="/audit-research" element={
                <ModuleRoute moduleKey="audit-research">
                  <AuditResearchPage />
                </ModuleRoute>
              } />
              <Route path="/intelligence-control" element={
                <ModuleRoute moduleKey="intelligence-control">
                  <IntelligenceControlPage />
                </ModuleRoute>
              } />
              <Route path="/ml-training" element={
                <ModuleRoute moduleKey="ml-training">
                  <MlOverviewPage />
                </ModuleRoute>
              } />
              <Route path="/ml-training/candles" element={
                <ModuleRoute moduleKey="ml-training">
                  <MlCandlesPage />
                </ModuleRoute>
              } />
              <Route path="/ml-training/runs" element={
                <ModuleRoute moduleKey="ml-training">
                  <MlRunsPage />
                </ModuleRoute>
              } />
              <Route path="/ml-training/models" element={
                <ModuleRoute moduleKey="ml-training">
                  <MlModelsPage />
                </ModuleRoute>
              } />
              <Route path="/ml-training/system" element={
                <ModuleRoute moduleKey="ml-training">
                  <MlSystemPage />
                </ModuleRoute>
              } />
              <Route path="/payouts/:id" element={
                <ProtectedRoute>
                  <PayoutPage />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
