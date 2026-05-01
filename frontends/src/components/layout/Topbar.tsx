import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Menu,
  Search,
  Bell,
  Command,
  Power,
  User,
  ChevronDown,
  LogOut,
  Settings,
  Key,
  CreditCard,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/hooks/useNotifications";
import { useGlobalKillSwitch, useSystemSettings } from "@/hooks/useRisk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TopbarProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}

export function Topbar({ showMenuButton = false, onMenuClick }: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [killSwitchDialog, setKillSwitchDialog] = useState(false);
  const navigate = useNavigate();
  
  const { user, signOut } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  
  const { data: systemSettings } = useSystemSettings(workspaceId);
  const { data: notifications } = useNotifications(workspaceId, true);
  const { data: unreadCount } = useUnreadCount(workspaceId);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const killSwitch = useGlobalKillSwitch();

  const isSystemActive = systemSettings?.global_trading_enabled ?? true;

  const handleKillSwitch = () => {
    if (isSystemActive) {
      setKillSwitchDialog(true);
    } else {
      if (workspaceId) {
        killSwitch.mutate({ workspaceId, enabled: true });
      }
    }
  };

  const confirmKillSwitch = () => {
    if (workspaceId) {
      killSwitch.mutate({ workspaceId, enabled: false });
    }
    setKillSwitchDialog(false);
  };

  const handleMarkAllRead = () => {
    if (workspaceId) {
      markAllRead.mutate(workspaceId);
    }
  };

  const handleNotificationClick = (notificationId: string) => {
    markRead.mutate([notificationId]);
  };

  return (
    <>
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-3 sm:px-4 md:px-6 gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 md:hidden"
              onClick={onMenuClick}
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <motion.div
            animate={{ width: searchFocused ? "100%" : 280 }}
            className="relative hidden sm:block"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search strategies, assets, orders..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-10 pl-10 pr-16 bg-secondary border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
              <Command className="w-3 h-3" />K
            </kbd>
          </motion.div>
          <Button variant="ghost" size="icon" className="sm:hidden shrink-0" aria-label="Search">
            <Search className="w-5 h-5" />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Kill Switch */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={isSystemActive ? "destructive" : "success"}
              size="sm"
              onClick={handleKillSwitch}
              className="gap-1 sm:gap-2 px-2 sm:px-3"
              disabled={killSwitch.isPending}
            >
              <Power className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isSystemActive ? "KILL SWITCH" : "ACTIVATE"}
              </span>
            </Button>
          </motion.div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {(unreadCount || 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-3 border-b border-border flex items-center justify-between">
                <h4 className="font-semibold text-sm">Notifications</h4>
                {(unreadCount || 0) > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-7 text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications && notifications.length > 0 ? (
                  notifications.slice(0, 10).map((notif) => (
                    <NotificationItem
                      key={notif.id}
                      title={(notif.content as any)?.title || 'Notification'}
                      message={(notif.content as any)?.body || notif.body || ''}
                      time={new Date(notif.created_at!).toLocaleTimeString()}
                      type={((notif.content as any)?.type || notif.severity || 'info') as 'success' | 'warning' | 'info' | 'error'}
                      onClick={() => handleNotificationClick(notif.id)}
                    />
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No new notifications
                  </div>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 pl-2 pr-2 sm:pr-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <span className="text-sm font-medium">
                    {user?.email?.split('@')[0] || 'User'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-3 border-b border-border">
                <p className="font-medium text-sm">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <Settings className="w-4 h-4 mr-2" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/profile?tab=security')}>
                <Key className="w-4 h-4 mr-2" />
                API Keys
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/connections')}>
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Kill Switch Confirmation Dialog */}
      <AlertDialog open={killSwitchDialog} onOpenChange={setKillSwitchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Power className="w-5 h-5" />
              Activate Kill Switch?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately stop ALL trading activity across all strategies.
              All active positions will remain open, but no new trades will be executed.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmKillSwitch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Stop All Trading
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NotificationItem({
  title,
  message,
  time,
  type,
  onClick,
}: {
  title: string;
  message: string;
  time: string;
  type: "success" | "warning" | "info" | "error";
  onClick?: () => void;
}) {
  const typeColors = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-primary",
    error: "bg-destructive",
  };

  return (
    <div 
      className="p-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-0"
      onClick={onClick}
    >
      <div className="flex gap-3">
        <div
          className={`w-2 h-2 rounded-full mt-1.5 ${typeColors[type]}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{message}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{time}</p>
        </div>
      </div>
    </div>
  );
}
