import { createContext, useContext } from "react";

export interface MlContextValue {
  workspaceId: string;
  /** False only for a workspace member who is known not to be owner/admin. */
  canMutate: boolean;
  /** `training.stall_seconds` from GET /system (default until it loads). */
  stallSeconds: number;
}

export const MlContext = createContext<MlContextValue | null>(null);

export function useMlCtx(): MlContextValue {
  const value = useContext(MlContext);
  if (!value) throw new Error("useMlCtx must be used inside MlShell");
  return value;
}
