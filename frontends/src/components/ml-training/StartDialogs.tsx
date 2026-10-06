import { useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMlCtx } from "@/components/ml-training/mlContext";
import { useMlStartBatch, useMlStartRun } from "@/hooks/useMlTraining";
import { mlCoin, mlErrorMessage, mlHorizonLabel } from "@/lib/mlTraining";
import type { MlBatchPreset } from "@/types/mlTraining";

/** Contract section 3: long = 240 + 1440, mid = 120 + 60, short = 15. */
const PRESETS: Record<MlBatchPreset, { label: string; horizons: number[] }> = {
  long: { label: "Long (4h and 1d)", horizons: [240, 1440] },
  mid: { label: "Mid (2h and 1h)", horizons: [120, 60] },
  short: { label: "Short (15m)", horizons: [15] },
};

interface DialogProps {
  symbols: string[];
  horizons: number[];
  defaultSymbol?: string;
}

export function StartRunDialog({ symbols, horizons, defaultSymbol }: DialogProps) {
  const { workspaceId, canMutate } = useMlCtx();
  const start = useMlStartRun(workspaceId);
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState<string>(defaultSymbol ?? "");
  const [horizon, setHorizon] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  if (!canMutate) return null;

  const chosenSymbol = symbol || symbols[0] || "";
  const chosenHorizon = horizon || String(horizons[0] ?? "");
  const ready = Boolean(chosenSymbol && chosenHorizon);

  const submit = async () => {
    setError(null);
    try {
      await start.mutateAsync({ symbol: chosenSymbol, horizon_minutes: Number(chosenHorizon) });
      toast.success(`${mlCoin(chosenSymbol)} ${mlHorizonLabel(Number(chosenHorizon))} run queued`);
      setOpen(false);
    } catch (e) {
      setError(mlErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!start.isPending) { setOpen(next); setError(null); } }}>
      <DialogTrigger asChild><Button size="sm"><Play className="mr-2 h-3.5 w-3.5" />Start one run</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start one training run</DialogTitle>
          <DialogDescription>Queues a shadow training run for one coin and one horizon. One model trains at a time, so it may wait behind others.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ml-start-symbol">Coin</Label>
            <Select value={chosenSymbol} onValueChange={setSymbol}>
              <SelectTrigger id="ml-start-symbol"><SelectValue placeholder="Choose a coin" /></SelectTrigger>
              <SelectContent>{symbols.map((s) => <SelectItem key={s} value={s}>{mlCoin(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ml-start-horizon">Horizon</Label>
            <Select value={chosenHorizon} onValueChange={setHorizon}>
              <SelectTrigger id="ml-start-horizon"><SelectValue placeholder="Choose a horizon" /></SelectTrigger>
              <SelectContent>{horizons.map((h) => <SelectItem key={h} value={String(h)}>{mlHorizonLabel(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {ready && <p className="text-sm text-slate-300">You are about to queue <strong>{mlCoin(chosenSymbol)} {mlHorizonLabel(Number(chosenHorizon))}</strong>.</p>}
        {error && <div role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={start.isPending}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!ready || start.isPending}>
            {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm and queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchDialog({ symbols }: Pick<DialogProps, "symbols">) {
  const { workspaceId, canMutate } = useMlCtx();
  const start = useMlStartBatch(workspaceId);
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<MlBatchPreset>("mid");
  const [picked, setPicked] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!canMutate) return null;

  const chosen = picked ?? symbols;
  const count = chosen.length * PRESETS[preset].horizons.length;

  const toggle = (s: string, on: boolean) => setPicked(on ? Array.from(new Set([...chosen, s])) : chosen.filter((x) => x !== s));

  const submit = async () => {
    setError(null);
    try {
      // Omit `symbols` when everything is selected so the server uses its own full list.
      const result = await start.mutateAsync(chosen.length === symbols.length ? { preset } : { preset, symbols: chosen });
      const skipped = result.skipped?.length ?? 0;
      toast.success(`Batch queued: ${result.runs?.length ?? 0} run(s)${skipped ? `, ${skipped} skipped (already active)` : ""}`);
      setOpen(false);
    } catch (e) {
      setError(mlErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!start.isPending) { setOpen(next); setError(null); } }}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Layers className="mr-2 h-3.5 w-3.5" />Launch batch</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Launch a batch of runs</DialogTitle>
          <DialogDescription>Queues one run per coin and horizon in the preset. Pairs that are already queued or running are skipped.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Preset</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(PRESETS) as MlBatchPreset[]).map((p) => (
                <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${preset === p ? "border-sky-500/60 bg-sky-500/10 text-sky-200" : "border-slate-700 text-slate-300 hover:bg-slate-800/50"}`}>
                  {PRESETS[p].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Coins</legend>
            <div className="flex flex-wrap gap-3">
              {symbols.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={chosen.includes(s)} onCheckedChange={(v) => toggle(s, v === true)} />{mlCoin(s)}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-sm text-slate-300">You are about to queue up to <strong>{count}</strong> run(s) ({chosen.length} coin(s) x {PRESETS[preset].horizons.length} horizon(s)).</p>
        </div>
        {error && <div role="alert" className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2 text-sm text-rose-200">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={start.isPending}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={chosen.length === 0 || symbols.length === 0 || start.isPending}>
            {start.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm and launch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
