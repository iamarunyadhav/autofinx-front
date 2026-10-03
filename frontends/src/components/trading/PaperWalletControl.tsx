import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authorizedFetch } from "@/lib/api";

/*
 * Quick Trade PAPER wallet control: creates the practice wallet (it is
 * otherwise only created by the first paper trade) or resets it to its
 * starting balance. Practice money only — never touches an exchange wallet.
 */
export function PaperWalletControl({ workspaceId, hasPaperWallet }: { workspaceId?: string; hasPaperWallet: boolean }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const reset = useMutation({
    mutationFn: () => authorizedFetch(`/workspaces/${workspaceId}/quick-trade/paper-wallet/reset`, "POST") as Promise<{ wallet: { currency: string; balance: number } }>,
    onSuccess: (data) => {
      setMessage(`Paper wallet set to ${data.wallet.currency} ${Number(data.wallet.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })}.`);
      void queryClient.invalidateQueries({ queryKey: ["balances", workspaceId] });
    },
    onError: (error: unknown) => setMessage(error instanceof Error ? error.message : "Paper wallet reset failed."),
  });

  const onClick = () => {
    if (hasPaperWallet && !window.confirm("Reset the paper wallet to its starting balance? Paper trade history is kept; only the practice balance changes.")) return;
    setMessage(null);
    reset.mutate();
  };

  return <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
    <button
      type="button"
      disabled={!workspaceId || reset.isPending}
      onClick={onClick}
      className="rounded-lg border border-cyan-800 bg-cyan-950/40 px-2.5 py-1 font-medium text-cyan-200 hover:bg-cyan-900/50 disabled:opacity-50"
    >
      {reset.isPending ? "Working…" : hasPaperWallet ? "Reset paper wallet" : "Create paper wallet"}
    </button>
    {message && <span className={reset.isError ? "text-rose-300" : "text-emerald-300"}>{message}</span>}
  </div>;
}
