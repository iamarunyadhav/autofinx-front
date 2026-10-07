import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LAB_MAX_SOURCE_BYTES, labByteLength } from "@/lib/strategyLab";

interface SourceInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
}

/**
 * Paste box for strategy source plus an optional .pine/.txt picker. The file
 * is read client-side as plain TEXT (FileReader) into the textarea — there is
 * no multipart upload, and the text is never evaluated in the browser.
 */
export function SourceInput({ id, value, onChange, disabled = false, rows = 12 }: SourceInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const bytes = labByteLength(value);
  const tooBig = bytes > LAB_MAX_SOURCE_BYTES;

  const pick = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (file.size > LAB_MAX_SOURCE_BYTES) {
      setFileError(`That file is ${file.size.toLocaleString()} bytes; the limit is ${LAB_MAX_SOURCE_BYTES.toLocaleString()}.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setFileError("Could not read that file as text.");
    reader.readAsText(file);
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        autoComplete="off"
        placeholder={'//@version=5\nstrategy("My idea", overlay=true)\n...'}
        className="font-mono text-xs leading-relaxed"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pine,.txt,text/plain"
            className="hidden"
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
          />
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-2 h-3.5 w-3.5" />Load .pine / .txt
          </Button>
          <span className="text-muted-foreground">read as text in your browser</span>
        </div>
        <span className={cn("tabular-nums", tooBig ? "font-semibold text-error" : "text-muted-foreground")}>
          {bytes.toLocaleString()} / {LAB_MAX_SOURCE_BYTES.toLocaleString()} bytes
        </span>
      </div>
      {fileError && <div role="alert" className="text-xs text-error">{fileError}</div>}
    </div>
  );
}
