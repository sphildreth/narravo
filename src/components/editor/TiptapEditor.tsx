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
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import { createLowlight } from "lowlight";

// Create lowlight instance
const lowlight = createLowlight();
import DOMPurify from "isomorphic-dompurify";

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
    console.warn(`Failed to load language ${lang}:`, err);
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
export const fromMarkdown = (markdown: string, editor?: Editor) => {
  if (!editor) return;
  
  // Sanitize the markdown content before setting
  const sanitizedMarkdown = DOMPurify.sanitize(markdown, {
    ALLOWED_TAGS: [
      'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code', 'pre',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'br', 'hr', 'table', 'thead',
      'tbody', 'tr', 'td', 'th', 'figure', 'figcaption'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'rel', 'target', 'class', 'style'],
    ALLOW_DATA_ATTR: false,
  });
  
  editor.commands.setContent(sanitizedMarkdown);
};

export const toMarkdown = (editor?: Editor): string => {
  if (!editor) return '';
  try {
    return (editor.storage as any)?.markdown?.getMarkdown?.() ?? '';
  } catch (e) {
    console.warn('Failed to get markdown from editor:', e);
    return '';
  }
};

export default function TiptapEditor({ initialMarkdown = "", onChange, placeholder = "Write your post...", className = "" }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

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

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ 
        html: true, // Allow HTML for image alignment figures
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        validate: (href: string) => {
          // Reject javascript: and data: URLs for security
          return !/^(javascript:|data:)/i.test(href);
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Underline,
      AlignedImage,
    ] as any,
    content: initialMarkdown,
    onUpdate: ({ editor }) => {
      try {
        const md = toMarkdown(editor);
        onChange?.(md);
      } catch (e) {
        console.warn('Failed to get markdown on update:', e);
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

        // Then handle HTML/text paste with sanitization
        const html = event.clipboardData?.getData('text/html');
        if (html) {
          event.preventDefault();
          const sanitizedHtml = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
              'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'code', 'pre',
              'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'br', 'hr', 'table', 'thead',
              'tbody', 'tr', 'td', 'th', 'figure', 'figcaption'
            ],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'rel', 'target', 'class', 'style'],
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
          
          editor!.commands.insertContent(processedHtml);
          return true;
        }
        
        return false;
      },
      handleDrop: (view, event) => handleFileEvent(view, event, editor!),
    },
    // Avoid SSR hydration mismatches per Tiptap warning
    immediatelyRender: false,
  });

  const Toolbar = useMemo(() => function Toolbar({ editor }: { editor: Editor | null }) {
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
      setCurrentLanguage(lang);
    };

    const insertTable = () => {
      // TODO: Add table support
      console.log('Table support not yet implemented');
    };

    const toggleLink = () => {
      const url = window.prompt('Enter URL:');
      if (url) {
        (editor as any).chain().focus().setLink({ href: url }).run();
      }
    };

    return (
      <div className="flex flex-wrap gap-2 p-2 border border-border rounded-t-lg bg-muted/10">
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
  }, [uploadFile, insertVideoShortcode]);

  return (
    <div className={className}>
      <Toolbar editor={editor} />
      <div className="border border-border rounded-b-lg bg-card">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
