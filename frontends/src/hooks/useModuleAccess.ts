import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";
import {
  MODULE_DEFINITIONS,
  getDefaultModuleMode,
  getModuleDefinition,
  isModuleAccessible,
  type ModuleMode,
} from "@/lib/module-access";

export interface ModuleSettingRecord {
  id: string;
  workspace_id: string;
  module_key: string;
  mode: string;
  settings_json?: Record<string, unknown> | null;
}

export function useModuleAccess(workspaceId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["module-access", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [] as ModuleSettingRecord[];
      return authorizedFetch(`/modules?workspace_id=${encodeURIComponent(workspaceId)}`) as Promise<ModuleSettingRecord[]>;
    },
    enabled: !!workspaceId,
  });

  const settingsMap = useMemo(() => {
    const entries = (query.data ?? []).map((setting) => [setting.module_key, setting]);
    return Object.fromEntries(entries) as Record<string, ModuleSettingRecord>;
  }, [query.data]);

  const modeFor = (moduleKey: string): ModuleMode => {
    const stored = settingsMap[moduleKey]?.mode;
    return isModuleAccessible(stored, moduleKey) ? "active" : "deactive";
  };

  const isEnabled = (moduleKey: string): boolean => modeFor(moduleKey) === "active";

  const definitions = useMemo(
    () =>
      MODULE_DEFINITIONS.map((definition) => ({
        ...definition,
        mode: modeFor(definition.key),
        enabled: isEnabled(definition.key),
      })),
    [settingsMap]
  );

  const updateModule = useMutation({
    mutationFn: async ({
      moduleKey,
      mode,
      settingsJson,
    }: {
      moduleKey: string;
      mode: ModuleMode;
      settingsJson?: Record<string, unknown>;
    }) => {
      if (!workspaceId) {
        throw new Error("Workspace required");
      }

      return authorizedFetch(`/modules/${encodeURIComponent(moduleKey)}`, "PATCH", {
        workspace_id: workspaceId,
        mode,
        settings_json: settingsJson ?? settingsMap[moduleKey]?.settings_json ?? {},
      }) as Promise<ModuleSettingRecord>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["module-access", workspaceId] });
      const definition = getModuleDefinition(variables.moduleKey);
      if (definition?.path) {
        queryClient.invalidateQueries({ queryKey: ["module-route", definition.path] });
      }
    },
  });

  return {
    ...query,
    definitions,
    settingsMap,
    modeFor,
    isEnabled,
    getDefaultMode: getDefaultModuleMode,
    updateModule,
  };
}
