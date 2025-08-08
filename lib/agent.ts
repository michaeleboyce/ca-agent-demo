import OpenAI from 'openai';
import type { DocChunk } from './types';
import { fuzzySearch, getChunksByIds } from './search';
import { buildSystemPrompt } from './prompts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Shared cache for read operations across requests
const readCache = new Map<string, { content: string; lines: string[] }>();

export type ToolName = 'search' | 'read';

export type ToolCallLog =
  | {
      type: 'search';
      query: string;
      resultsCount: number;
      results: { title: string; url: string }[];
    }
  | {
      type: 'read';
      documents: { title: string; linesRead: string }[];
    };

export type Citation = {
  id: string;
  url: string;
  title: string;
  content: string;
};

// Re-export from prompts.ts for backward compatibility
export { buildSystemPrompt };

export function getTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'search',
        description: 'Search for information using keywords.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read',
        description: 'Read content from documents with pagination.',
        parameters: {
          type: 'object',
          properties: {
            ids: { type: 'array', items: { type: 'string' } },
            lineOffset: { type: 'number' },
            lineCount: { type: 'number' },
          },
          required: ['ids'],
        },
      },
    },
  ];
}

export type AgentEventCallbacks = {
  onToolStart?: (tool: ToolName, data: any) => void;
  onToolComplete?: (tool: ToolName, data: any) => void;
};

export async function runAgent(options: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  index: DocChunk[];
  maxIterations?: number;
  callbacks?: AgentEventCallbacks;
  systemPromptOverride?: string;
  toolDescriptionsOverride?: Partial<Record<ToolName, string>>;
}): Promise<{ message: string; toolCalls: ToolCallLog[]; citations: Citation[] }> {
  const { messages, index, maxIterations = 10, callbacks, systemPromptOverride, toolDescriptionsOverride } = options;

  // Build tools with optional description overrides
  const baseTools = getTools();
  const tools = !toolDescriptionsOverride
    ? baseTools
    : baseTools.map((t) => {
        if (t.type !== 'function') return t;
        const name = t.function?.name as ToolName | undefined;
        if (!name) return t;
        const override = (toolDescriptionsOverride as any)[name];
        if (!override) return t;
        return {
          ...t,
          function: {
            ...t.function,
            description: override,
          },
        } as OpenAI.Chat.Completions.ChatCompletionTool;
      });

  const system = systemPromptOverride ?? buildSystemPrompt();
  const citedChunkIds = new Set<string>();
  const toolCalls: ToolCallLog[] = [];

  const conversationMessages: any[] = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: conversationMessages,
      tools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message as any;
    conversationMessages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      const content = message.content || '';
      const citations: Citation[] = Array.from(citedChunkIds)
        .map((id) => {
          const chunk = index.find((c) => c.id === id);
          return chunk
            ? {
                id: chunk.id,
                url: chunk.url,
                title: chunk.title,
                content: chunk.content.slice(0, 500),
              }
            : null;
        })
        .filter(Boolean) as Citation[];

      return { message: content, toolCalls, citations };
    }

    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}');

      if (toolCall.function.name === 'search') {
        callbacks?.onToolStart?.('search', { query: args.query });

        const searchResults = fuzzySearch(args.query, index, 8);

        callbacks?.onToolComplete?.('search', {
          query: args.query,
          results: searchResults.map((r) => ({
            id: r.chunk.id,
            title: r.chunk.title,
            url: r.chunk.url,
            matches: r.matches.slice(0, 2),
          })),
        });

        toolCalls.push({
          type: 'search',
          query: args.query,
          resultsCount: searchResults.length,
          results: searchResults.map((r) => ({ title: r.chunk.title, url: r.chunk.url })),
        });

        const searchResponse =
          searchResults.length > 0
            ? searchResults
                .map(
                  (r) =>
                    `Document: ${r.chunk.title}\nID: ${r.chunk.id}\nContext: ${r.matches
                      .map((m) => m.context)
                      .join(' | ')}`,
                )
                .join('\n---\n')
            : 'No results found.';

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: searchResponse,
        });

        searchResults.forEach((r) => citedChunkIds.add(r.chunk.id));
      } else if (toolCall.function.name === 'read') {
        const lineOffset = args.lineOffset || 0;
        const lineCount = args.lineCount || 50;

        callbacks?.onToolStart?.('read', {
          ids: args.ids,
          lineOffset,
          lineCount,
        });

        const chunks = getChunksByIds(index, args.ids);
        const readResults = chunks.map((chunk) => {
          let cached = readCache.get(chunk.id);
          if (!cached) {
            const lines = chunk.content.split('\n');
            cached = { content: chunk.content, lines };
            readCache.set(chunk.id, cached);
          }

          const totalLines = cached.lines.length;
          const endLine = Math.min(lineOffset + lineCount, totalLines);
          const selectedLines = cached.lines.slice(lineOffset, endLine);

          return {
            chunk,
            lines: selectedLines,
            lineOffset,
            endLine,
            totalLines,
            hasMore: endLine < totalLines,
          };
        });

        callbacks?.onToolComplete?.('read', {
          documents: readResults.map((r) => ({
            title: r.chunk.title,
            url: r.chunk.url,
            linesRead: `${r.lineOffset + 1}-${r.endLine} of ${r.totalLines}`,
            hasMore: r.hasMore,
          })),
        });

        toolCalls.push({
          type: 'read',
          documents: readResults.map((r) => ({
            title: r.chunk.title,
            linesRead: `${r.lineOffset + 1}-${r.endLine} of ${r.totalLines}`,
          })),
        });

        const readResponse = readResults
          .map(
            (r) =>
              `${r.chunk.title}\nLines ${r.lineOffset + 1}-${r.endLine}:\n${r.lines.join('\n')}`,
          )
          .join('\n---\n');

        conversationMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: readResponse,
        });

        chunks.forEach((c) => citedChunkIds.add(c.id));
      }
    }
  }

  // If we hit max iterations
  return {
    message: 'Max iterations reached. Unable to complete the request.',
    toolCalls,
    citations: [],
  };
}


