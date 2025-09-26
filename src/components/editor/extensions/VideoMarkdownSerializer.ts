// SPDX-License-Identifier: Apache-2.0
import { Extension } from '@tiptap/core';

export const VideoMarkdownSerializer = Extension.create({
  name: 'videoMarkdownSerializer',

  addStorage() {
    return {
      videoSerializer: (node: any) => {
        const { src, webm, ogv, poster, autoplay, loop, muted } = node.attrs;
        
        let shortcode = '[video';
        if (src) shortcode += ` mp4="${src}"`;
        if (webm) shortcode += ` webm="${webm}"`;
        if (ogv) shortcode += ` ogv="${ogv}"`;
        if (poster) shortcode += ` poster="${poster}"`;
        if (loop) shortcode += ` loop`;
        if (muted) shortcode += ` muted`;
        if (autoplay) shortcode += ` autoplay`;
        shortcode += '][/video]';
        
        return shortcode;
      }
    };
  },

  onBeforeCreate() {
    // Hook into the markdown extension to add custom serializer
    const markdownExtension = this.editor.extensionManager.extensions.find(
      ext => ext.name === 'markdown'
    );
    
    if (markdownExtension) {
      const originalSerializer = markdownExtension.options.serialize;
      markdownExtension.options.serialize = {
        ...originalSerializer,
        videoShortcode: this.storage.videoSerializer
      };
    }
  },
});