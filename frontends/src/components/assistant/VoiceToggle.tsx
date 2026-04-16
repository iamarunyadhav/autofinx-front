import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface VoiceToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function VoiceToggle({ enabled, onToggle }: VoiceToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={enabled ? 'default' : 'outline'}
          size="icon"
          onClick={() => onToggle(!enabled)}
          className={enabled ? 'bg-primary' : ''}
        >
          {enabled ? (
            <Mic className="h-4 w-4" />
          ) : (
            <MicOff className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? 'Disable voice responses' : 'Enable voice responses'}
      </TooltipContent>
    </Tooltip>
  );
}
