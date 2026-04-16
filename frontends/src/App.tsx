import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
              <ProtectedRoute>
                <StrategiesPage />
              </ProtectedRoute>
            } />
            <Route path="/assistant" element={
              <ProtectedRoute>
                <AssistantPage />
              </ProtectedRoute>
            } />
            <Route path="/trading" element={
              <ProtectedRoute>
                <QuickTradePage />
              </ProtectedRoute>
            } />
            <Route path="/trading/desk" element={
              <ProtectedRoute>
                <TradingPage />
              </ProtectedRoute>
            } />
            <Route path="/deals" element={
              <ProtectedRoute>
                <DealsPage />
              </ProtectedRoute>
            } />
            <Route path="/robot-trading" element={
              <ProtectedRoute>
                <RobotTradingPage />
              </ProtectedRoute>
            } />
            <Route path="/auto-bot" element={
              <ProtectedRoute>
                <LiveBotsPage />
              </ProtectedRoute>
            } />
            <Route path="/live-bots" element={
              <ProtectedRoute>
                <Navigate to="/auto-bot" replace />
              </ProtectedRoute>
            } />
            <Route path="/scheduler" element={
              <ProtectedRoute>
                <SchedulerPage />
              </ProtectedRoute>
            } />
            <Route path="/risk" element={
              <ProtectedRoute>
                <RiskPage />
              </ProtectedRoute>
            } />
            <Route path="/wallet" element={
              <ProtectedRoute>
                <WalletPage />
              </ProtectedRoute>
            } />
            <Route path="/account" element={<Navigate to="/wallet" replace />} />
            <Route path="/portfolio" element={
              <ProtectedRoute>
                <PortfolioIntelligencePage />
              </ProtectedRoute>
            } />
            <Route path="/portfolio-intelligence" element={
              <ProtectedRoute>
                <PortfolioIntelligencePage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsCenterPage />
              </ProtectedRoute>
            } />
            <Route path="/regime" element={
              <ProtectedRoute>
                <RegimePage />
              </ProtectedRoute>
            } />
            <Route path="/copy-trading" element={
              <ProtectedRoute>
                <CopyTradingPage />
              </ProtectedRoute>
            } />
            <Route path="/signals" element={
              <ProtectedRoute>
                <SignalsPage />
              </ProtectedRoute>
            } />
            <Route path="/connections" element={
              <ProtectedRoute>
                <ConnectionsPage />
              </ProtectedRoute>
            } />
            <Route path="/integrations" element={
              <ProtectedRoute>
                <IntegrationsPage />
              </ProtectedRoute>
            } />
            <Route path="/profit" element={
              <ProtectedRoute>
                <ProfitCenterPage />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="/billing" element={
              <ProtectedRoute>
                <BillingPage />
              </ProtectedRoute>
            } />
            <Route path="/ops" element={
              <ProtectedRoute>
                <OpsPage />
              </ProtectedRoute>
            } />
            <Route path="/ai-trading" element={
              <ProtectedRoute>
                <AiTradingPage />
              </ProtectedRoute>
            } />
            <Route path="/live-execution" element={
              <ProtectedRoute>
                <LiveExecutionPage />
              </ProtectedRoute>
            } />
            <Route path="/futures" element={
              <ProtectedRoute>
                <FuturesGroundworkPage />
              </ProtectedRoute>
            } />
            <Route path="/ratio-bot" element={
              <ProtectedRoute>
                <RatioBotPage />
              </ProtectedRoute>
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
