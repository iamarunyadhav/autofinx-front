import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { mlErrorMessage } from "@/lib/mlTraining";

interface ConfirmActionProps {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Runs the request; throw to keep the dialog open and show the error. */
  onConfirm: () => Promise<unknown>;
  pending?: boolean;
  destructive?: boolean;
}

/**
 * Confirm-before-act dialog. The confirm button is disabled while the request
 * is in flight (no double submit) and a failed request stays visible in the
 * dialog, in plain words, instead of disappearing.
 */
export function ConfirmAction({ trigger, title, description, confirmLabel, onConfirm, pending = false, destructive = false }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = busy || pending;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(mlErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!inFlight) { setOpen(next); setError(null); } }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        {error && <div role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={inFlight}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => void submit()} disabled={inFlight}>
            {inFlight && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
