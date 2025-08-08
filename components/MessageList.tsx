"use client";

import React, { useRef, useEffect } from "react";
import type { ActiveTool, ChatMessage } from "./chat-types";
import { ToolCard } from "./ToolCard";
import { MessageBubble } from "./MessageBubble";

type MessageListProps = {
  messages: ChatMessage[];
  activeTool: ActiveTool | null;
  expandedTools: Set<string>;
  expandedCitations: Set<string>;
  onToggleTool: (id: string) => void;
  onToggleCitation: (id: string) => void;
  loading: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  autoScroll?: boolean; // defaults to true
};

export function MessageList({
  messages,
  activeTool,
  expandedTools,
  expandedCitations,
  onToggleTool,
  onToggleCitation,
  loading,
  scrollContainerRef,
  autoScroll = true,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollContainerRef?.current;
    if (el) {
      const threshold = 96; // px
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const isNearBottom = distanceFromBottom < threshold;
      if (isNearBottom) {
        // Queue in rAF to happen after layout, keeps movement smooth
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    } else {
      endRef.current?.scrollIntoView({ behavior: "instant" as any, block: "nearest" });
    }
  }, [messages, activeTool, autoScroll, scrollContainerRef]);

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const showMessageBubble = m.role === "user" || m.content || (m.citations && m.citations.length > 0);
        return (
          <div key={m.id} className="space-y-2">
            {m.tools && m.tools.length > 0 && (
              <div className="space-y-1">
                {m.tools.map((tool, i) => (
                  <ToolCard
                    key={`${m.id}-${i}`}
                    tool={tool}
                    index={`${m.id}-${i}`}
                    isExpanded={expandedTools.has(`${m.id}-${i}`)}
                    onToggle={onToggleTool}
                  />
                ))}
              </div>
            )}

            {showMessageBubble && (
              <MessageBubble
                role={m.role}
                content={m.content}
                citations={m.citations as any}
                expandedCitations={expandedCitations}
                toggleCitation={onToggleCitation}
                scrollContainerRef={scrollContainerRef}
              />
            )}
          </div>
        );
      })}

      {activeTool && (
        <div className="space-y-1">
          <ToolCard tool={activeTool} index={"active"} isExpanded={expandedTools.has("active")} onToggle={onToggleTool} />
        </div>
      )}

      {loading && !activeTool && messages[messages.length - 1]?.role === "user" && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Thinking...
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}


