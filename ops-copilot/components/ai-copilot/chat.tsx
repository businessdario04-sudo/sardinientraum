'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/lib/store';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { CopilotMessage } from '@/lib/types';

const QUICK_QUESTIONS = [
  'What is critical right now?',
  'Which tasks are overdue?',
  'Which team has the most open work?',
  'What should I handle next?',
  "Summarize today's operations.",
  'Show tasks without assigned team.',
];

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n- /g, '<br/>• ')
    .replace(/\n(\d+)\. /g, '<br/>$1. ')
    .replace(/\n/g, '<br/>');
}

export function CopilotChat() {
  const { state, logActivity } = useApp();
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your Ops Co-Pilot. I have visibility into your current tasks, teams, and issues.\n\nYou currently have **${state.tasks.filter((t) => t.status !== 'completed').length} active tasks** — including **${state.tasks.filter((t) => t.priority === 'critical' && t.status !== 'completed').length} critical** items.\n\nWhat would you like to know?`,
      created_at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;

    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const opsContext = buildOpsContext(state);
      const res = await fetch('/api/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, opsContext }),
      });

      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();

      const assistantMsg: CopilotMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.answer,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      logActivity({
        entity_type: 'issue',
        entity_id: 'copilot',
        action: 'copilot_query',
        details: `Q: "${question.slice(0, 80)}…"`,
        created_at: new Date().toISOString(),
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I could not process that query. Please try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Quick actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex gap-3', msg.role === 'user' && 'flex-row-reverse')}
          >
            {/* Avatar */}
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs',
              msg.role === 'assistant' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700',
            )}>
              {msg.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>

            {/* Bubble */}
            <div className={cn(
              'max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'assistant'
                ? 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                : 'bg-blue-600 text-white',
            )}>
              {msg.role === 'assistant' ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${renderMarkdown(msg.content)}</p>` }}
                />
              ) : (
                <p>{msg.content}</p>
              )}
              <p className={cn('mt-1 text-[10px]', msg.role === 'assistant' ? 'text-slate-400' : 'text-blue-200')}>
                {formatRelativeTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
              <span className="text-xs text-slate-500">Analyzing operations data…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about current operations… (Enter to send, Shift+Enter for newline)"
          className="min-h-[48px] max-h-[120px] resize-none text-sm"
          disabled={loading}
        />
        <Button
          variant="primary"
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || loading}
          className="h-12 w-12 shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <p className="mt-2 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
        <Sparkles className="h-3 w-3" />
        AI suggestions are for decision support only. All actions require your confirmation.
      </p>
    </div>
  );
}

function buildOpsContext(state: ReturnType<typeof useApp>['state']): string {
  const activeTasks = state.tasks.filter((t) => t.status !== 'completed');
  const critical = activeTasks.filter((t) => t.priority === 'critical');
  const unassigned = activeTasks.filter((t) => !t.assigned_team_id);
  return `
Organization: ${state.settings.company_name}
Active tasks: ${activeTasks.length} (${critical.length} critical, ${unassigned.length} unassigned)
Teams: ${state.teams.map((t) => `${t.name} (${t.members.filter((m) => m.available).length}/${t.members.length} available)`).join(', ')}
Task summary: ${activeTasks.map((t) => `[${t.priority.toUpperCase()}] ${t.title} – ${t.status} – ${t.assigned_team_name ?? 'UNASSIGNED'}`).join('\n')}
  `.trim();
}
