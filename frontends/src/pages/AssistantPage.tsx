import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Mic, MicOff, Trash2, Sparkles, BarChart3, Lightbulb, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAIChat, useAnalyzeStrategy } from '@/hooks/useAIAssistant';
import { useStrategyInstances } from '@/hooks/useStrategy';
import { ChatMessage } from '@/components/assistant/ChatMessage';
import { StrategyAnalysisPanel } from '@/components/assistant/StrategyAnalysisPanel';
import { VoiceToggle } from '@/components/assistant/VoiceToggle';

export default function AssistantPage() {
  const { currentWorkspace } = useWorkspace();
  const { messages, sendMessage, isLoading, clearChat } = useAIChat(currentWorkspace?.id);
  const { data: instances = [] } = useStrategyInstances(currentWorkspace?.id);
  const analyzeStrategy = useAnalyzeStrategy();
  
  const [input, setInput] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ message: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAnalyze = async (instanceId: string) => {
    if (!currentWorkspace) return;
    setSelectedStrategy(instanceId);
    const result = await analyzeStrategy.mutateAsync({
      workspaceId: currentWorkspace.id,
      instanceId,
    });
    setAnalysis(result);
  };

  const quickPrompts = [
    { icon: Lightbulb, label: 'Explain my portfolio', prompt: 'Analyze my current portfolio performance and suggest improvements' },
    { icon: BarChart3, label: 'Market outlook', prompt: 'What is the current market outlook for crypto and stocks?' },
    { icon: Zap, label: 'Optimize strategies', prompt: 'How can I optimize my active trading strategies?' },
  ];

  return (
    <AppShell>
      <div className="p-4 md:p-6 h-[calc(100vh-80px)] flex gap-6">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Assistant</h1>
                <p className="text-sm text-muted-foreground">
                  Your autonomous trading copilot
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <VoiceToggle enabled={voiceEnabled} onToggle={setVoiceEnabled} />
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                disabled={messages.length === 0}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>

          {/* Chat Area */}
          <Card className="flex-1 bg-card border-border flex flex-col min-h-0">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full py-12"
                >
                  <div className="p-4 rounded-full bg-primary/10 mb-4">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-medium mb-2">How can I help you today?</h2>
                  <p className="text-muted-foreground text-sm text-center max-w-md mb-6">
                    Ask me about your strategies, market analysis, or let me help optimize your trading bots.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((qp) => (
                      <Button
                        key={qp.label}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setInput(qp.prompt)}
                      >
                        <qp.icon className="h-4 w-4" />
                        {qp.label}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {messages.map((msg, i) => (
                      <ChatMessage
                        key={i}
                        role={msg.role}
                        content={msg.content}
                        timestamp={msg.timestamp}
                        voiceEnabled={voiceEnabled}
                      />
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about strategies, markets, or trading..."
                  className="flex-1 bg-background"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Strategy Analysis Panel */}
        <StrategyAnalysisPanel
          instances={instances}
          selectedStrategy={selectedStrategy}
          analysis={analysis}
          isAnalyzing={analyzeStrategy.isPending}
          onAnalyze={handleAnalyze}
        />
      </div>
    </AppShell>
  );
}
