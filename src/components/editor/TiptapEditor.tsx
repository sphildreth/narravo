"use client";
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";

export type TiptapEditorProps = {
  initialMarkdown?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  className?: string;
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

      const formData = new FormData();
      Object.entries(signData.fields as Record<string, string>).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);
      const uploadRes = await fetch(signData.url, { method: "POST", body: formData });
      if (!uploadRes.ok) {
        console.error("Upload failed", await uploadRes.text());
        return null;
      }

      const publicUrl: string = signData.publicUrl || (signData.url as string).replace(/\?.*$/, "") + "/" + signData.key;
      return publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  }, []);

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
      Markdown.configure({ html: false }),
      Image,
    ],
    content: initialMarkdown,
    onUpdate: ({ editor }) => {
      try {
        const md = (editor.storage as any)?.markdown?.getMarkdown?.() ?? "";
        onChange?.(md);
      } catch (e) {
        // no-op
      }
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg focus:outline-none min-h-[220px]",
        "data-placeholder": placeholder,
      },
      handlePaste: (view, event) => handleFileEvent(view, event, editor!),
      handleDrop: (view, event) => handleFileEvent(view, event, editor!),
    },
  });

  const Toolbar = useMemo(() => function Toolbar({ editor }: { editor: Editor | null }) {
    if (!editor) return null;
    const btn = (opts: { onClick: () => void; active?: boolean; label: string }) => (
      <button
        type="button"
        onClick={opts.onClick}
        className={`px-2 py-1 text-sm rounded border ${opts.active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-fg border-border hover:bg-muted/20"}`}
      >
        {opts.label}
      </button>
    );

    const triggerImage = () => fileInputRef.current?.click();
    const triggerVideo = () => videoInputRef.current?.click();

    const onPickImage = async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url && editor) editor.chain().focus().setImage({ src: url }).run();
      ev.target.value = "";
    };

    const onPickVideo = async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url && editor) insertVideoShortcode(editor, url);
      ev.target.value = "";
    };

    return (
      <div className="flex flex-wrap gap-2 p-2 border border-border rounded-t-lg bg-muted/10">
        {btn({ label: "B", active: editor.isActive("bold"), onClick: () => editor.chain().focus().toggleBold().run() })}
        {btn({ label: "I", active: editor.isActive("italic"), onClick: () => editor.chain().focus().toggleItalic().run() })}
        {btn({ label: "S", active: editor.isActive("strike"), onClick: () => editor.chain().focus().toggleStrike().run() })}
        {btn({ label: "H1", active: editor.isActive("heading", { level: 1 }), onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run() })}
        {btn({ label: "H2", active: editor.isActive("heading", { level: 2 }), onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() })}
        {btn({ label: "H3", active: editor.isActive("heading", { level: 3 }), onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run() })}
        {btn({ label: "Quote", active: editor.isActive("blockquote"), onClick: () => editor.chain().focus().toggleBlockquote().run() })}
        {btn({ label: "Code", active: editor.isActive("codeBlock"), onClick: () => editor.chain().focus().toggleCodeBlock().run() })}
        {btn({ label: "• List", active: editor.isActive("bulletList"), onClick: () => editor.chain().focus().toggleBulletList().run() })}
        {btn({ label: "1. List", active: editor.isActive("orderedList"), onClick: () => editor.chain().focus().toggleOrderedList().run() })}
        {btn({ label: "Image", onClick: triggerImage })}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        {btn({ label: "Video", onClick: triggerVideo })}
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
