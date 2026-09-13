import { useState, type ReactNode } from "react";
import { AlertTriangle, PlugZap, ShieldAlert, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useServerConnections,
  useCreateServerConnection,
  useDeleteServerConnection,
  useTestServerConnection,
  useServerConnectionChecks,
  useRunServerCheck,
  type ServerConnection,
  type ServerConnectionStatus,
  type ServerAuthMethod,
} from "@/hooks/useServerConnections";

// ---------------------------------------------------------------------------
// Status palette -- same convention as ForexGridBotPage/PepperstoneBotPage/
// AuditResearchPage: good/warning/serious/critical hex tokens.
// ---------------------------------------------------------------------------

const GOOD = "#0ca30c";
const WARNING = "#fab219";
const CRITICAL = "#d03b3b";
const NEUTRAL = "#94a3b8";

const STATUS_META: Record<ServerConnectionStatus, { label: string; color: string }> = {
  connected: { label: "Connected", color: GOOD },
  disconnected: { label: "Disconnected", color: NEUTRAL },
  not_configured: { label: "Not configured", color: NEUTRAL },
  degraded: { label: "Degraded", color: WARNING },
  unauthorized: { label: "Unauthorized", color: CRITICAL },
  unknown: { label: "Unknown", color: NEUTRAL },
};

function ColorBadge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: ServerConnectionStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown;
  return <ColorBadge color={meta.color}>{meta.label}</ColorBadge>;
}

function prettyLabel(value?: string | null): string {
  if (!value) return "None";
  return value.replace(/_/g, " ");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

// ---------------------------------------------------------------------------
// Add-connection form. `credential` only ever lives in this component's own
// local state while the user is filling out the form -- it is sent once on
// submit and immediately cleared, never stored anywhere the list/cache can
// see it, and the API response never contains it either.
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  name: "",
  host: "",
  port: "22",
  ssh_username: "",
  auth_method: "key" as ServerAuthMethod,
  credential: "",
};

