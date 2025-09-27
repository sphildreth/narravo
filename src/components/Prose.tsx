// SPDX-License-Identifier: Apache-2.0

/**
 * components/Prose.tsx
 * Lightweight HTML renderer with a consistent typographic wrapper and syntax highlighting.
 */
import React, { ReactNode, useMemo } from "react";
import CodeBlock from "./CodeBlock";
import MermaidDiagram from "./MermaidDiagram";

const MERMAID_KEYWORDS = new Set(
  [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "statediagram",
    "statediagram-v2",
    "erdiagram",
    "journey",
    "gantt",
    "pie",
    "gitgraph",
    "mindmap",
    "timeline",
    "quadrantchart",
    "requirementdiagram",
  ].map(keyword => keyword.toLowerCase())
);

const decodeHtmlEntities = (input: unknown): string => {
  if (input === null || input === undefined) {
    return "";
  }

  const value = typeof input === "string" ? input : String(input);

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    // Handle URL-encoded entities that might appear in attributes
    .replace(/%3C/gi, "<")
    .replace(/%3E/gi, ">")
    .replace(/%22/gi, '"')
    .replace(/%27/gi, "'")
    .replace(/%26/gi, "&")
    .replace(/%0A/gi, "\n")
    .replace(/%0D/gi, "\r");
};

const looksLikeMermaid = (input: unknown): boolean => {
  if (input === null || input === undefined) {
    return false;
  }

  const value = typeof input === "string" ? input : String(input);

  const trimmed = value.trim();
  if (!trimmed) return false;

  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith("%%")) {
      continue;
    }

    const token = candidate.split(/\s+/)[0]?.toLowerCase() ?? "";
    if (!token) continue;

    if (MERMAID_KEYWORDS.has(token)) {
      return true;
    }

    if (token.startsWith("sequencediagram")) return true;
    if (token.startsWith("statediagram")) return true;
    if (token.startsWith("erdiagram")) return true;
    if (token.startsWith("gitgraph")) return true;
    if (token.startsWith("quadrantchart")) return true;
    if (token.startsWith("requirementdiagram")) return true;
  }

  return false;
};

export default function Prose({ html, className = "" }: { html: string; className?: string }) {
  const nodes = useMemo<ReactNode[]>(() => {
    if (!html) return [];

    // First pass: split out mermaid <div data-mermaid> blocks OR <pre><code class~="mermaid"> blocks
    const mermaidSplit = html.split(/(<div[^>]*?data-mermaid[^>]*?>[\s\S]*?<\/div>|<pre[^>]*?>[\s\S]*?<\/pre>)/gi);
    const out: ReactNode[] = [];

    mermaidSplit.forEach((segment, segIndex) => {
      if (!segment) return;

      // data-mermaid variant - handle HTML attribute content properly
      const mermaidDiv = segment.match(/^<div[^>]*?\sdata-mermaid=["']([^"']*?)["'][^>]*?>([\s\S]*?)<\/div>$/i);
      if (mermaidDiv) {
        let chart = mermaidDiv[1] || '';
        // Handle common HTML attribute encoding issues
        chart = decodeHtmlEntities(chart)
          .replace(/&#10;/g, '\n')      // Line feed
          .replace(/&#13;/g, '\r')      // Carriage return  
          .replace(/&#9;/g, '\t')       // Tab
          .replace(/&NewLine;/g, '\n'); // Named entity for newline
        out.push(<MermaidDiagram key={`mermaid-div-${segIndex}`} chart={chart} className="my-6" />);
        return;
      }

      // code fence variant containing mermaid language (treat entire pre as mermaid if inner code matches)
      const mermaidPre = segment.match(/^<pre[^>]*?>\s*<code[^>]*?(?:class=["'][^"']*?mermaid[^"']*?["']|data-lang=["']mermaid["'])[^>]*?>([\s\S]*?)<\/code>\s*<\/pre>$/i);
      if (mermaidPre) {
        const raw = mermaidPre[1] || '';
        const decoded = decodeHtmlEntities(raw);
        out.push(<MermaidDiagram key={`mermaid-pre-${segIndex}`} chart={decoded} className="my-6" />);
        return;
      }

      // For other segments, we still need to further split out code blocks for syntax highlighting
      const codeSplit = segment.split(/(<pre[^>]*?>[\s\S]*?<\/pre>)/gi);
      codeSplit.forEach((part, partIndex) => {
        if (!part) return;
        const preMatch = part.match(/^<pre([^>]*?)>([\s\S]*?)<\/pre>$/i);
        if (preMatch) {
          const attributes = preMatch[1] || '';
            const content = preMatch[2] || '';
            const classMatch = attributes.match(/class=["']([^"']*?)["']/i);
            const langMatch = attributes.match(/data-lang=["']([^"']*?)["']/i);
            const cls: string = classMatch?.[1] ?? '';
          const language = langMatch ? langMatch[1] : '';
          const classList = cls.split(/\s+/).filter(Boolean).map(token => token.toLowerCase());
          const hasMermaidClass = classList.some(token => token === 'mermaid' || token.endsWith('-mermaid'));
          const hasMermaidLang = (language || '').toLowerCase() === 'mermaid';
          const decoded = decodeHtmlEntities(content);
          if (hasMermaidClass || hasMermaidLang || looksLikeMermaid(decoded)) {
            out.push(
              <MermaidDiagram
                key={`mermaid-pre-${segIndex}-${partIndex}`}
                chart={decoded}
                className="my-6"
              />
            );
            return;
          }
          const isCodeBlock = classList.some(token => /^(?:prism|language|lang|hljs)/i.test(token));
          if (isCodeBlock && cls) {
            out.push(
              <CodeBlock
                key={`code-${segIndex}-${partIndex}`}
                className={cls}
                language={language}
                showLineNumbers={cls.includes('numbers')}
              >
                {decoded}
              </CodeBlock>
            );
            return;
          }
          // Non-highlighted pre: render raw
          out.push(<div key={`rawpre-${segIndex}-${partIndex}`} dangerouslySetInnerHTML={{ __html: part }} />);
          return;
        }
        // Plain HTML fragment
        out.push(<div key={`frag-${segIndex}-${partIndex}`} dangerouslySetInnerHTML={{ __html: part }} />);
      });
    });

    return out;
  }, [html]);

  return (
    <div className={[
      'prose prose-neutral dark:prose-invert max-w-none',
      '[&_pre]:!p-0 [&_pre]:!bg-transparent [&_pre]:!border-none [&_pre]:!rounded-none',
      className
    ].filter(Boolean).join(' ')}>
      {nodes}
    </div>
  );
}
