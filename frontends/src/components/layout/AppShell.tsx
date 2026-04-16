import { ReactNode, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const activePath = location.pathname;
  const pageKey = useMemo(() => {
    const segment = activePath.split("/").filter(Boolean)[0];
    return segment || "dashboard";
  }, [activePath]);
  const sidebarWidth = isMobile ? 0 : sidebarCollapsed ? 72 : 240;

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activePath={activePath}
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
        onNavigate={handleNavigate}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      <div
        className="transition-[padding] duration-200"
        style={{ paddingLeft: sidebarWidth }}
      >
        <Topbar
          showMenuButton={isMobile}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        <motion.main
          key={pageKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pb-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
