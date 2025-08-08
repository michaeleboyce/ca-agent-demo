"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

type Citation = {
  id: string;
  title: string;
  url: string;
  content: string;
};

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  expandedCitations: Set<string>;
  toggleCitation: (id: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
};

export function MessageBubble({ role, content, citations, expandedCitations, toggleCitation }: MessageBubbleProps) {
  const isAssistant = role === "assistant";
  const contentWithMarkers = (() => {
    if (!isAssistant || !citations || citations.length === 0) return content;
    const markers = citations.map((c, i) => `<sup class=\"inline-citation\" data-cite-id=\"${c.id}\">[${i + 1}]</sup>`);

    // Insert markers at sentence boundaries where possible; append remaining at the end.
    const sentenceEndRegex = /([.!?])(\s|$)/g;
    const insertionPoints: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = sentenceEndRegex.exec(content)) !== null && insertionPoints.length < markers.length) {
      // Insert after the punctuation mark (match[1])
      const afterPunctuationIndex = match.index + match[1].length;
      insertionPoints.push(afterPunctuationIndex);
    }

    if (insertionPoints.length === 0) {
      const spacer = content.endsWith("\n") || content.endsWith(" ") ? "" : " ";
      return `${content}${spacer}${markers.join(" ")}`;
    }

    let output = "";
    let lastIndex = 0;
    for (let i = 0; i < insertionPoints.length; i++) {
      const insertAt = insertionPoints[i];
      output += content.slice(lastIndex, insertAt) + markers[i];
      lastIndex = insertAt;
    }
    output += content.slice(lastIndex);

    if (insertionPoints.length < markers.length) {
      const remaining = markers.slice(insertionPoints.length).join(" ");
      const spacer = output.endsWith("\n") || output.endsWith(" ") ? "" : " ";
      output += `${spacer}${remaining}`;
    }
    return output;
  })();

  const citationMap = new Map<string, Citation>();
  citations?.forEach((c) => citationMap.set(c.id, c));

  const CitationSup = (props: any) => {
    // ReactMarkdown passes HTML attributes in different ways depending on the plugin
    // Check multiple possible locations for the data-cite-id attribute
    const citeId = props?.["data-cite-id"] || 
                   props?.dataCiteId || 
                   props?.node?.properties?.["data-cite-id"] ||
                   props?.node?.properties?.dataCiteId ||
                   (props?.className === "inline-citation" && props?.children?.[0] && 
                    typeof props.children[0] === "string" && 
                    props.children[0].match(/\[(\d+)\]/) ? 
                    citations?.[parseInt(props.children[0].match(/\[(\d+)\]/)?.[1] || "0") - 1]?.id : 
                    undefined);
    
    const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (citeId) toggleCitation(citeId);
    };
    
    if (!citeId) {
      // If we can't find the citation ID, just render the sup without interaction
      return <sup className="inline-citation">{props?.children as React.ReactNode}</sup>;
    }
    
    return (
      <sup
        data-cite-id={citeId}
        className="inline-citation cursor-pointer text-civic-blue-700 dark:text-civic-blue-400 underline decoration-dotted"
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleToggle(e);
        }}
        title={citationMap.get(citeId)?.title}
      >
        {props?.children as React.ReactNode}
      </sup>
    );
  };

  const ParagraphWithCitations = ({ node, children, ...pProps }: any) => {
    const supIds: string[] = [];
    const collect = (nodes: any) => {
      React.Children.forEach(nodes, (child: any) => {
        if (!React.isValidElement(child)) return;
        // Detect our custom CitationSup component
        const isCitationSup = child.type === (CitationSup as any) || (child as any).props?.node?.tagName === 'sup';
        if (isCitationSup) {
          const props: any = (child as any).props || {};
          const nodeProps: any = props.node?.properties || {};
          const dataId: string | undefined = props['data-cite-id'] || props.dataCiteId || nodeProps['data-cite-id'] || nodeProps.dataCiteId;
          if (dataId) {
            supIds.push(String(dataId));
          } else {
            // Fallback: parse [n]
            const rawChildren = props.children;
            const text = Array.isArray(rawChildren)
              ? rawChildren.map((n: any) => (typeof n === 'string' ? n : '')).join('')
              : String(rawChildren ?? '');
            const m = text.match(/\[(\d+)\]/);
            if (m && citations) {
              const idx = parseInt(m[1], 10) - 1;
              if (citations[idx]) supIds.push(citations[idx].id);
            }
          }
        }
        if ((child as any).props?.children) collect((child as any).props.children);
      });
    };
    collect(children);

    return (
      <>
        <p {...pProps}>{children}</p>
        {supIds.map((id) => {
          if (!expandedCitations.has(id)) return null;
          const c = citationMap.get(id);
          if (!c) return null;
          const idx = (citations?.findIndex((x) => x.id === id) ?? 0) + 1;
          return (
            <div key={`${id}-details`} className="mt-2 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 will-change-transform">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-civic-blue-600 hover:underline"
                >
                  [{idx}] {c.title}
                </a>
                <button
                  onClick={() => toggleCitation(id)}
                  className="text-[11px] text-neutral-500 hover:underline"
                  aria-label={`Collapse citation ${idx}`}
                >
                  Hide
                </button>
              </div>
              <pre className="mt-2 text-[11px] text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 p-2 rounded">{c.content}...</pre>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className={role === "user" ? "text-right" : ""}>
      <div
        className={`inline-block max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
          role === "user"
            ? "bg-civic-blue-600 text-white dark:bg-civic-blue-500"
            : "bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
        }`}
      >
        {isAssistant ? (
          <div>
            <div className="prose prose-sm dark:prose-invert max-w-none [scroll-margin-top:64px]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{ p: ParagraphWithCitations as any, sup: CitationSup as any }}
              >
                {contentWithMarkers}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}


