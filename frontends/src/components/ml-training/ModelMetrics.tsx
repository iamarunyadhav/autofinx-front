import { mlReasonText, mlWords } from "@/lib/mlTraining";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** The contract leaves holdout / folds / comparison shapes open, so flatten one level and show primitives only. */
function flatten(value: unknown): Array<[string, string | number | boolean | null]> {
  if (!isObj(value)) return [];
  const out: Array<[string, string | number | boolean | null]> = [];
  for (const [k, v] of Object.entries(value)) {
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) out.push([k, v as string | number | boolean | null]);
    else if (isObj(v)) {
      for (const [k2, v2] of Object.entries(v)) {
        if (v2 === null || ["string", "number", "boolean"].includes(typeof v2)) out.push([`${k} ${k2}`, v2 as string | number | boolean | null]);
      }
    }
  }
  return out;
}

function fmtValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return v;
}

export function KeyValueGrid({ title, data }: { title: string; data: unknown }) {
  const rows = flatten(data);
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-w-0 justify-between gap-2 border-b border-slate-800/70 py-0.5">
            <dt className="truncate text-slate-400" title={mlWords(k)}>{mlWords(k)}</dt>
            <dd className="shrink-0 tabular-nums text-slate-200">{fmtValue(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Walk-forward folds: one row per fold, columns are whatever primitive fields the backend sent. */
export function FoldsTable({ folds }: { folds: unknown }) {
  const rows = Array.isArray(folds) ? folds.filter(isObj).map((f) => Object.fromEntries(flatten(f))) : [];
  if (rows.length === 0) return <div className="text-xs text-slate-500">No walk-forward folds recorded for this model.</div>;
  const columns = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 8);
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Walk-forward folds ({rows.length})</div>
      <div className="max-w-full overflow-x-auto rounded-md border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/60 text-left text-slate-400">
              {columns.map((c) => <th key={c} scope="col" className="whitespace-nowrap px-2 py-1 font-medium">{mlWords(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                {columns.map((c) => {
                  const v = r[c];
                  const negative = typeof v === "number" && v < 0 && /net|pct/.test(c);
                  return <td key={c} className={`whitespace-nowrap px-2 py-1 tabular-nums ${negative ? "text-rose-300" : "text-slate-200"}`}>{fmtValue(v as never)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DecisionReason({ code }: { code: string | null | undefined }) {
  const text = mlReasonText(code);
  if (!text) return null;
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-300">
      <span className="text-slate-500">Verdict: </span>{text}
      {text !== code && <span className="ml-1 text-slate-600">({code})</span>}
    </div>
  );
}
