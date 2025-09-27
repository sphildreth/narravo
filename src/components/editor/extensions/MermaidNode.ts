// SPDX-License-Identifier: Apache-2.0
import { Node, mergeAttributes } from '@tiptap/core';

declare global {
  interface Window {
    mermaid?: any;
  }
}

export const MermaidNode = Node.create({
  name: 'mermaid',
  
  group: 'block',
  
  atom: true,
  
  addAttributes() {
    return {
      content: {
        default: '',
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'div[data-mermaid]',
        getAttrs: (element) => ({
          content: (element as HTMLElement).getAttribute('data-mermaid') || '',
        }),
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-mermaid': HTMLAttributes.content,
        class: 'mermaid-block',
      }),
      ['pre', { class: 'mermaid' }, HTMLAttributes.content],
    ];
  },
  
  addCommands() {
    return {
      insertMermaidDiagram:
        (content: string) =>
        ({ commands }: any) =>
          commands.insertContent({
            type: this.name,
            attrs: { content },
          }),
    } as any;
  },
  
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.className = 'mermaid-editor-node';
      dom.style.cssText = 'border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; background: #f8fafc;';
      
      const contentDiv = document.createElement('div');
      contentDiv.className = 'mermaid-preview';
      contentDiv.style.cssText = 'margin-bottom: 12px; text-align: center;';
      
      const textarea = document.createElement('textarea');
      textarea.className = 'mermaid-source';
      textarea.style.cssText = 'width: 100%; min-height: 120px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-family: monospace; font-size: 14px; resize: vertical;';
      textarea.value = node.attrs.content || '';
      textarea.placeholder = 'Enter Mermaid diagram code here...';
      
      const updatePreview = async () => {
        try {
          if (!window.mermaid) {
            const mermaid = await import('mermaid');
            await mermaid.default.initialize({
              startOnLoad: false,
              theme: 'default',
              securityLevel: 'strict',
            });
            window.mermaid = mermaid.default;
          }
          
          if (textarea.value.trim()) {
            const { svg } = await window.mermaid.render(
              `preview-${Date.now()}`,
              textarea.value
            );
            contentDiv.innerHTML = svg;
          } else {
            contentDiv.innerHTML = '<p style="color: #6b7280; font-style: italic;">Mermaid diagram preview will appear here</p>';
          }
        } catch (error) {
          contentDiv.innerHTML = `<div style="color: #dc2626; font-size: 14px; padding: 8px; background: #fef2f2; border-radius: 4px;">Error: ${error instanceof Error ? error.message : 'Invalid syntax'}</div>`;
        }
      };
      
      // Update content when textarea changes
      let debounceTimer: NodeJS.Timeout;
      textarea.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (typeof getPos === 'function') {
            const pos = getPos();
            if (typeof pos === 'number') {
              editor.commands.setNodeSelection(pos);
              editor.commands.updateAttributes('mermaid', { content: textarea.value });
            }
          }
          updatePreview();
        }, 500);
      });
      
      // Initial preview
      updatePreview();
      
      dom.appendChild(contentDiv);
      dom.appendChild(textarea);
      
      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) {
            return false;
          }
          if (textarea.value !== updatedNode.attrs.content) {
            textarea.value = updatedNode.attrs.content || '';
            updatePreview();
          }
          return true;
        },
      };
    };
  },
});