function AddServerConnectionForm({ workspaceId }: { workspaceId: string }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const createConnection = useCreateServerConnection();

  const handleSubmit = () => {
    if (!form.name.trim() || !form.host.trim() || !form.ssh_username.trim() || !form.credential.trim()) {
      return;
    }
    const port = Number(form.port);
    createConnection.mutate(
      {
        workspace_id: workspaceId,
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number.isFinite(port) && port > 0 ? port : undefined,
        ssh_username: form.ssh_username.trim(),
        auth_method: form.auth_method,
        credential: form.credential,
      },
      {
        onSuccess: () => setForm(EMPTY_FORM),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add server connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Use a restricted, read-only diagnostic user only</AlertTitle>
          <AlertDescription>
            Never enter root or a general-purpose account here. This app only ever runs a small,
            fixed set of read-only diagnostic commands (disk/memory/process/queue checks) against
            this login -- it can never run an arbitrary command. Set up a dedicated SSH user on
            your server with the minimum permissions needed to run those checks, and use its
            credentials here.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Production app server"
            />
          </div>
          <div className="space-y-2">
            <Label>Host</Label>
            <Input
              value={form.host}
              onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
              placeholder="e.g. 203.0.113.10 or example.com"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>SSH port</Label>
            <Input
              type="number"
              value={form.port}
              onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
              placeholder="22"
            />
          </div>
          <div className="space-y-2">
            <Label>SSH username (restricted diagnostic user)</Label>
            <Input
              value={form.ssh_username}
              onChange={(event) => setForm((current) => ({ ...current, ssh_username: event.target.value }))}
              placeholder="e.g. autofinx_diag"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Authentication method</Label>
          <RadioGroup
            value={form.auth_method}
            onValueChange={(value: ServerAuthMethod) =>
              setForm((current) => ({ ...current, auth_method: value, credential: "" }))
            }
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="key" id="auth-method-key" />
              <Label htmlFor="auth-method-key" className="font-normal">SSH Key</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="password" id="auth-method-password" />
              <Label htmlFor="auth-method-password" className="font-normal">Password</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>{form.auth_method === "key" ? "Private key" : "Password"}</Label>
          {form.auth_method === "key" ? (
            <Textarea
              value={form.credential}
              onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              rows={6}
              className="font-mono text-xs"
            />
          ) : (
            <Input
              type="password"
              value={form.credential}
              onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))}
              placeholder="Password for the restricted diagnostic user"
            />
          )}
        </div>

        <Button type="button" onClick={handleSubmit} disabled={createConnection.isPending}>
          <PlugZap className="mr-2 h-4 w-4" />
          Save server connection
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Run-check control -- populated live from GET /server-connections/{id}/checks
// (DiagnosticCheckRegistry::keys()), never hardcoded here.
// ---------------------------------------------------------------------------

function RunCheckControl({ connection, workspaceId }: { connection: ServerConnection; workspaceId: string }) {
  const checksQuery = useServerConnectionChecks(connection.id);
  const checks = checksQuery.data ?? [];
  const [selectedCheck, setSelectedCheck] = useState<string>("");
  const runCheck = useRunServerCheck();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedCheck} onValueChange={setSelectedCheck}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder={checksQuery.isLoading ? "Loading checks..." : "Select a diagnostic check"} />
        </SelectTrigger>
        <SelectContent>
          {checks.map((checkKey) => (
            <SelectItem key={checkKey} value={checkKey}>
              {prettyLabel(checkKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!selectedCheck || runCheck.isPending}
        onClick={() =>
          runCheck.mutate({ id: connection.id, workspaceId, checkKey: selectedCheck })
        }
      >
        <Terminal className="mr-2 h-4 w-4" />
        Run
      </Button>
    </div>
  );
}

function ServerConnectionCard({ connection, workspaceId }: { connection: ServerConnection; workspaceId: string }) {
  const testConnection = useTestServerConnection();
  const deleteConnection = useDeleteServerConnection();

  const result = connection.last_check_result;
  const output = result && typeof result.output === "string" ? result.output : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{connection.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {connection.ssh_username}@{connection.host}:{connection.port} &middot; {prettyLabel(connection.auth_method)}
          </p>
        </div>
        <StatusBadge status={connection.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Last checked: {formatDateTime(connection.last_checked_at)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={testConnection.isPending}
            onClick={() => testConnection.mutate({ id: connection.id, workspaceId })}
          >
            Test connection
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleteConnection.isPending}
            onClick={() => deleteConnection.mutate({ id: connection.id, workspaceId })}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>

        <RunCheckControl connection={connection} workspaceId={workspaceId} />

        {result ? (
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">Last check result</div>
            {output ? (
              <pre className="max-h-56 overflow-auto rounded-lg border border-border/70 bg-muted/20 p-3 text-xs font-mono whitespace-pre-wrap">
                {output}
              </pre>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Connected: {String(result.connected ?? "unknown")}</span>
              <span>Authenticated: {String(result.authenticated ?? "unknown")}</span>
              {result.mode ? <span>Mode: {String(result.mode)}</span> : null}
              {result.check_key ? <span>Check: {prettyLabel(String(result.check_key))}</span> : null}
              {result.error ? <span className="text-destructive">Error: {String(result.error)}</span> : null}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No diagnostic check has been run yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ServerDiagnosticsSection({ workspaceId }: { workspaceId: string | undefined }) {
  const connectionsQuery = useServerConnections(workspaceId);
  const connections = connectionsQuery.data ?? [];

  if (!workspaceId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Select a workspace first.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Not an exchange connection</AlertTitle>
        <AlertDescription>
          Server connections are used purely for read-only SSH diagnostics (disk, memory,
          process health, queue backlog) -- they never place trades and are entirely separate
          from your exchange API connections above.
        </AlertDescription>
      </Alert>

      <AddServerConnectionForm workspaceId={workspaceId} />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Server connections ({connections.length})
        </h3>
        {connectionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading server connections...</p>
        ) : connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No server connections yet. Add one above to start running read-only diagnostics.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connections.map((connection) => (
              <ServerConnectionCard key={connection.id} connection={connection} workspaceId={workspaceId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
