'use client';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ActiveTool = {
  type: 'search' | 'read';
  status: 'running' | 'complete';
  query?: string;
  ids?: string[];
  lineOffset?: number;
  lineCount?: number;
  results?: any;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  tools?: ActiveTool[];
  citations?: any[];
};

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    endRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, activeTool]);

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setActiveTool(null);

    const assistantMsg: Message = { 
      role: 'assistant', 
      content: '',
      tools: [],
      citations: []
    };
    
    setMessages(prev => [...prev, assistantMsg]);
    const msgIndex = messages.length + 1;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const update = JSON.parse(line.slice(6));
              
              switch (update.type) {
                case 'tool_start':
                  const newTool: ActiveTool = {
                    type: update.tool as 'search' | 'read',
                    status: 'running',
                    query: update.data.query,
                    ids: update.data.ids,
                    lineOffset: update.data.lineOffset,
                    lineCount: update.data.lineCount
                  };
                  setActiveTool(newTool);
                  break;
                  
                case 'tool_complete':
                  const completedTool: ActiveTool = {
                    type: update.tool as 'search' | 'read',
                    status: 'complete',
                    query: update.data.query,
                    results: update.data
                  };
                  setActiveTool(null);
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const msg = newMessages[msgIndex];
                    if (msg && msg.tools) {
                      // Check if this exact tool hasn't been added already
                      const exists = msg.tools.some(t => 
                        t.type === completedTool.type && 
                        t.query === completedTool.query &&
                        JSON.stringify(t.results) === JSON.stringify(completedTool.results)
                      );
                      if (!exists) {
                        msg.tools.push(completedTool);
                      }
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'message_chunk':
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const msg = newMessages[msgIndex];
                    if (msg) {
                      msg.content = update.content;
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'message_complete':
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const msg = newMessages[msgIndex];
                    if (msg) {
                      msg.content = update.content;
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'done':
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const msg = newMessages[msgIndex];
                    if (msg) {
                      msg.citations = update.citations;
                    }
                    return newMessages;
                  });
                  break;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        const msg = newMessages[msgIndex];
        if (msg) {
          msg.content = 'Sorry, something went wrong. Please try again.';
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
      setActiveTool(null);
    }
  }

  function toggleTool(id: string) {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTools(newExpanded);
  }

  function toggleCitation(id: string) {
    const newExpanded = new Set(expandedCitations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCitations(newExpanded);
  }

  function renderTool(tool: ActiveTool, index: string) {
    const isExpanded = expandedTools.has(index);
    const isRunning = tool.status === 'running';
    
    return (
      <div key={index} className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <button
          onClick={() => !isRunning && toggleTool(index)}
          disabled={isRunning}
          className={`w-full px-3 py-2 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 ${
            isRunning ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
          } transition-colors`}
        >
          <span className="inline-flex items-center gap-2">
            {isRunning && (
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {tool.type === 'search' && (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>{isRunning ? 'Searching' : 'Searched'} for: "{tool.query}"</span>
                {tool.results?.results && (
                  <span className="text-neutral-500">• Found {tool.results.results.length} results</span>
                )}
              </>
            )}
            {tool.type === 'read' && (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{isRunning ? 'Reading' : 'Read'} documents</span>
                {tool.lineOffset !== undefined && tool.lineCount && (
                  <span className="text-neutral-500">• Lines {tool.lineOffset + 1}-{tool.lineOffset + tool.lineCount}</span>
                )}
              </>
            )}
          </span>
          {!isRunning && (
            <svg 
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
        
        {isExpanded && tool.status === 'complete' && tool.type === 'search' && tool.results?.results && (
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
            <div className="space-y-2">
              {tool.results.results.map((result: any, ri: number) => (
                <div key={ri} className="text-xs">
                  <div className="font-medium text-neutral-700 dark:text-neutral-300">
                    {ri + 1}. {result.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate">
                    {result.url}
                  </div>
                  {result.matches && result.matches.length > 0 && (
                    <div className="mt-1 pl-3 border-l-2 border-neutral-300 dark:border-neutral-600">
                      {result.matches.map((match: any, mi: number) => (
                        <div key={mi} className="text-[10px] text-neutral-600 dark:text-neutral-400 italic">
                          "...{match.context.slice(0, 150)}..."
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isExpanded && tool.status === 'complete' && tool.type === 'read' && tool.results?.documents && (
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
            <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              {tool.results.documents.map((doc: any, di: number) => (
                <div key={di}>
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-[10px]">Read {doc.linesRead}</div>
                  {doc.hasMore && (
                    <div className="text-[10px] text-blue-600 mt-1">
                      More lines available - AI can read more if needed
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMessage(message: Message, index: number) {
    const showMessageBubble = message.role === 'user' || message.content || (message.citations && message.citations.length > 0);
    
    return (
      <div key={index} className="space-y-2">
        {message.tools && message.tools.length > 0 && (
          <div className="space-y-1">
            {message.tools.map((tool, i) => renderTool(tool, `${index}-${i}`))}
          </div>
        )}
        
        {showMessageBubble && (
          <div className={message.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              message.role === 'user' 
                ? 'bg-neutral-200 dark:bg-neutral-800' 
                : 'bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800'
            }`}>
              {message.role === 'assistant' ? (
                <div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
                
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-neutral-200 dark:border-neutral-700 pt-2">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Sources used:
                    </div>
                    {message.citations.map((citation: any) => (
                      <div key={citation.id} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-2">
                        <button
                          onClick={() => toggleCitation(citation.id)}
                          className="flex items-center justify-between w-full text-left"
                        >
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            {citation.title}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {expandedCitations.has(citation.id) ? '▼' : '▶'}
                          </span>
                        </button>
                        
                        {expandedCitations.has(citation.id) && (
                          <div className="mt-2 space-y-1">
                            <a 
                              href={citation.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline block"
                            >
                              {citation.url}
                            </a>
                            <pre className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 p-2 rounded">
                              {citation.content}...
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              message.content
            )}
          </div>
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <h2 className="text-lg font-semibold mb-2">California Government Resources Assistant</h2>
            <p className="text-sm text-neutral-500 max-w-2xl mx-auto">
              I can help you with: emergency alerts signup, unemployment filing, LA County hazardous tree removal waiver, 
              South Coast air quality map, or replacing naturalization/citizenship documents.
            </p>
            <p className="text-xs text-neutral-400 mt-2">
              I'll show you in real-time as I search and read documents to find your answer.
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          {messages.map((m, i) => renderMessage(m, i))}
          
          {activeTool && (
            <div className="space-y-1">
              {renderTool(activeTool, 'active')}
            </div>
          )}
          
          {loading && !activeTool && messages[messages.length - 1]?.role === 'user' && (
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
        
        <form onSubmit={onSend} className="mt-4 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="Ask a question about the California resources..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button 
            type="submit"
            disabled={loading || !input.trim()} 
            className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}