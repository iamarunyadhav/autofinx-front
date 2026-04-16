import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callEdgeFunction } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  mode: string;
}

export function useAIChat(workspaceId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { toast } = useToast();

  const sendMessage = useMutation({
    mutationFn: async ({ message, context }: { message: string; context?: Record<string, unknown> }) => {
      if (!workspaceId) throw new Error('No workspace selected');
      
      // Add user message optimistically
      const userMessage: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
      setMessages(prev => [...prev, userMessage]);

      const data = await callEdgeFunction<{ message: string; session_id: string }>('ai-assistant', {
        action: 'chat',
        workspace_id: workspaceId,
        message,
        session_id: sessionId,
        context,
      });

      setSessionId(data.session_id);
      
      const assistantMessage: ChatMessage = { role: 'assistant', content: data.message, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMessage]);
      
      return data;
    },
    onError: (error: Error) => {
      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      toast({
        title: 'AI Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  return {
    messages,
    sendMessage: sendMessage.mutate,
    isLoading: sendMessage.isPending,
    clearChat,
    sessionId,
  };
}

export function useAnalyzeStrategy() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workspaceId, instanceId }: { workspaceId: string; instanceId: string }) => {
      const data = await callEdgeFunction<{ analysis: string }>('ai-assistant', {
        action: 'analyze_strategy',
        workspace_id: workspaceId,
        instance_id: instanceId,
      });
      return data.analysis;
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useExplainTrade() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const data = await callEdgeFunction<{ explanation: string }>('ai-assistant', {
        action: 'explain_trade',
        order_id: orderId,
      });
      return data.explanation;
    },
    onError: (error: Error) => {
      toast({
        title: 'Explanation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAISessions(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['ai-sessions', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const data = await callEdgeFunction<{ sessions: Session[] }>('ai-assistant', {
        action: 'get_sessions',
        workspace_id: workspaceId,
      });
      return data.sessions;
    },
    enabled: !!workspaceId,
  });
}
