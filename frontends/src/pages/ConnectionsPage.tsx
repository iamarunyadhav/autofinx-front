import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectionCard, AddConnectionModal, EditConnectionModal, ServerDiagnosticsSection } from '@/components/connections';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useConnections, 
  useCreateConnection, 
  useUpdateConnection, 
  useDeleteConnection,
  useTestConnection,
  useSyncConnection,
  useRotateConnection
} from '@/hooks/useConnections';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { ExchangeConnection } from '@/hooks/useConnections';
import { AppShell } from '@/components/layout';

export default function ConnectionsPage() {
  const { currentWorkspace } = useWorkspace();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ExchangeConnection | null>(null);
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);

  const { data: connections, isLoading } = useConnections(currentWorkspace?.id);
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();
  const deleteConnection = useDeleteConnection();
  const testConnection = useTestConnection();
  const syncConnection = useSyncConnection();
  const rotateConnection = useRotateConnection();

  const handleAddConnection = (data: {
    name: string;
    provider: string;
    api_key: string;
    api_secret: string;
    passphrase?: string;
    is_testnet?: boolean;
  }) => {
    if (!currentWorkspace?.id) return;
    
    createConnection.mutate({
      workspace_id: currentWorkspace.id,
      ...data,
    }, {
      onSuccess: () => setShowAddModal(false),
    });
  };

  const handleToggleConnection = (id: string, enabled: boolean) => {
    if (!currentWorkspace?.id) return;
    updateConnection.mutate({ id, workspaceId: currentWorkspace.id, is_enabled: enabled });
  };

  const handleDeleteConnection = (id: string) => {
    if (!currentWorkspace?.id) return;
    deleteConnection.mutate({ id, workspaceId: currentWorkspace.id });
  };

  const handleTestConnection = async (id: string) => {
    setTestingConnectionId(id);
    try {
      await testConnection.mutateAsync({ connectionId: id });
    } finally {
      setTestingConnectionId(null);
    }
  };

  const handleEditConnection = (connection: ExchangeConnection) => {
    setEditingConnection(connection);
  };

  const handleSyncConnection = async (id: string) => {
    if (!currentWorkspace?.id) return;
    setSyncingConnectionId(id);
    try {
      await syncConnection.mutateAsync({ connectionId: id, workspaceId: currentWorkspace.id });
    } finally {
      setSyncingConnectionId(null);
    }
  };

  const handleRotateConnection = async (id: string) => {
    if (!currentWorkspace?.id) return;
    rotateConnection.mutate({ id, workspaceId: currentWorkspace.id });
  };

  const handleSaveEdit = (id: string, data: { name?: string; is_testnet?: boolean; is_enabled?: boolean; api_key?: string; api_secret?: string; passphrase?: string }) => {
    if (!currentWorkspace?.id) return;

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.is_testnet !== undefined) updates.is_testnet = data.is_testnet;
    if (data.is_enabled !== undefined) updates.is_enabled = data.is_enabled;
    if (data.api_key) updates.api_key = data.api_key;
    if (data.api_secret) updates.api_secret = data.api_secret;
    if (data.passphrase) updates.passphrase = data.passphrase;

    updateConnection.mutate({ id, workspaceId: currentWorkspace.id, ...updates }, {
      onSuccess: () => setEditingConnection(null),
    });
  };

  const activeConnections = connections?.filter(c => c.is_enabled) || [];
  const hasLiveConnections = connections?.some(c => c.is_enabled && !c.is_testnet);

  return (
    <AppShell>
    <div className="p-4 md:p-6 space-y-6">
      <Tabs defaultValue="exchanges">
        <TabsList>
          <TabsTrigger value="exchanges">Exchange Connections</TabsTrigger>
          <TabsTrigger value="servers">Server Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="exchanges" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exchange Connections</h1>
          <p className="text-muted-foreground">
            Manage your exchange API integrations for automated trading
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{connections?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Connections</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-running/10 to-running/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-running/20">
                <Link2 className="h-5 w-5 text-running" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeConnections.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {hasLiveConnections ? 'Live' : 'Paper'}
                </p>
                <p className="text-sm text-muted-foreground">Trading Mode</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Secure API Management</AlertTitle>
        <AlertDescription>
          Your API credentials are encrypted and never exposed. We recommend creating API keys 
          with trade-only permissions (disable withdrawals) for maximum security.
        </AlertDescription>
      </Alert>

      {/* Connections Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {connections.map((connection) => (
              <ConnectionCard
                key={connection.id}
                connection={connection}
                onToggle={handleToggleConnection}
                onDelete={handleDeleteConnection}
                onTest={handleTestConnection}
                onSync={handleSyncConnection}
                onEdit={handleEditConnection}
                onRotate={handleRotateConnection}
                isTesting={testingConnectionId === connection.id}
                isSyncing={syncingConnectionId === connection.id}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Link2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Connections Yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                Connect your exchange accounts to start automated trading with your strategies
              </p>
              <Button onClick={() => setShowAddModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Connection
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Connection Modal */}
      <AddConnectionModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={handleAddConnection}
        isLoading={createConnection.isPending}
      />

      {/* Edit Connection Modal */}
      <EditConnectionModal
        connection={editingConnection}
        open={!!editingConnection}
        onOpenChange={(open) => !open && setEditingConnection(null)}
        onSubmit={handleSaveEdit}
        isLoading={updateConnection.isPending}
      />
        </TabsContent>

        <TabsContent value="servers">
          <ServerDiagnosticsSection workspaceId={currentWorkspace?.id} />
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}
