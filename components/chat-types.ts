"use client";

export type ActiveTool = {
  type: "search" | "read";
  status: "running" | "complete";
  query?: string;
  ids?: string[];
  lineOffset?: number;
  lineCount?: number;
  results?: any;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools?: ActiveTool[];
  citations?: any[];
};


