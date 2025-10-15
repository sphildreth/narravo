// SPDX-License-Identifier: Apache-2.0

/**
 * components/Prose.tsx
 * Lightweight HTML renderer with a consistent typographic wrapper and syntax highlighting.
 */
import React, { ReactNode, useMemo } from "react";
import CodeBlock from "./CodeBlock";
import MermaidDiagram from "./MermaidDiagram";
import { ImageWithLightbox } from "./ImageLightbox";

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
          // Non-highlighted pre: process for images
          const partWithImages = processImagesInSegment(part, `rawpre-${segIndex}-${partIndex}`);
          out.push(...partWithImages);
          return;
        }
        // Plain HTML fragment - process for images
        const partWithImages = processImagesInSegment(part, `frag-${segIndex}-${partIndex}`);
        out.push(...partWithImages);
      });
    });

    return out;
  }, [html]);

  // Helper function to extract and replace images with lightbox component
  function processImagesInSegment(htmlSegment: string, baseKey: string): ReactNode[] {
    const imageRegex = /<img\s+([^>]*?)>/gi;
    const result: ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let imageIndex = 0;

    while ((match = imageRegex.exec(htmlSegment)) !== null) {
      // Add HTML before this image
      if (match.index > lastIndex) {
        const beforeHtml = htmlSegment.slice(lastIndex, match.index);
        if (beforeHtml.trim()) {
          result.push(<div key={`${baseKey}-html-${imageIndex}`} dangerouslySetInnerHTML={{ __html: beforeHtml }} />);
        }
      }

      // Parse image attributes
      const attrs: Record<string, string> = {};
      const attrRegex = /(\w+(?:-\w+)*)=["']([^"']*?)["']/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(match[1] || '')) !== null) {
        attrs[attrMatch[1]!] = attrMatch[2]!;
      }

      const { src, alt, style, class: imgClassName, 'data-width': dataWidth, 'data-align': dataAlign } = attrs;
      
      // Parse inline style
      let styleObj: React.CSSProperties | undefined = undefined;
      if (style) {
        styleObj = {};
        const styleProps = style.split(';').filter(Boolean);
        styleProps.forEach(prop => {
          const [key, value] = prop.split(':').map(s => s.trim());
          if (key && value) {
            const camelKey = key.replace(/-([a-z])/g, (g) => g[1]!.toUpperCase());
            (styleObj as any)[camelKey] = value;
          }
        });
      } else if (dataWidth) {
        styleObj = { width: dataWidth };
      }

      // Build className with alignment
      let finalClassName = imgClassName || '';
      if (dataAlign && !finalClassName.includes('img-align-')) {
        finalClassName = `${finalClassName} img-align-${dataAlign}`.trim();
      }

      result.push(
        <ImageWithLightbox
          key={`${baseKey}-img-${imageIndex}`}
          src={src || ''}
          alt={alt || undefined}
          className={finalClassName || undefined}
          style={styleObj}
        />
      );

      lastIndex = match.index + match[0]!.length;
      imageIndex++;
    }

    // Add remaining HTML after last image
    if (lastIndex < htmlSegment.length) {
      const remainingHtml = htmlSegment.slice(lastIndex);
      if (remainingHtml.trim()) {
        result.push(<div key={`${baseKey}-html-end`} dangerouslySetInnerHTML={{ __html: remainingHtml }} />);
      }
    }

    // If no images found, return original HTML
    if (result.length === 0) {
      return [<div key={baseKey} dangerouslySetInnerHTML={{ __html: htmlSegment }} />];
    }

    return result;
  }

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
