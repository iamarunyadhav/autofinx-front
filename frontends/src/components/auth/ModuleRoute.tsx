import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getModuleDefinition } from "@/lib/module-access";

interface ModuleRouteProps {
  moduleKey: string;
  children: ReactNode;
}

export function ModuleRoute({ moduleKey, children }: ModuleRouteProps) {
  const location = useLocation();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { isLoading, isEnabled } = useModuleAccess(currentWorkspace?.id);
  const definition = getModuleDefinition(moduleKey);

  if (workspaceLoading || isLoading) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="p-6 text-sm text-muted-foreground">Loading module access...</div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  if (!isEnabled(moduleKey)) {
    return (
      <ProtectedRoute>
        <AppShell>
          <div className="p-6">
            <Card className="border-border bg-card/95">
              <CardHeader>
                <CardTitle>{definition?.label ?? "Module"} is deactivated</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>This module is hidden for now. Turn it on from Access when you want it visible again.</p>
                <div className="flex gap-3">
                  <Button asChild>
                    <a href={`/access?module=${encodeURIComponent(moduleKey)}&from=${encodeURIComponent(location.pathname)}`}>Open Access</a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="/">Go Dashboard</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </AppShell>
      </ProtectedRoute>
    );
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
