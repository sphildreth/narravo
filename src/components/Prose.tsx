// SPDX-License-Identifier: Apache-2.0

/**
 * components/Prose.tsx
 * Lightweight HTML renderer with a consistent typographic wrapper and syntax highlighting.
 */
import React from "react";
import CodeBlock from "./CodeBlock";

export default function Prose({ html, className = "" }: { html: string; className?: string }) {
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
      {processCodeBlocks(html || "")}
    </div>
  );
}
