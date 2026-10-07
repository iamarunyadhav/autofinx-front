import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SourceInput } from "@/components/strategy-lab/SourceInput";
import { useLabCreateCandidate } from "@/hooks/useStrategyLab";
import {
  LAB_MAX_SOURCE_BYTES,
  LAB_PURPOSES,
  LAB_SOURCE_TYPES,
  labByteLength,
  labErrorMessage,
  labWords,
  type LabPurpose,
  type LabSourceType,
} from "@/lib/strategyLab";

const EMPTY = {
  name: "",
  description: "",
  sourceType: "PINE" as LabSourceType,
  purpose: "FULL_STRATEGY" as LabPurpose,
  timeframe: "",
  notes: "",
  source: "",
};

export function NewCandidateDialog({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const create = useLabCreateCandidate(workspaceId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const name = form.name.trim();
  const sourceBytes = labByteLength(form.source);
  const ready = name.length > 0 && name.length <= 120 && form.source.trim().length > 0 && sourceBytes <= LAB_MAX_SOURCE_BYTES;

  const submit = async () => {
    setError(null);
    try {
      const res = await create.mutateAsync({
        name,
        description: form.description.trim() || undefined,
        source_type: form.sourceType,
        intended_purpose: form.purpose,
        original_timeframe: form.timeframe.trim() || undefined,
        notes: form.notes.trim() || undefined,
        source: form.source,
      });
      toast.success(`"${name}" saved and audited as text`);
      setOpen(false);
      setForm(EMPTY);
      if (res?.candidate?.id) navigate(`/strategy-lab/${encodeURIComponent(res.candidate.id)}`);
    } catch (e) {
      setError(labErrorMessage(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!create.isPending) { setOpen(next); setError(null); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-3.5 w-3.5" />New candidate</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New research candidate</DialogTitle>
          <DialogDescription>
            The source is stored and statically audited as text. It is never executed, and nothing here can place an order.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="sl-new-name">Name</Label>
            <Input id="sl-new-name" value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Supertrend + RSI filter" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="sl-new-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="sl-new-desc" value={form.description} maxLength={2000} rows={2} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-new-type">Source type</Label>
            <Select value={form.sourceType} onValueChange={(v) => set("sourceType", v as LabSourceType)}>
              <SelectTrigger id="sl-new-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAB_SOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t === "PINE" ? "Pine Script" : labWords(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-new-purpose">Intended purpose</Label>
            <Select value={form.purpose} onValueChange={(v) => set("purpose", v as LabPurpose)}>
              <SelectTrigger id="sl-new-purpose"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAB_PURPOSES.map((p) => <SelectItem key={p} value={p}>{labWords(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-new-tf">Original timeframe <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="sl-new-tf" value={form.timeframe} maxLength={16} onChange={(e) => set("timeframe", e.target.value)} placeholder="e.g. 15m" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-new-notes">Version notes <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="sl-new-notes" value={form.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {form.sourceType !== "PINE" && (
            <p className="text-xs text-warning sm:col-span-2">
              Only the Pine adapter exists in this build: other source types are stored but audited as UNSUPPORTED and can't be tested.
            </p>
          )}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="sl-new-source">Source</Label>
            <SourceInput id="sl-new-source" value={form.source} onChange={(v) => set("source", v)} disabled={create.isPending} />
          </div>
        </div>

        {error && <div role="alert" className="rounded-md border border-error/40 bg-error/10 p-2 text-sm text-error">{error}</div>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!ready || create.isPending}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save and audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
