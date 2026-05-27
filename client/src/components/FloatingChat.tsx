import { useState, useCallback } from 'react';
import { MessageCircle, X, Minimize2 } from 'lucide-react';
import { AIChatBox, type Message } from '@/components/AIChatBox';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const SYSTEM_MSG: Message = {
  role: 'system',
  content: 'You are BayShield, an AI assistant for emergency managers and residents in the Tampa Bay area. Answer questions about current weather, active storms, shelters, evacuation routes, and what to do during natural disasters. Use plain, clear language — no technical jargon. Be concise and calm.',
};

const SUGGESTED = [
  'Is there a storm threatening Tampa Bay right now?',
  'Where are the nearest open shelters?',
  'What should I do if there is a hurricane warning?',
  'How do I prepare my home for a hurricane?',
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([SYSTEM_MSG]);
  const [isLoading, setIsLoading] = useState(false);

  const chatMutation = trpc.bayshield.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      }]);
      setIsLoading(false);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I ran into an issue. Please try again.',
      }]);
      setIsLoading(false);
    },
  });

  const handleSend = useCallback((content: string) => {
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setIsLoading(true);
    chatMutation.mutate({ messages: next });
  }, [messages, chatMutation]);

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            'fixed bottom-20 right-4 z-50 flex flex-col rounded-2xl border border-white/12 shadow-[0_32px_64px_rgba(2,6,23,0.55)] transition-all duration-200',
            minimized ? 'h-12 w-72 overflow-hidden' : 'h-[520px] w-[360px]',
          )}
          style={{ background: 'rgba(6,11,22,0.96)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20">
                <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-white">Ask BayShield</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">LIVE</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(m => !m)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/6 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="flex-1 overflow-hidden">
              <AIChatBox
                messages={messages}
                onSendMessage={handleSend}
                isLoading={isLoading}
                placeholder="Ask about storms, shelters, evacuation..."
                className="h-full rounded-none border-0 bg-transparent"
                height="100%"
                emptyStateMessage="Ask me anything about current conditions, storms, or what to do"
                suggestedPrompts={SUGGESTED}
              />
            </div>
          )}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(o => !o); setMinimized(false); }}
        className="fixed bottom-4 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full border border-blue-400/30 bg-[linear-gradient(135deg,rgba(59,130,246,0.9),rgba(37,99,235,0.9))] shadow-[0_8px_32px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:scale-105 hover:shadow-[0_12px_40px_rgba(59,130,246,0.55)]"
        aria-label="Open AI assistant"
        style={{ height: 52, width: 52 }}
      >
        {open
          ? <X className="h-5 w-5 text-white" />
          : <MessageCircle className="h-5 w-5 text-white" />
        }
      </button>
    </>
  );
}
