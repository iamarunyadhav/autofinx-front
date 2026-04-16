import { memo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  voiceEnabled?: boolean;
}

export const ChatMessage = memo(function ChatMessage({ 
  role, 
  content, 
  timestamp,
  voiceEnabled 
}: ChatMessageProps) {
  const isUser = role === 'user';
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content);
      utterance.rate = 1;
      utterance.pitch = 1;
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (voiceEnabled && role === 'assistant') {
      handleSpeak();
    }
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, [content, voiceEnabled, role]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-primary/10'
      }`}>
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>
      
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-4 py-2.5 ${
          isUser 
            ? 'bg-primary text-primary-foreground rounded-br-md' 
            : 'bg-secondary text-foreground rounded-bl-md'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
        
        <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {format(timestamp, 'HH:mm')}
            </span>
          )}
          {!isUser && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleSpeak}
            >
              <Volume2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
});
