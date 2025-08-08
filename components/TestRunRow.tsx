'use client';
import { useEffect, useRef, useState } from 'react';
import type { TestScenario } from '@/lib/test-scenarios';
import type { ActiveTool as ChatActiveTool, ChatMessage } from './chat-types';
import { MessageList } from './MessageList';

type StreamDonePayload = {
  content: string;
  toolCalls?: any[];
  citations?: any[];
};

type TestRunRowProps = {
  scenario: TestScenario;
  runKey?: number; // bump to trigger a run
  initiallyExpanded?: boolean;
  onDone?: (payload: StreamDonePayload) => void;
  onError?: (message: string) => void;
  systemPrompt?: string;
  toolDescriptions?: { search?: string; read?: string };
};

export function TestRunRow({ scenario, runKey, initiallyExpanded = false, onDone, onError, systemPrompt, toolDescriptions }: TestRunRowProps) {
  const [expanded, setExpanded] = useState<boolean>(initiallyExpanded);

  // Chat-like state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTool, setActiveTool] = useState<ChatActiveTool | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);

  const controllerRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string>('assistant');

  function toggleTool(id: string) {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCitation(id: string) {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!runKey) return;
    // Auto-expand when a run is triggered
    setExpanded(true);
    startStreaming();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  async function startStreaming() {
    try {
      setLoading(true);
      setActiveTool(null);
      setExpandedTools(new Set());
      setExpandedCitations(new Set());

      // Initialize chat-like messages: user + empty assistant placeholder
      const initialUser: ChatMessage = {
        id: `user-${scenario.id}`,
        role: 'user',
        content: scenario.input,
        tools: [],
        citations: [],
      };
      const initialAssistant: ChatMessage = {
        id: assistantIdRef.current,
        role: 'assistant',
        content: '',
        tools: [],
        citations: [],
      };
      setMessages(() => [initialUser, initialAssistant]);

      const conversation = [...(scenario.previousMessages || []), { role: 'user' as const, content: scenario.input }];

      const controller = new AbortController();
      controllerRef.current = controller;

      const response = await fetch('/api/test/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          systemPrompt,
          toolDescriptions: {
            search: toolDescriptions?.search,
            read: toolDescriptions?.read,
          },
        }),
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';
      let finalCitations: any[] = [];
      let finalToolCalls: any[] = [];

      if (!reader) throw new Error('No reader');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const update = JSON.parse(line.slice(6));
            switch (update.type) {
              case 'tool_start': {
                const newTool: ChatActiveTool = {
                  type: update.tool,
                  status: 'running',
                  query: update.data?.query,
                  ids: update.data?.ids,
                  lineOffset: update.data?.lineOffset,
                  lineCount: update.data?.lineCount,
                };
                setActiveTool(newTool);
                break;
              }
              case 'tool_complete': {
                const completedTool: ChatActiveTool = {
                  type: update.tool,
                  status: 'complete',
                  query: update.data?.query,
                  results: update.data,
                };
                setActiveTool(null);
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantIdRef.current);
                  if (idx >= 0) {
                    const msg = { ...next[idx] };
                    msg.tools = [...(msg.tools || []), completedTool];
                    next[idx] = msg;
                  }
                  return next;
                });
                break;
              }
              case 'message_chunk': {
                const content: string = update.content || '';
                finalContent = content;
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantIdRef.current);
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], content };
                  }
                  return next;
                });
                break;
              }
              case 'message_complete': {
                const content: string = update.content || '';
                finalContent = content;
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantIdRef.current);
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], content };
                  }
                  return next;
                });
                break;
              }
              case 'done': {
                finalCitations = update.citations || [];
                finalToolCalls = update.toolCalls || [];
                setMessages((prev) => {
                  const next = [...prev];
                  const idx = next.findIndex((m) => m.id === assistantIdRef.current);
                  if (idx >= 0) {
                    next[idx] = { ...next[idx], citations: finalCitations };
                  }
                  return next;
                });
                setLoading(false);
                onDone?.({ content: finalContent, toolCalls: finalToolCalls, citations: finalCitations });
                break;
              }
              case 'error': {
                setLoading(false);
                onError?.(update.message || 'An error occurred');
                break;
              }
            }
          } catch (_) {
            // ignore malformed line
          }
        }
      }
    } catch (err: any) {
      setLoading(false);
      onError?.(err?.message || 'Streaming failed');
    }
  }

  return (
    <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
      {/* Header with manual expand/collapse */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium truncate">{scenario.name}</div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          {expanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Input and scenario details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="md:col-span-1">
              <div className="text-neutral-500">Input</div>
              <div className="mt-1 p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                {scenario.input}
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <div>
                <div className="text-neutral-500">Expected Behavior</div>
                <div className="mt-1 p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                  {scenario.expectedBehavior}
                </div>
              </div>
              {scenario.successCriteria && scenario.successCriteria.length > 0 && (
                <div>
                  <div className="text-neutral-500">Success Criteria</div>
                  <ul className="mt-1 p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 list-disc list-inside">
                    {scenario.successCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Chat-like streaming output */}
          <div
            className="max-h-80 overflow-y-auto rounded border border-neutral-200 dark:border-neutral-800 p-3 bg-neutral-50/60 dark:bg-neutral-900/40"
          >
            <MessageList
              messages={messages}
              activeTool={activeTool}
              expandedTools={expandedTools}
              expandedCitations={expandedCitations}
              onToggleTool={toggleTool}
              onToggleCitation={toggleCitation}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
