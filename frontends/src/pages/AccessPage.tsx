import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function AccessPage() {
  const { currentWorkspace, loading } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [searchParams] = useSearchParams();
  const focusedModule = searchParams.get("module");
  const { definitions, updateModule, isLoading } = useModuleAccess(workspaceId);

  const manageableModules = useMemo(
    () => definitions.filter((definition) => definition.manageable !== false),
    [definitions]
  );

  const essentials = useMemo(
    () => definitions.filter((definition) => definition.manageable === false),
    [definitions]
  );

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">Access</h1>
            <Badge variant="outline">{currentWorkspace?.name || "Workspace"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Core modules are active by default. Extra modules stay hidden until you switch them on here.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Core Essentials</CardTitle>
            <CardDescription>These stay visible so the workspace always has a safe control surface.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {essentials.map((module) => (
              <div key={module.key} className="rounded-lg border border-border bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{module.label}</div>
                    <div className="text-xs text-muted-foreground">{module.description}</div>
                  </div>
                  <Badge variant="secondary">Always on</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module Toggles</CardTitle>
            <CardDescription>Turn modules on to show them in the sidebar. Turn them off to hide unfinished areas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {loading || isLoading ? (
              <div className="text-sm text-muted-foreground">Loading access settings...</div>
            ) : manageableModules.map((module) => {
              const checked = module.enabled;
              const busy = updateModule.isPending && updateModule.variables?.moduleKey === module.key;
              const highlighted = focusedModule === module.key;

              return (
                <div
                  key={module.key}
                  className={[
                    "flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors",
                    highlighted ? "border-primary bg-primary/5" : "border-border bg-background/40",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{module.label}</div>
                      <Badge variant={checked ? "default" : "outline"}>{checked ? "Active" : "Deactive"}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{module.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{module.path}</div>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={!workspaceId || busy}
                    onCheckedChange={(enabled) =>
                      updateModule.mutate(
                        {
                          moduleKey: module.key,
                          mode: enabled ? "active" : "deactive",
                        },
                        {
                          onSuccess: () => {
                            toast.success(`${module.label} ${enabled ? "activated" : "deactivated"}`);
                          },
                          onError: (error) => {
                            toast.error(error instanceof Error ? error.message : "Failed to update module access");
                          },
                        }
                      )
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
