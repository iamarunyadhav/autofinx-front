import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Database } from '@/integrations/supabase/types';

type ExchangeConnection = Database['public']['Tables']['exchange_connections']['Row'];

interface ConnectionSelectorProps {
  connections: ExchangeConnection[];
  value?: string | null;
  onChange: (id: string) => void;
}

export function ConnectionSelector({ connections, value, onChange }: ConnectionSelectorProps) {
  return (
    <Select onValueChange={onChange} value={value || undefined}>
      <SelectTrigger className="h-9 w-48">
        <SelectValue placeholder="Select connection" />
      </SelectTrigger>
      <SelectContent>
        {connections.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name} ({c.provider}{c.is_testnet ? ' · testnet' : ''})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
