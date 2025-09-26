// SPDX-License-Identifier: Apache-2.0

/**
 * components/Prose.tsx
 * Lightweight HTML renderer with a consistent typographic wrapper and syntax highlighting.
 */
import React from "react";
import CodeBlock from "./CodeBlock";
import MermaidDiagram from "./MermaidDiagram";

export default function Prose({ html, className = "" }: { html: string; className?: string }) {
  // Process Mermaid diagrams first (before code blocks)
  const processMermaidDiagrams = (htmlContent: string) => {
    // Look for Mermaid diagram blocks marked with data-mermaid attribute
    const parts = htmlContent.split(/(<div[^>]*?data-mermaid[^>]*?>[\s\S]*?<\/div>)/gi);
    
    return parts.map((part, index) => {
      // Check if this part is a mermaid diagram
      const mermaidMatch = part.match(/^<div[^>]*?data-mermaid=["']([^"']*?)["'][^>]*?>([\s\S]*?)<\/div>$/i);
      
      if (mermaidMatch) {
        const mermaidContent = mermaidMatch[1] || '';
        
        return (
          <MermaidDiagram
            key={`mermaid-${index}`}
            chart={mermaidContent}
            className="my-6"
          />
        );
      }
      
      // Also look for code blocks with class="mermaid" or language="mermaid"
      const codeMatch = part.match(/^<pre[^>]*?><code[^>]*?(?:class=["'][^"']*?mermaid[^"']*?["']|data-lang=["']mermaid["'])[^>]*?>([\s\S]*?)<\/code><\/pre>$/i);
      
      if (codeMatch) {
        const mermaidContent = (codeMatch[1] || '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        return (
          <MermaidDiagram
            key={`mermaid-code-${index}`}
            chart={mermaidContent}
            className="my-6"
          />
        );
      }
      
      return part;
    }).join('');
  };
  // Parse HTML and replace pre tags with CodeBlock components
  const processCodeBlocks = (htmlContent: string) => {
    // Split by pre tags to handle code blocks
    const parts = htmlContent.split(/(<pre[^>]*>[\s\S]*?<\/pre>)/gi);
    
    return parts.map((part, index) => {
      // Check if this part is a pre tag
      const preMatch = part.match(/^<pre([^>]*?)>([\s\S]*?)<\/pre>$/i);
      
      if (preMatch) {
        // Extract attributes and content
        const attributes = preMatch[1] || '';
        const content = preMatch[2] || '';
        
        // Extract class and data-lang attributes
        const classMatch = attributes.match(/class=["']([^"']*?)["']/i);
        const langMatch = attributes.match(/data-lang=["']([^"']*?)["']/i);
        
        const className = classMatch ? classMatch[1] : '';
        const language = langMatch ? langMatch[1] : '';
        
        // Check if it looks like code (has prism or language classes)
        const isCodeBlock = className && /(?:prism|language|lang|hljs)/i.test(className);
        
        if (isCodeBlock) {
          // Decode HTML entities in content
          const decodedContent = content
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
          
          return (
            <CodeBlock
              key={index}
              className={className}
              language={language}
              showLineNumbers={className.includes('numbers')}
            >
              {decodedContent}
            </CodeBlock>
          );
        }
      }
      
      // For non-code blocks, render as-is with dangerouslySetInnerHTML
      return (
        <div
          key={index}
          dangerouslySetInnerHTML={{ __html: part }}
        />
      );
    });
  };

  return (
    <div className={[
      "prose prose-neutral dark:prose-invert max-w-none",
      // Override pre styles for better syntax highlighting
      "[&_pre]:!p-0 [&_pre]:!bg-transparent [&_pre]:!border-none [&_pre]:!rounded-none",
      className
    ].filter(Boolean).join(" ")}>
      {processCodeBlocks(processMermaidDiagrams(html || ""))}
    </div>
  );
}
