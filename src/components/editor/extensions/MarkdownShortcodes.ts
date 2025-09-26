// SPDX-License-Identifier: Apache-2.0
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * Expands [video] shortcodes into the Tiptap `videoShortcode` node.
 * This is a simplified version of the main `expandShortcodes` function,
 * focused on what's needed for the editor.
 */
function expandVideoShortcodes(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';

  const videoRe = /\[video([^\]]*)\](?:\\s*\[\/video\])?/gi;
  const attrRe = /(\w+)=("([^"]*)"|'([^']*)'|([^\s"']+))/g;

  return markdown.replace(videoRe, (_full, attrStr: string) => {
    const attrs: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(attrStr))) {
      const key = m[1];
      if (!key) continue;
      attrs[key.toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
    }

    const sources: Array<{ src: string; type?: string }> = [];
    const addSource = (url: string | undefined, type: string) => {
      if (url) sources.push({ src: url, type });
    };

    addSource(attrs.mp4, 'video/mp4');
    addSource(attrs.webm, 'video/webm');
    addSource(attrs.ogv, 'video/ogg');

    if (sources.length === 0) return _full;

    const sourcesPayload = encodeURIComponent(JSON.stringify(sources));

    return `<div data-video-shortcode="true"><video data-shortcode-preview="true" data-sources="${sourcesPayload}" src="${sources[0]!.src}" controls></video></div>`;
  });
}

export const MarkdownShortcodes = Extension.create({
  name: 'markdownShortcodes',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownShortcodes'),
        props: {
          transformPastedHTML(html) {
            return expandVideoShortcodes(html);
          },
        },
      }),
    ];
  },
});
