"use client";

import React from "react";
import type { ActiveTool } from "./chat-types";

type ToolCardProps = {
  tool: ActiveTool;
  index: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
};

export function ToolCard({ tool, index, isExpanded, onToggle }: ToolCardProps) {
  const isRunning = tool.status === "running";

  return (
    <div className="border border-neutral-200 dark:border-neutral-700 rounded-xl overflow-hidden bg-white/60 dark:bg-neutral-900/60">
      <button
        onClick={() => !isRunning && onToggle(index)}
        disabled={isRunning}
        className={`w-full px-3 py-2 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 ${
          isRunning
            ? "bg-yellow-50/60 dark:bg-yellow-900/20"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-civic-blue-400"
        } transition-colors`}
        aria-expanded={isExpanded}
        aria-label={`${tool.type === "search" ? `Search results for "${tool.query}"` : "Document reading results"}${isRunning ? " - in progress" : ""}`}
      >
        <span className="inline-flex items-center gap-2">
          {isRunning && (
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {tool.type === "search" && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>{isRunning ? "Searching" : "Searched"} for: "{tool.query}"</span>
              {tool.results?.results && (
                <span className="text-neutral-500">• Found {tool.results.results.length} results</span>
              )}
            </>
          )}
          {tool.type === "read" && (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isRunning ? "Reading" : "Read"} documents</span>
              {tool.lineOffset !== undefined && tool.lineCount && (
                <span className="text-neutral-500">• Lines {tool.lineOffset + 1}-{tool.lineCount + tool.lineOffset}</span>
              )}
            </>
          )}
        </span>
        {!isRunning && (
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isExpanded && tool.status === "complete" && tool.type === "search" && (
        tool.results?.results && (
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
            <div className="space-y-2">
              {tool.results.results.map((result: any, ri: number) => (
                <div key={ri} className="text-xs">
                  <div className="font-medium text-neutral-700 dark:text-neutral-300">
                    {ri + 1}. {result.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">{result.url}</div>
                  {result.matches && result.matches.length > 0 && (
                    <div className="mt-1 pl-3 border-l-2 border-neutral-300 dark:border-neutral-600">
                      {result.matches.map((match: any, mi: number) => (
                        <div key={mi} className="text-[10px] text-neutral-600 dark:text-neutral-400 italic">
                          {`"...${String(match.context).slice(0, 150)}..."`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {isExpanded && tool.status === "complete" && tool.type === "read" && (
        tool.results?.documents && (
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
            <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              {tool.results.documents.map((doc: any, di: number) => (
                <div key={di}>
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-[10px]">Read {doc.linesRead}</div>
                  {doc.hasMore && (
                    <div className="text-[10px] text-civic-blue-600 mt-1">More lines available - AI can read more if needed</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}


