import { NextRequest } from 'next/server';
import { loadIndex } from '@/lib/index';
import { runAgent } from '@/lib/agent';

export async function POST(req: NextRequest) {
  const { messages, systemPrompt, toolDescriptions } = await req.json();
  const index = loadIndex();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const result = await runAgent({
          messages,
          index,
          systemPromptOverride: systemPrompt,
          toolDescriptionsOverride: toolDescriptions,
          callbacks: {
            onToolStart(tool, data) {
              sendEvent({ type: 'tool_start', tool, data });
            },
            onToolComplete(tool, data) {
              sendEvent({ type: 'tool_complete', tool, data });
            },
          },
        });

        const content = result.message || '';
        const words = content.split(' ');
        let accumulated = '';
        for (let i = 0; i < words.length; i++) {
          accumulated += (i > 0 ? ' ' : '') + words[i];
          sendEvent({ type: 'message_chunk', content: accumulated });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        sendEvent({ type: 'message_complete', content });

        sendEvent({ type: 'done', citations: result.citations, toolCalls: result.toolCalls });
      } catch (error) {
        console.error('Test stream error:', error);
        sendEvent({ type: 'error', message: 'An error occurred' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}


