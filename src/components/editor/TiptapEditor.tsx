"use client";
// SPDX-License-Identifier: Apache-2.0

import React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Markdown } from "tiptap-markdown";
import { createLowlight } from "lowlight";
import { MarkdownShortcodes } from './extensions/MarkdownShortcodes';
import { VideoShortcode } from './extensions/VideoShortcode';
import { MermaidNode } from './extensions/MermaidNode';
import 'highlight.js/styles/atom-one-dark.css';

// Create lowlight instance (only really used outside tests)
const lowlight = createLowlight();
import DOMPurify from "dompurify";
import { expandShortcodes } from "@/lib/markdown";
import { cn } from "@/lib/utils";

// Language loading for code blocks
const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'tsx', 'jsx', 'bash', 'shell',
  'json', 'yaml', 'python', 'go', 'rust', 'csharp', 'html',
  'css', 'sql', 'markdown', 'java', 'php', 'ruby'
] as const;

const loadLanguage = async (lang: string) => {
  try {
    switch (lang) {
      case 'typescript':
      case 'tsx':
        const ts = await import('highlight.js/lib/languages/typescript' as any);
        lowlight.register('typescript', ts.default);
        lowlight.register('tsx', ts.default);
        break;
      case 'javascript':
      case 'jsx':
        const js = await import('highlight.js/lib/languages/javascript' as any);
        lowlight.register('javascript', js.default);
        lowlight.register('jsx', js.default);
        break;
      case 'bash':
      case 'shell':
        const bash = await import('highlight.js/lib/languages/bash' as any);
        lowlight.register('bash', bash.default);
        lowlight.register('shell', bash.default);
        break;
      case 'json':
        const json = await import('highlight.js/lib/languages/json' as any);
        lowlight.register('json', json.default);
        break;
      case 'yaml':
        const yaml = await import('highlight.js/lib/languages/yaml' as any);
        lowlight.register('yaml', yaml.default);
        break;
      case 'python':
        const python = await import('highlight.js/lib/languages/python' as any);
        lowlight.register('python', python.default);
        break;
      case 'go':
        const go = await import('highlight.js/lib/languages/go' as any);
        lowlight.register('go', go.default);
        break;
      case 'rust':
        const rust = await import('highlight.js/lib/languages/rust' as any);
        lowlight.register('rust', rust.default);
        break;
      case 'csharp':
        const csharp = await import('highlight.js/lib/languages/csharp' as any);
        lowlight.register('csharp', csharp.default);
        break;
      case 'html':
        const html = await import('highlight.js/lib/languages/xml' as any);
        lowlight.register('html', html.default);
        break;
      case 'css':
        const css = await import('highlight.js/lib/languages/css' as any);
        lowlight.register('css', css.default);
        break;
      case 'sql':
        const sql = await import('highlight.js/lib/languages/sql' as any);
        lowlight.register('sql', sql.default);
        break;
      case 'markdown':
        const md = await import('highlight.js/lib/languages/markdown' as any);
        lowlight.register('markdown', md.default);
        break;
      case 'java':
        const java = await import('highlight.js/lib/languages/java' as any);
        lowlight.register('java', java.default);
        break;
      case 'php':
        const php = await import('highlight.js/lib/languages/php' as any);
        lowlight.register('php', php.default);
        break;
      case 'ruby':
        const ruby = await import('highlight.js/lib/languages/ruby' as any);
        lowlight.register('ruby', ruby.default);
        break;
    }
  } catch (err) {
    // Language loading failed, continue with plain text
  }
};

// Extended Image node with alignment and caption
const AlignedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'left',
        renderHTML: attributes => ({
          class: `img-align-${attributes.align}`,
        }),
      },
      width: {
        default: null,
        renderHTML: attributes => ({
          style: attributes.width ? `width: ${attributes.width}` : null,
        }),
      },
      title: {
        default: null,
      },
      caption: {
        default: null,
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const { align = 'left', caption, ...imgAttrs } = HTMLAttributes;
    const figureAttrs = { class: `align-${align}` };
    
    if (caption) {
      return ['figure', figureAttrs, ['img', imgAttrs], ['figcaption', 0, caption]];
    }
    
    return ['figure', figureAttrs, ['img', imgAttrs]];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImageAlign: (align: 'left' | 'center' | 'right') => ({ commands }: any) => {
        return commands.updateAttributes(this.name, { align });
      },
      setImageWidth: (width: string) => ({ commands }: any) => {
        return commands.updateAttributes(this.name, { width });
      },
      setImageCaption: (caption: string) => ({ commands }: any) => {
        return commands.updateAttributes(this.name, { caption });
      },
    };
  },
});

