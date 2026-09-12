// SPDX-License-Identifier: Apache-2.0
"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  children: string;
  className?: string | undefined;
  language?: string | undefined;
  showLineNumbers?: boolean;
}

/**
 * The active theme lives on `<html data-theme>` and ThemeToggle changes it in place,
 * without a navigation, so the highlighter palette has to follow that attribute
 * instead of sampling it once on mount. useSyncExternalStore keeps the read out of
 * render and re-renders on attribute or OS-preference changes.
 */
function isDarkTheme(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  // No explicit choice recorded: fall back to the OS preference.
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  media?.addEventListener("change", onStoreChange);
  return () => {
    observer.disconnect();
    media?.removeEventListener("change", onStoreChange);
  };
}

export default function CodeBlock({ 
  children, 
  className = "", 
  language = "", 
  showLineNumbers = false 
}: CodeBlockProps) {
  // Server output always uses the light palette; the client store takes over at hydration.
  const isDark = React.useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);
  
  // Extract language from className if provided (e.g., "lang-javascript" or "language-javascript")
  const detectedLanguage = language || 
    className?.match(/(?:lang|language)-(\w+)/)?.[1] ||
    className?.match(/prism.*?lang-(\w+)/)?.[1] ||
    "text";

  // Normalize language names to what Prism supports
  const normalizeLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      bash: "bash",
      shell: "bash", 
      sh: "bash",
      javascript: "javascript",
      js: "javascript",
      typescript: "typescript",
      ts: "typescript",
      python: "python",
      py: "python",
      sql: "sql",
      json: "json",
      html: "html",
      css: "css",
      jsx: "jsx",
      tsx: "tsx",
      markdown: "markdown",
      md: "markdown",
      yaml: "yaml",
      yml: "yaml",
      xml: "xml",
      php: "php",
      java: "java",
      c: "c",
      cpp: "cpp",
      "c++": "cpp",
      csharp: "csharp",
      "c#": "csharp",
      go: "go",
      rust: "rust",
      ruby: "ruby",
      rb: "ruby",
      powershell: "powershell",
      ps1: "powershell",
    };
    
    return langMap[lang.toLowerCase()] || lang.toLowerCase();
  };

  const normalizedLanguage = normalizeLanguage(detectedLanguage);
  const codeStyle = isDark ? vscDarkPlus : vs;

  return (
    <div className="relative">
      {/* Language label */}
      {normalizedLanguage !== "text" && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/20 text-white text-xs rounded z-10">
          {detectedLanguage.toUpperCase()}
        </div>
      )}
      
      <SyntaxHighlighter
        language={normalizedLanguage}
        style={codeStyle}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
          lineHeight: "1.5",
        }}
        codeTagProps={{
          style: {
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
          }
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}