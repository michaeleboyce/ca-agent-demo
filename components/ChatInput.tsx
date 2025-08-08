"use client";

import React, { useRef, useEffect, useState } from "react";

type ChatInputProps = {
  onSend: (text: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, onClear, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 200; // px
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || disabled) return;
    const text = input;
    setInput("");
    onSend(text);
    textareaRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        className="usa-input flex-1 resize-none leading-6"
        placeholder="Ask a question about the California resources..."
        value={input}
        rows={1}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        aria-label="Chat message"
      />
      <button type="submit" disabled={disabled || !input.trim()} className="usa-button-primary">
        {disabled ? "Processing..." : "Send"}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="usa-button-secondary"
        aria-label="Clear chat"
        title="Clear chat"
      >
        Clear chat
      </button>
    </form>
  );
}


