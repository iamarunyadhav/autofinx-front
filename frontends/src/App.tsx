import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleRoute } from "@/components/auth/ModuleRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import StrategiesPage from "./pages/StrategiesPage";
import AssistantPage from "./pages/AssistantPage";
import SchedulerPage from "./pages/SchedulerPage";
import RiskPage from "./pages/RiskPage";
import WalletPage from "./pages/WalletPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import BillingPage from "./pages/BillingPage";
import TradingPage from "./pages/TradingPage";
import QuickTradePage from "./pages/QuickTradePage";
import DealsPage from "./pages/DealsPage";
import LiveBotsPage from "./pages/LiveBotsPage";
import RobotTradingPage from "./pages/RobotTradingPage";
import RegimePage from "./pages/RegimePage";
import CopyTradingPage from "./pages/CopyTradingPage";
import SignalsPage from "./pages/SignalsPage";
import SettingsCenterPage from "./pages/SettingsCenterPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import ProfitCenterPage from "./pages/ProfitCenterPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import NotFound from "./pages/NotFound";
import { Navigate } from "react-router-dom";
import OpsPage from "./pages/OpsPage";
import PayoutPage from "./pages/PayoutPage";
import AiTradingPage from "./pages/AiTradingPage";
import LiveExecutionPage from "./pages/LiveExecutionPage";
import FuturesGroundworkPage from "./pages/FuturesGroundworkPage";
import PortfolioIntelligencePage from "./pages/PortfolioIntelligencePage";
import RatioBotPage from "./pages/RatioBotPage";
import ForexGridBotPage from "./pages/ForexGridBotPage";
import PepperstoneBotPage from "./pages/PepperstoneBotPage";
import Fast2XPage from "./pages/Fast2XPage";
import FutureTradeBotPage from "./pages/FutureTradeBotPage";
import AuditPage from "./pages/AuditPage";
import AuditResearchPage from "./pages/AuditResearchPage";
import JobsPage from "./pages/JobsPage";
import SettingsPage from "./pages/SettingsPage";
import AccessPage from "./pages/AccessPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
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
            <Route path="/payouts/:id" element={
              <ProtectedRoute>
                <PayoutPage />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