export type TiptapEditorProps = {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  className?: string;
};

// Helper functions for Markdown round-trip
export const fromMarkdown = async (markdown: string, editor?: Editor) => {
  if (!editor) return;
  
  // Pre-load languages that appear in code blocks
  if (typeof window !== 'undefined') {
    const codeBlockRegex = /```(\w+)/g;
    let match;
    const languagesToLoad = new Set<string>();
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const lang = match[1]?.toLowerCase();
      if (lang && SUPPORTED_LANGUAGES.includes(lang as any)) {
        languagesToLoad.add(lang);
      }
    }
    
    // Load all languages found and wait for completion
    if (languagesToLoad.size > 0) {
      await Promise.all([...languagesToLoad].map(lang => loadLanguage(lang)));
    }
  }
  
  // Expand shortcodes (like video) in the markdown before processing
  const expandedMarkdown = expandShortcodes(markdown);
  const previewReadyMarkdown = expandedMarkdown.replace(/<video(?![^>]*data-shortcode-preview)/g, '<video data-shortcode-preview="true"');
  
  console.log('fromMarkdown processing:', {
    originalMarkdown: markdown,
    expandedMarkdown,
    previewReadyMarkdown
  });
  
  // Check if we have HTML (expanded shortcodes) vs plain markdown
  const hasHTML = expandedMarkdown !== markdown && expandedMarkdown.includes('<');
  
  console.log('🔄 [TiptapEditor] Content analysis:', {
    hasHTML,
    hasMermaidBlocks: /```mermaid/gi.test(previewReadyMarkdown),
    mermaidBlockCount: (previewReadyMarkdown.match(/```mermaid/gi) || []).length,
    markdownLength: markdown.length,
    expandedLength: expandedMarkdown.length
  });
  
  try {
    if (hasHTML) {
      console.log('🔄 [TiptapEditor] Setting expanded HTML content');
      editor.commands.setContent(previewReadyMarkdown);
    } else {
      const mdStorage = (editor.storage as any)?.markdown;
      const parser = mdStorage?.parser;
      if (parser) {
        console.log('🔄 [TiptapEditor] Parsing markdown with tiptap-markdown parser');
        console.log('🔄 [TiptapEditor] Content being parsed:', previewReadyMarkdown.substring(0, 300) + '...');
        const doc = parser.parse(previewReadyMarkdown);
        console.log('🔄 [TiptapEditor] Parsed document structure:', {
          nodeType: doc.type?.name,
          childCount: doc.childCount,
          content: doc.content?.content?.map((child: any) => ({
            type: child.type?.name,
            attrs: child.attrs,
            textContent: child.textContent?.substring(0, 100) + '...'
          }))
        });
        editor.commands.setContent(doc as any);
      } else {
        console.log('🔄 [TiptapEditor] Markdown parser missing, inserting raw markdown as preformatted fallback');
        const escaped = previewReadyMarkdown
          .replace(/&/g, '&amp;')
          .replace(/</g, '&gt;');
        editor.commands.setContent(`<pre>${escaped}</pre>`);
      }
    }
  } catch (err) {
    console.error('fromMarkdown failed, fallback to pre block', err);
    const escaped = previewReadyMarkdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    editor.commands.setContent(`<pre>${escaped}</pre>`);
  }
  
  // Force a reparse with a small delay to ensure content is set first
  setTimeout(() => {
    console.log('🔄 [TiptapEditor] Running delayed operations after content set');
    reparseLowlight(editor);
    // Note: convertMermaidCodeBlocks is removed - the auto-conversion plugin in MermaidNode.ts handles this
  }, 100);
};

const reparseLowlight = (editor: Editor) => {
  const { view, state } = editor;
  if (!view || !state) return;
  const transaction = state.tr.setMeta('lowlight', { reparse: true });
  view.dispatch(transaction);
};

let isConverting = false;

export const toMarkdown = (editor?: Editor): string => {
  if (!editor || isConverting) return '';
  
  try {
    isConverting = true;
    let markdown = (editor.storage as any)?.markdown?.getMarkdown?.() ?? '';

    if (typeof markdown === 'string' && markdown.length) {
      // Only clean up placeholder divs, don't touch video elements
      markdown = markdown
        .replace(/<div class="video-shortcode-placeholder"[\s\S]*?<\/div>/g, '');
    }

    return markdown;
  } catch (e) {
    return '';
  } finally {
    isConverting = false;
  }
};

export default function TiptapEditor({ initialMarkdown = "", onChange, placeholder = "Write your post...", className = "" }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const [showMarkdownView, setShowMarkdownView] = useState(false);
  const [markdownContent, setMarkdownContent] = useState(initialMarkdown);
  const [isToolbarSticky, setIsToolbarSticky] = useState(false);
  
  // Capture initialMarkdown only once to prevent reactive updates
  const stableInitialMarkdown = useRef(initialMarkdown);
  
  // Only update the stable ref if it's truly the first time (empty to non-empty)
  if (!stableInitialMarkdown.current && initialMarkdown) {
    stableInitialMarkdown.current = initialMarkdown;
  }

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
      if (!kind) return null;

      const signRes = await fetch("/api/r2/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          kind,
        }),
      });
      const signData = await signRes.json();
      if (!signRes.ok || signData?.error) {
        console.error("Failed to sign upload:", signData?.error || signRes.statusText);
        return null;
      }

      // Support PUT (presigned) and POST (form/mocked local) flows
      const method = (signData.method as string | undefined)?.toUpperCase() || "POST";
      let publicUrl: string | null = null;

      if (method === "PUT") {
        const headers: Record<string, string> = {};
        const fields = (signData.fields ?? {}) as Record<string, string>;
        if (fields["Content-Type"]) headers["Content-Type"] = fields["Content-Type"];
        const putRes = await fetch(signData.url as string, { method: "PUT", body: file, headers });
        if (!putRes.ok) {
          console.error("Upload failed", await safeReadText(putRes));
          return null;
        }
        publicUrl = (signData.publicUrl as string | undefined) || null;
        if (!publicUrl) {
          // Fallback best-effort: derive from key or strip query
          if (signData.key && typeof signData.url === "string") {
            const base = (signData.url as string).replace(/\?.*$/, "");
            publicUrl = `${base}/${signData.key}`;
          }
        }
      } else {
        // POST flow: either S3 POST policy (not used here) or local API that returns JSON { url }
        const formData = new FormData();
        const fields = (signData.fields ?? {}) as Record<string, string>;
        Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
        formData.append("file", file);
        const postRes = await fetch(signData.url as string, { method: "POST", body: formData });
        if (!postRes.ok) {
          console.error("Upload failed", await safeReadText(postRes));
          return null;
        }
        // Try to parse JSON response for local uploads
        try {
          const ct = postRes.headers.get("Content-Type") || "";
          if (ct.includes("application/json")) {
            const json = await postRes.json();
            publicUrl = json?.url || json?.publicUrl || null;
          }
        } catch {
          // ignore
        }
        if (!publicUrl) {
          publicUrl = (signData.publicUrl as string | undefined) || null;
          if (!publicUrl && signData.key && typeof signData.url === "string") {
            const base = (signData.url as string).replace(/\?.*$/, "");
            publicUrl = `${base}/${signData.key}`;
          }
        }
      }

      return publicUrl ?? null;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  }, []);

  // Small helper to safely read response text without throwing on body used/empty
  async function safeReadText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return res.statusText || "";
    }
  }

  const insertVideoShortcode = useCallback((editor: Editor, url: string) => {
    const shortcode = `[video mp4="${url}"][/video]`;
    editor.chain().focus().insertContent(shortcode).run();
    const sourcesPayload = encodeURIComponent(JSON.stringify([{ src: url, type: "video/mp4" }]));
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'videoShortcode',
        attrs: {
          src: url,
          sources: sourcesPayload,
        },
      })
      .run();
  }, []);

  const handleFileEvent = useCallback((view: Editor['view'], event: ClipboardEvent | DragEvent, editor: Editor) => {
    (async () => {
      const e = event as ClipboardEvent & DragEvent;
      const files: File[] = [];

      if (e.type === "paste") {
        const items = (e.clipboardData || (window as any).clipboardData)?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === "file") {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }
      } else if (e.type === "drop") {
        const dt = e.dataTransfer;
        if (dt?.files && dt.files.length > 0) {
          for (let i = 0; i < dt.files.length; i++) files.push(dt.files[i]!);
        }
      }

      if (files.length === 0) return false; // let default continue

      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      const videoFiles = files.filter(f => f.type.startsWith("video/"));

      if (imageFiles.length === 0 && videoFiles.length === 0) return false;

      e.preventDefault();

      for (const file of imageFiles) {
        const url = await uploadFile(file);
        if (url && editor) {
          editor.chain().focus().setImage({ src: url }).run();
        }
      }

      for (const file of videoFiles) {
        const url = await uploadFile(file);
        if (url && editor) {
          insertVideoShortcode(editor, url);
        }
      }

      return true;
    })();
  }, [uploadFile, insertVideoShortcode]);

  // Build base extensions list (may contain duplicates from third-party packages)
  const rawExtensions: any[] = [
    process.env.NODE_ENV === 'test'
      ? StarterKit.configure({ link: false as any, underline: false as any })
      : StarterKit.configure({ codeBlock: false, link: false as any, underline: false as any }),
    Markdown.configure({ 
      html: true, // Enable HTML parsing for shortcode expansion
      linkify: false,  // We handle links through the Link extension
      breaks: false,   // Use default line break handling
      transformCopiedText: false,
      transformPastedText: false,
    }),
    MarkdownShortcodes,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      validate: (href: string) => !/^(javascript:|data:)/i.test(href),
    }),
    ...(process.env.NODE_ENV === 'test' ? [] : [
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
    ]),
  AlignedImage,
  VideoShortcode,
  MermaidNode,
    Table.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
  ];

  // Deduplicate by extension name (keep the last declared version so user config wins)
  const seen = new Set<string>();
  const extensions: any[] = [];
  for (let i = rawExtensions.length - 1; i >= 0; i--) {
    const ext = rawExtensions[i];
    const name: string | undefined = ext?.name;
    if (!name || !seen.has(name)) {
      if (name) seen.add(name);
      extensions.unshift(ext);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const names = extensions.map(e => e?.name).filter(Boolean);
      const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
      if (dupes.length) {
        // Duplicate extensions found but continuing
      }
    } catch {/* ignore */}
  }

  const editor: Editor | null = useEditor({
    extensions: extensions as any,
    content: '',
    onUpdate: ({ editor }) => {
      try {
        const md = toMarkdown(editor);
        // Never sync to markdown state during normal typing - only call parent onChange
        onChange?.(md);
      } catch (e) {
        // Markdown extraction failed, continue
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg focus:outline-none min-h-[220px]",
        "data-placeholder": placeholder,
      },
      handlePaste: (view, event) => {
        // First handle file pastes
        handleFileEvent(view, event, editor!);

        // Handle markdown or HTML paste
        const html = event.clipboardData?.getData('text/html');
        const text = event.clipboardData?.getData('text/plain');
        
        // Check if pasted content looks like markdown (has markdown syntax)
        const isMarkdown = text && (
          text.includes('# ') || text.includes('## ') || text.includes('### ') ||
          text.includes('**') || text.includes('*') || text.includes('`') ||
          text.includes('[') || text.includes('](') || text.includes('- ') ||
          text.includes('1. ') || text.includes('> ') || text.includes('---')
        );
        
        if (isMarkdown && typeof window !== 'undefined') {
          event.preventDefault();
          // Parse markdown directly into editor
          fromMarkdown(text, editor!)
            .then(() => {
              // Note: convertMermaidCodeBlocks removed - auto-conversion plugin handles this
              reparseLowlight(editor!);
            })
            .catch(() => {/* Ignore markdown parse errors */});
          return true;
        } else if (html && typeof window !== 'undefined') {
          event.preventDefault();
          const sanitizedHtml = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
              'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code', 'pre',
              'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'br', 'hr', 'table', 'thead',
              'tbody', 'tr', 'td', 'th', 'figure', 'figcaption', 'div', 'video', 'source'
            ],
            ALLOWED_ATTR: [
              'href', 'src', 'alt', 'title', 'rel', 'target', 'class', 'style',
              'data-video-shortcode', 'data-shortcode-preview', 'data-shortcode-src', 
              'data-sources', 'controls', 'preload', 'width', 'height', 'poster',
              'autoplay', 'muted', 'playsinline', 'loop', 'type'
            ],
            FORBID_ATTR: ['onclick', 'onload', 'onerror', 'javascript'],
          });
          
          // Handle fenced code blocks in pasted content
          const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
          let processedHtml = sanitizedHtml;
          let match;
          
          while ((match = codeBlockRegex.exec(sanitizedHtml)) !== null) {
            const [fullMatch, lang, code] = match;
            const language = lang || 'plaintext';
            
            // Load the language if we support it
            if (SUPPORTED_LANGUAGES.includes(language as any)) {
              loadLanguage(language);
            }
          }
          
          const previewHtml = processedHtml.replace(/<video(?![^>]*data-shortcode-preview)/g, '<video data-shortcode-preview="true"');
          editor!.commands.insertContent(previewHtml);
          reparseLowlight(editor!);
          // Note: convertMermaidCodeBlocks removed - auto-conversion plugin handles this
          reparseLowlight(editor!);
          return true;
        }
        
        return false;
      },
      handleDrop: (view, event) => handleFileEvent(view, event, editor!),
    },
    // Avoid SSR hydration mismatches per Tiptap warning
    immediatelyRender: false,
  });

  // Debug: Expose editor globally for testing
  React.useEffect(() => {
    // Initialize editor content if provided (only on first mount)
    if (editor && stableInitialMarkdown.current && stableInitialMarkdown.current !== editor.getHTML()) {
      fromMarkdown(stableInitialMarkdown.current, editor);
    }
  }, [editor]); // Remove initialMarkdown from dependencies

  // Ensure onChange is called at least once after editor mounts
  React.useEffect(() => {
    if (editor && onChange) {
      try {
        const md = toMarkdown(editor);
        onChange(md);
      } catch {/* ignore */}
    }
  }, [editor, onChange]);

  // Load languages for initial markdown content
  React.useEffect(() => {
    if (editor && stableInitialMarkdown.current && typeof window !== 'undefined') {
      const loadInitialLanguages = async () => {
        const codeBlockRegex = /```(\w+)/g;
        let match;
        const languagesToLoad = new Set<string>();
        
        while ((match = codeBlockRegex.exec(stableInitialMarkdown.current)) !== null) {
          const lang = match[1]?.toLowerCase();
          if (lang && SUPPORTED_LANGUAGES.includes(lang as any)) {
            languagesToLoad.add(lang);
          }
        }
        
        // Load all languages in parallel
        if (languagesToLoad.size > 0) {
          await Promise.all([...languagesToLoad].map(lang => loadLanguage(lang)));
          
          // Refresh the editor content after languages are loaded to trigger highlighting
          const currentDoc = editor.getJSON();
          editor.commands.setContent(currentDoc as any);
          reparseLowlight(editor);
        }
      };
      
      loadInitialLanguages().catch(() => {/* Language loading failed */});
    }
  }, [editor]); // Remove initialMarkdown from dependencies



  // Handle sticky toolbar behavior
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const placeholderEl = placeholderRef.current;
    const toolbarEl = toolbarRef.current;

    if (!placeholderEl || !toolbarEl) {
      return;
    }

    const getScrollParent = (node: HTMLElement | null): HTMLElement | Window => {
      if (!node) return window;

      let parent = node.parentElement;
      while (parent) {
        const { overflow, overflowY, overflowX } = window.getComputedStyle(parent);
        if (/(auto|scroll)/.test(`${overflow}${overflowY}${overflowX}`)) {
          return parent;
        }
        parent = parent.parentElement;
      }

      return window;
    };

    const scrollTarget: HTMLElement | Window = getScrollParent(placeholderEl);

    // Calculate navbar height (sticky navbar with py-2.5 and content)
    const getNavbarHeight = (): number => {
      const navbar = document.querySelector('nav[class*="sticky"]');
      if (navbar) {
        return (navbar as HTMLElement).offsetHeight;
      }
      // Fallback: py-2.5 (20px) + estimated content height (~36px for h-9 elements)
      return 56;
    };

    const handleScroll = () => {
      if (!toolbarRef.current || !placeholderRef.current) return;

      const navbarHeight = getNavbarHeight();
      const topBoundary = scrollTarget === window
        ? navbarHeight  // Position below the navbar when using window scroll
        : Math.max(navbarHeight, (scrollTarget as HTMLElement).getBoundingClientRect().top);

      const shouldStick = placeholderRef.current.getBoundingClientRect().top <= topBoundary;

      if (shouldStick) {
        placeholderRef.current.style.height = `${toolbarRef.current.offsetHeight}px`;
        // Update toolbar position to account for navbar height when sticky
        if (scrollTarget === window) {
          toolbarRef.current.style.top = `${navbarHeight}px`;
        }
      } else {
        placeholderRef.current.style.height = '0px';
        toolbarRef.current.style.top = '';
      }

      setIsToolbarSticky(prev => {
        if (prev !== shouldStick) {
          return shouldStick;
        }
        return prev;
      });
    };

    handleScroll();

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      scrollTarget.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      placeholderEl.style.height = '0px';
      if (toolbarRef.current) {
        toolbarRef.current.style.top = '';
      }
    };
  }, [editor]);

// Toolbar component definition
interface ToolbarProps {
  editor: Editor | null;
  isSticky: boolean;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  uploadFile: (file: File) => Promise<string | null>;
  insertVideoShortcode: (editor: Editor, url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  videoInputRef: React.RefObject<HTMLInputElement | null>;
  showMarkdownView: boolean;
  setShowMarkdownView: (show: boolean) => void;
}

const EditorToolbar = React.memo(({ 
  editor, 
  isSticky, 
  toolbarRef,
  uploadFile,
  insertVideoShortcode,
  fileInputRef,
  videoInputRef,
  showMarkdownView,
  setShowMarkdownView
}: ToolbarProps) => {
  if (!editor) return null;

  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('plaintext');

    // Check if cursor is in code block and update language
    useEffect(() => {
      if (!editor) return;
      
      const isInCodeBlock = editor.isActive('codeBlock');
      setShowLanguageDropdown(isInCodeBlock);
      
      if (isInCodeBlock) {
        const attrs = editor.getAttributes('codeBlock');
        setCurrentLanguage(attrs.language || 'plaintext');
      }
    }, [editor.state.selection]);

    const btn = (opts: { 
      onClick: () => void; 
      active?: boolean; 
      label: string;
      title?: string;
      disabled?: boolean;
    }) => (
      <button
        type="button"
        onClick={opts.onClick}
        disabled={opts.disabled}
        title={opts.title}
        aria-label={opts.title || opts.label}
        className={`px-2 py-1 text-sm rounded border transition-colors ${
          opts.active 
            ? "bg-primary text-primary-foreground border-primary" 
            : "bg-card text-fg border-border hover:bg-muted/20"
        } ${opts.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {opts.label}
      </button>
    );

    const triggerImage = () => fileInputRef.current?.click();
    const triggerVideo = () => videoInputRef.current?.click();

    const onPickImage = async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      
      // Prompt for alt text (required for a11y)
      const altText = prompt('Enter alt text for the image (required):');
      if (!altText) {
        alert('Alt text is required for accessibility.');
        return;
      }
      
      const url = await uploadFile(file);
      if (url && editor) {
        (editor as any).chain().focus().setImage({
          src: url,
          alt: altText,
          title: altText 
        }).run();
      }
      ev.target.value = "";
    };

    const onPickVideo = async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url && editor) insertVideoShortcode(editor, url);
      ev.target.value = "";
    };

    const setLanguage = async (lang: string) => {
      if (SUPPORTED_LANGUAGES.includes(lang as any)) {
        await loadLanguage(lang);
      }
      (editor as any).chain().focus().updateAttributes('codeBlock', { language: lang }).run();
      reparseLowlight(editor);
      setCurrentLanguage(lang);
    };

    const insertTable = () => {
      // Insert a 3x3 table with header row if not in a table; otherwise add a row
      if (!editor.isActive('table')) {
        (editor as any).chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      } else {
        (editor as any).chain().focus().addRowAfter().run();
      }
    };

    const insertMermaid = () => {
      const defaultDiagram = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;
      
      (editor as any).chain().focus().insertMermaidDiagram(defaultDiagram).run();
    };

    const toggleLink = () => {
      const url = window.prompt('Enter URL:');
      if (url) {
        (editor as any).chain().focus().setLink({ href: url }).run();
      }
    };

    return (
      <div 
        ref={toolbarRef}
        className={`flex flex-wrap gap-2 p-2 border-b border-border bg-muted/10 transition-all duration-200 ${
          isSticky 
            ? 'fixed z-40 bg-card/95 backdrop-blur-sm shadow-lg' 
            : 'rounded-t-lg'
        }`}
        style={isSticky ? { left: toolbarRef.current?.getBoundingClientRect().left, width: toolbarRef.current?.offsetWidth } : {}}
      >
        {/* Text Formatting */}
        <div className="flex gap-1">
          {btn({ 
            label: "B", 
            active: editor.isActive("bold"), 
            onClick: () => editor.chain().focus().toggleBold().run(),
            title: "Bold (Ctrl+B)"
          })}
          {btn({ 
            label: "I", 
            active: editor.isActive("italic"), 
            onClick: () => editor.chain().focus().toggleItalic().run(),
            title: "Italic (Ctrl+I)"
          })}
          {btn({ 
            label: "U", 
            active: editor.isActive("underline"), 
            onClick: () => (editor as any).chain().focus().toggleUnderline().run(),
            title: "Underline"
          })}
          {btn({ 
            label: "S", 
            active: editor.isActive("strike"), 
            onClick: () => editor.chain().focus().toggleStrike().run(),
            title: "Strikethrough"
          })}
          {btn({ 
            label: "Code", 
            active: editor.isActive("code"), 
            onClick: () => editor.chain().focus().toggleCode().run(),
            title: "Inline Code (Ctrl+`)"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* Headings */}
        <div className="flex gap-1">
          {btn({ 
            label: "H1", 
            active: editor.isActive("heading", { level: 1 }), 
            onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            title: "Heading 1"
          })}
          {btn({ 
            label: "H2", 
            active: editor.isActive("heading", { level: 2 }), 
            onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            title: "Heading 2"
          })}
          {btn({ 
            label: "H3", 
            active: editor.isActive("heading", { level: 3 }), 
            onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            title: "Heading 3"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* Alignment */}
        <div className="flex gap-1">
          {btn({ 
            label: "←", 
            active: editor.isActive({ textAlign: 'left' }),
            onClick: () => (editor as any).chain().focus().setTextAlign('left').run(),
            title: "Align Left"
          })}
          {btn({ 
            label: "↔", 
            active: editor.isActive({ textAlign: 'center' }),
            onClick: () => (editor as any).chain().focus().setTextAlign('center').run(),
            title: "Align Center"
          })}
          {btn({ 
            label: "→", 
            active: editor.isActive({ textAlign: 'right' }),
            onClick: () => (editor as any).chain().focus().setTextAlign('right').run(),
            title: "Align Right"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* Lists and Blocks */}
        <div className="flex gap-1">
          {btn({ 
            label: "Quote", 
            active: editor.isActive("blockquote"), 
            onClick: () => editor.chain().focus().toggleBlockquote().run(),
            title: "Blockquote"
          })}
          {btn({ 
            label: "• List", 
            active: editor.isActive("bulletList"), 
            onClick: () => editor.chain().focus().toggleBulletList().run(),
            title: "Bullet List"
          })}
          {btn({ 
            label: "1. List", 
            active: editor.isActive("orderedList"), 
            onClick: () => editor.chain().focus().toggleOrderedList().run(),
            title: "Numbered List"
          })}
          {btn({
            label: "Task List",
            active: editor.isActive('taskList'),
            onClick: () => (editor as any).chain().focus().toggleTaskList().run(),
            title: "Task List"
          })}
          {btn({ 
            label: "Code Block", 
            active: editor.isActive("codeBlock"), 
            onClick: () => editor.chain().focus().toggleCodeBlock().run(),
            title: "Code Block"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* Insert Elements */}
        <div className="flex gap-1">
          {btn({ 
            label: "Link", 
            active: editor.isActive("link"), 
            onClick: toggleLink,
            title: "Insert Link"
          })}
          {btn({ 
            label: "Image", 
            onClick: triggerImage,
            title: "Insert Image"
          })}
          {btn({ 
            label: "Table", 
            onClick: insertTable,
            title: "Insert Table"
          })}
          {btn({ 
            label: "Video", 
            onClick: triggerVideo,
            title: "Insert Video"
          })}
          {btn({ 
            label: "Mermaid", 
            onClick: insertMermaid,
            title: "Insert Mermaid Diagram"
          })}
          {btn({ 
            label: "HR", 
            onClick: () => editor.chain().focus().setHorizontalRule().run(),
            title: "Horizontal Rule"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* History */}
        <div className="flex gap-1">
          {btn({ 
            label: "↶", 
            onClick: () => editor.chain().focus().undo().run(),
            disabled: !editor.can().undo(),
            title: "Undo (Ctrl+Z)"
          })}
          {btn({ 
            label: "↷", 
            onClick: () => editor.chain().focus().redo().run(),
            disabled: !editor.can().redo(),
            title: "Redo (Ctrl+Shift+Z)"
          })}
        </div>

        <div className="w-px bg-border self-stretch"></div>

        {/* View Mode */}
        <div className="flex gap-1">
          {btn({ 
            label: showMarkdownView ? "Visual" : "Markdown", 
            active: showMarkdownView,
            onClick: () => setShowMarkdownView(!showMarkdownView),
            title: showMarkdownView ? "Switch to Visual Editor" : "Switch to Markdown Editor"
          })}
        </div>

        {/* Language Dropdown for Code Blocks */}
        {showLanguageDropdown && (
          <div className="flex gap-1 items-center">
            <div className="w-px bg-border self-stretch"></div>
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2 py-1 text-sm rounded border border-border bg-card text-fg"
              title="Code Block Language"
            >
              <option value="plaintext">Plain Text</option>
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
      </div>
    );
});

EditorToolbar.displayName = 'EditorToolbar';

  // Handle markdown content changes in markdown view
  const handleMarkdownChange = (newMarkdown: string) => {
    setMarkdownContent(newMarkdown);
    onChange?.(newMarkdown);
  };

  // Sync editor content to markdown when switching views
  React.useEffect(() => {
    if (!editor) return;
    
    if (showMarkdownView) {
      // Switching to markdown view - get current editor content
      const currentMarkdown = toMarkdown(editor);
      setMarkdownContent(currentMarkdown);
    } else {
      // Switching to visual view - set editor content from markdown
      if (markdownContent) {
        fromMarkdown(markdownContent, editor);
      }
    }
  }, [showMarkdownView, editor]);

  return (
    <div className={className}>
      {/* Placeholder div to prevent layout jumps when toolbar becomes sticky */}
      <div ref={placeholderRef} className="transition-all duration-200" />
      <EditorToolbar 
        editor={editor} 
        isSticky={isToolbarSticky} 
        toolbarRef={toolbarRef}
        uploadFile={uploadFile}
        insertVideoShortcode={insertVideoShortcode}
        fileInputRef={fileInputRef}
        videoInputRef={videoInputRef}
        showMarkdownView={showMarkdownView}
        setShowMarkdownView={setShowMarkdownView}
      />
      <div className="border border-border rounded-b-lg bg-card">
        {showMarkdownView ? (
          <textarea
            value={markdownContent}
            onChange={(e) => handleMarkdownChange(e.target.value)}
            placeholder={`${placeholder} (Markdown mode)`}
            className="w-full min-h-[220px] p-4 bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed"
            spellCheck={false}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
