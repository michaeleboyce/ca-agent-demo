"use client";
import { useEffect, useRef } from "react";
import { useChat } from "./hooks/useChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "./EmptyState";

type ChatProps = {
  endpoint?: string;
  storageKey?: string;
  seedMessages?: { role: "user" | "assistant"; content: string }[];
  systemPrompt?: string;
  toolDescriptions?: { search?: string; read?: string };
};

export default function Chat(props: ChatProps) {
  const {
    messages,
    loading,
    activeTool,
    expandedTools,
    expandedCitations,
    sendMessage,
    clearChat,
    toggleTool,
    toggleCitation,
  } = useChat({
    endpoint: props.endpoint,
    storageKey: props.storageKey,
    seedMessages: props.seedMessages,
    systemPrompt: props.systemPrompt,
    toolDescriptions: props.toolDescriptions,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);

  // Keep viewport stable when citations expand/collapse
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 96; // px
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const wasNearBottom = distanceFromBottom < threshold;
    const prev = prevScrollHeightRef.current || el.scrollHeight;
    // Wait for layout to settle after render
    requestAnimationFrame(() => {
      const next = el.scrollHeight;
      const delta = next - prev;
      if (wasNearBottom) {
        el.scrollTop = next; // follow to bottom
      } else if (delta > 0) {
        el.scrollTop += delta; // preserve visible content position
      }
      prevScrollHeightRef.current = next;
    });
  }, [expandedCitations]);

  // Track baseline scrollHeight across renders
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    prevScrollHeightRef.current = el.scrollHeight;
  });

  return (
    <div className="max-w-4xl w-full mx-auto" style={{ height: 'calc(100vh - 200px)' }}>
      <div className="usa-card p-5 w-full h-full flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-1 no-scroll-anchor">
          {messages.length === 0 && <EmptyState />}
          <MessageList
            messages={messages}
            activeTool={activeTool}
            expandedTools={expandedTools}
            expandedCitations={expandedCitations}
            onToggleTool={toggleTool}
            onToggleCitation={toggleCitation}
            loading={loading}
            scrollContainerRef={scrollContainerRef}
          />
        </div>
        <div className="pt-3 mt-3 border-t border-neutral-200 dark:border-neutral-800">
          <ChatInput onSend={sendMessage} onClear={clearChat} disabled={loading} />
        </div>
      </div>
    </div>
  );
}