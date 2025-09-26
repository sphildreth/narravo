// SPDX-License-Identifier: Apache-2.0
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { expandShortcodes } from '@/lib/markdown';

export const MarkdownShortcodes = Extension.create({
  name: 'markdownShortcodes',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownShortcodes'),
        props: {
          transformPastedHTML(html) {
            const result = expandShortcodes(html);
            return result;
          },
          transformPastedText(text) {
            // Also process video shortcodes in plain text markdown
            const result = expandShortcodes(text);
            return result;
          },
        },
      }),
    ];
  },
});
