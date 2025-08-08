import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { loadIndex } from '@/lib/index';
import { fuzzySearch, getChunksByIds } from '@/lib/search';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache for read documents (same as main chat)
const readCache = new Map<string, { content: string; lines: string[] }>();

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const index = loadIndex();
  const citedChunkIds = new Set<string>();
  const toolCalls: any[] = [];

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'search',
        description: 'Search for information using keywords.',
        parameters: { 
          type: 'object', 
          properties: { 
            query: { type: 'string' } 
          }, 
          required: ['query'] 
        }
      }
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
            lineCount: { type: 'number' }
          }, 
          required: ['ids'] 
        }
      }
    }
  ];

  const system = `You are a civic-help assistant for California government resources. 

You can answer questions about:
1. YOUR CAPABILITIES AND PURPOSE:
   - You are a chatbot designed to help users navigate California government services
   - You search through scraped government documents to find accurate information
   - You show your search process transparently so users can see how you find answers
   - You can search multiple times and read documents partially to find information efficiently

2. AVAILABLE RESOURCES:
   - Emergency alerts signup (Listos California)
   - California unemployment (EDD) 
   - South Coast air quality map (ArcGIS)
   - LA County Hazardous Tree Removal waiver (PDF)
   - USCIS N-565 (replacement naturalization/citizenship docs)

For questions outside these topics, politely explain: "I can only help with the California government resources I have access to."

HOW TO USE YOUR TOOLS:
- Use 'search' with relevant keywords to find information
- Use 'read' to get document content (starts with 50 lines, can read more if needed)
- Be thorough - search and read iteratively until you have enough information`;

  const conversationMessages: any[] = [
    { role: 'system', content: system },
    ...messages.map((m: any) => ({ role: m.role, content: m.content }))
  ];

  try {
    for (let i = 0; i < 10; i++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: conversationMessages,
        tools,
        tool_choice: 'auto'
      });

      const message = response.choices[0].message;
      conversationMessages.push(message);

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return NextResponse.json({
          message: message.content || '',
          toolCalls,
          citations: Array.from(citedChunkIds).map(id => {
            const chunk = index.find(c => c.id === id);
            return chunk ? {
              id: chunk.id,
              url: chunk.url,
              title: chunk.title,
              content: chunk.content.slice(0, 500)
            } : null;
          }).filter(Boolean)
        });
      }

      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments || '{}');
        
        if (toolCall.function.name === 'search') {
          const searchResults = fuzzySearch(args.query, index, 8);
          
          toolCalls.push({
            type: 'search',
            query: args.query,
            resultsCount: searchResults.length,
            results: searchResults.map(r => ({
              title: r.chunk.title,
              url: r.chunk.url
            }))
          });

          const searchResponse = searchResults.length > 0
            ? searchResults.map(r => 
                `Document: ${r.chunk.title}\nID: ${r.chunk.id}\nContext: ${r.matches.map(m => m.context).join(' | ')}`
              ).join('\n---\n')
            : 'No results found.';

          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: searchResponse
          });

          searchResults.forEach(r => citedChunkIds.add(r.chunk.id));
        }
        
        else if (toolCall.function.name === 'read') {
          const lineOffset = args.lineOffset || 0;
          const lineCount = args.lineCount || 50;
          const chunks = getChunksByIds(index, args.ids);
          
          const readResults = chunks.map(chunk => {
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
              hasMore: endLine < totalLines
            };
          });
          
          toolCalls.push({
            type: 'read',
            documents: readResults.map(r => ({
              title: r.chunk.title,
              linesRead: `${r.lineOffset + 1}-${r.endLine} of ${r.totalLines}`
            }))
          });

          const readResponse = readResults.map(r => 
            `${r.chunk.title}\nLines ${r.lineOffset + 1}-${r.endLine}:\n${r.lines.join('\n')}`
          ).join('\n---\n');

          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: readResponse
          });

          chunks.forEach(c => citedChunkIds.add(c.id));
        }
      }
    }

    // If we hit max iterations
    return NextResponse.json({
      message: 'Max iterations reached. Unable to complete the request.',
      toolCalls,
      citations: []
    });

  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { error: 'Test execution failed' },
      { status: 500 }
    );
  }
}