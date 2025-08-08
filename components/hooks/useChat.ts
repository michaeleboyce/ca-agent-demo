"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveTool, ChatMessage } from "../chat-types";

export function useChat(options?: {
  endpoint?: string;
  storageKey?: string;
  seedMessages?: { role: "user" | "assistant"; content: string }[];
  systemPrompt?: string;
  toolDescriptions?: { search?: string; read?: string };
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());

  const assistantIdRef = useRef<string | null>(null);

  const endpoint = options?.endpoint ?? "/api/chat";
  const LOCAL_STORAGE_KEY = options?.storageKey ?? "ca-agent-demo:chat:messages";
  const generateId = () =>
    (globalThis as any).crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Load messages from localStorage (or seed if none)
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const hydrated: ChatMessage[] = (parsed as any[]).map((m) => ({
            id: m.id ?? generateId(),
            role: m.role,
            content: m.content ?? "",
            tools: m.tools ?? [],
            citations: m.citations ?? [],
          }));
          setMessages(hydrated);
          return;
        }
      }
      // If nothing stored, optionally seed initial messages
      if (options?.seedMessages && Array.isArray(options.seedMessages) && options.seedMessages.length > 0) {
        const seeded: ChatMessage[] = options.seedMessages.map((m) => ({
          id: generateId(),
          role: m.role,
          content: m.content,
          tools: [],
          citations: [],
        }));
        setMessages(seeded);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist messages to localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {
      // ignore
    }
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { id: generateId(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: generateId(), role: "assistant", content: "", tools: [], citations: [] };

    setMessages((prev) => {
      const next = [...prev, userMsg, assistantMsg];
      assistantIdRef.current = assistantMsg.id;
      return next;
    });
    setLoading(true);
    setActiveTool(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages,
            userMsg,
          ].map((m) => ({ role: m.role, content: m.content })),
          systemPrompt: options?.systemPrompt,
          toolDescriptions: options?.toolDescriptions,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Chat API error: ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const update = JSON.parse(line.slice(6));
            switch (update.type) {
              case "tool_start": {
                const newTool: ActiveTool = {
                  type: update.tool as "search" | "read",
                  status: "running",
                  query: update.data.query,
                  ids: update.data.ids,
                  lineOffset: update.data.lineOffset,
                  lineCount: update.data.lineCount,
                };
                setActiveTool(newTool);
                break;
              }
              case "tool_complete": {
                const completedTool: ActiveTool = {
                  type: update.tool as "search" | "read",
                  status: "complete",
                  query: update.data.query,
                  results: update.data,
                };
                setActiveTool(null);
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
                  const msg = newMessages[targetIndex];
                  if (msg && msg.tools) {
                    const exists = msg.tools.some(
                      (t) =>
                        t.type === completedTool.type &&
                        t.query === completedTool.query &&
                        JSON.stringify(t.results) === JSON.stringify(completedTool.results),
                    );
                    if (!exists) msg.tools.push(completedTool);
                  }
                  return newMessages;
                });
                break;
              }
              case "message_chunk": {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
                  const msg = newMessages[targetIndex];
                  if (msg) msg.content = update.content;
                  return newMessages;
                });
                break;
              }
              case "message_complete": {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
                  const msg = newMessages[targetIndex];
                  if (msg) msg.content = update.content;
                  return newMessages;
                });
                break;
              }
              case "done": {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
                  const msg = newMessages[targetIndex];
                  if (msg) msg.citations = update.citations;
                  return newMessages;
                });
                break;
              }
              case "error": {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
                  const msg = newMessages[targetIndex];
                  if (msg) msg.content = "Sorry, something went wrong. Please try again.";
                  return newMessages;
                });
                break;
              }
            }
          } catch {
            // ignore bad JSON lines
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        const targetIndex = newMessages.findIndex((m) => m.id === assistantIdRef.current);
        const msg = newMessages[targetIndex];
        if (msg) msg.content = "Sorry, something went wrong. Please try again.";
        return newMessages;
      });
    } finally {
      setLoading(false);
      setActiveTool(null);
      assistantIdRef.current = null;
    }
  }

  function clearChat() {
    setMessages([]);
    setActiveTool(null);
    setExpandedTools(new Set());
    setExpandedCitations(new Set());
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

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

  return {
    // state
    messages,
    loading,
    activeTool,
    expandedTools,
    expandedCitations,
    // actions
    sendMessage,
    clearChat,
    toggleTool,
    toggleCitation,
  } as const;
}


