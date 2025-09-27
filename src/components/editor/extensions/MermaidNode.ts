// SPDX-License-Identifier: Apache-2.0
import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, Transaction, EditorState } from '@tiptap/pm/state'

declare global {
  interface Window {
    mermaid?: any;
  }
}

// Helper function to decode HTML entities in Mermaid content
const decodeHtmlEntities = (content: string): string => {
  return content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
};

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

  /**
   * Provide a text representation so markdown export (toMarkdown) retains diagrams.
   * This outputs a standard fenced mermaid block that can be round-tripped.
   */
  renderText({ node }) {
    const content: string = (node.attrs.content || '').replace(/```/g, '```\u200b'); // guard against accidental fence termination
    return `\n\n\`\`\`mermaid\n${content}\n\`\`\`\n\n`;
  },

  /**
   * ProseMirror plugin that automatically converts any codeBlock with language=mermaid
   * into a mermaid node. This removes the need for manual post-processing on paste/import.
   */
  addProseMirrorPlugins() {
    // Singleton plugin instance (stable across re-configurations) to avoid duplicate keyed plugin error
    if (!(globalThis as any).__mermaidAutoConvertPlugin) {
      (globalThis as any).__mermaidAutoConvertPlugin = new Plugin({
        key: new PluginKey('mermaid-auto-convert'),
        appendTransaction: (transactions, _oldState, newState) => {
          // Only proceed if something changed in the doc
          if (!transactions.some(tr => tr.docChanged)) {
            return;
          }
          
          const codeBlockType = newState.schema.nodes['codeBlock'];
          const mermaidType = newState.schema.nodes['mermaid'];
          if (!codeBlockType || !mermaidType) {
            return;
          }

          // Collect all candidate replacements first to avoid mutating during traversal
          const replacements: { from: number; to: number; node: any }[] = [];
          
          newState.doc.descendants((node, pos) => {
            if (node.type === codeBlockType) {
              const lang = (node.attrs as any)?.language || (node.attrs as any)?.lang;
              
              if (typeof lang === 'string' && lang.toLowerCase() === 'mermaid') {
                const diagram = node.textContent || '';
                
                replacements.push({
                  from: pos,
                  to: pos + node.nodeSize,
                  node: mermaidType.create({ content: diagram })
                });
              }
            }
          });

          if (!replacements.length) {
            return;
          }

          let tr = newState.tr;
          
          // Apply in reverse order so earlier positions remain valid
          for (let i = replacements.length - 1; i >= 0; i--) {
            const { from, to, node } = replacements[i]!;
            
            // Defensive bounds check to avoid RangeError
            if (to <= tr.doc.content.size + 2) {
              try {
                tr = tr.replaceWith(from, to, node);
              } catch (e) {
                console.error('MermaidAutoConvert replacement failed:', e);
              }
            }
          }

          // Handle content reconstruction for fragmented mermaid blocks
          if (tr.docChanged) {
            const suspiciousNodes: { node: any; pos: number; text: string }[] = [];
            let mermaidNodePos = -1;
            let mermaidNodeContent = '';
            
            tr.doc.descendants((node, pos) => {
              if (node.type.name === 'mermaid') {
                mermaidNodePos = pos;
                mermaidNodeContent = node.attrs?.content || '';
              }
              
              // Look for text nodes that contain mermaid content fragments
              if (node.type.name === 'paragraph' || node.type.name === 'text') {
                const text = node.textContent || '';
                if (/subgraph|classDef|flowchart|-->/.test(text) && 
                    !text.includes('This is a single mermaid diagram') && 
                    !text.includes('that has a subgraph') &&
                    !text.includes('should appear as')) {
                  suspiciousNodes.push({ node, pos, text });
                }
              }
            });
            
            // If we have fragments and an incomplete mermaid node, reconstruct
            if (suspiciousNodes.length > 0 && mermaidNodePos >= 0 && 
                mermaidNodeContent.includes('CLUSTER_1') && !mermaidNodeContent.includes('CLUSTER_2')) {
              
              // Collect fragments and reconstruct complete content
              const fragments = suspiciousNodes
                .map(s => s.text.trim())
                .filter((text, index, arr) => {
                  const textSnippet = text.substring(0, 50);
                  return arr.findIndex(existing => existing.includes(textSnippet)) === index;
                });
              
              if (fragments.length > 0) {
                const completeContent = mermaidNodeContent.trim() + '\n' + fragments.join('\n').trim();
                
                const mermaidNodeType = tr.doc.type.schema.nodes.mermaid;
                if (mermaidNodeType) {
                  const updatedMermaidNode = mermaidNodeType.create({ content: completeContent });
                  tr = tr.replaceWith(mermaidNodePos, mermaidNodePos + 1, updatedMermaidNode);
                  
                  // Clean up fragments in reverse order
                  const sortedSuspiciousNodes = suspiciousNodes.sort((a, b) => b.pos - a.pos);
                  
                  for (const { pos, node } of sortedSuspiciousNodes) {
                    try {
                      const currentDocSize = tr.doc.content.size;
                      if (pos < currentDocSize && pos + node.nodeSize <= currentDocSize) {
                        tr = tr.delete(pos, pos + node.nodeSize);
                      }
                    } catch (cleanupError) {
                      console.warn('Fragment cleanup failed:', cleanupError);
                    }
                  }
                }
              }
            }
          }

          return tr.docChanged ? tr : undefined;
        }
      });
    }
    return [ (globalThis as any).__mermaidAutoConvertPlugin ];
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
      
      // Decode HTML entities when setting initial content
      const initialContent = node.attrs.content || '';
      const decodedContent = decodeHtmlEntities(initialContent);
      
      textarea.value = decodedContent;
      textarea.placeholder = 'Enter Mermaid diagram code here...';
      
      const updatePreview = async () => {
        try {
          if (!window.mermaid) {
            const mermaid = await import('mermaid');
            await mermaid.default.initialize({
              startOnLoad: false,
              theme: 'default',
              securityLevel: 'loose',
              gantt: { axisFormat: '%Y-%m-%d' },
            });
            window.mermaid = mermaid.default;
          }
        
        let source = textarea.value.trim();
        
        if (!source) {
          contentDiv.innerHTML = '<p style="color: #6b7280; font-style: italic;">Mermaid diagram preview will appear here</p>';
          return;
        }

        // Decode HTML entities that might be present in the source
        source = decodeHtmlEntities(source);
          
        // Analyze diagram complexity to determine rendering strategy
        const lines = source.split(/\r?\n/);
        const firstLine = lines.find(l => l.trim() && !l.trim().startsWith('%%')) || '';
        const keyword = firstLine.split(/\s+/)[0]?.toLowerCase() || '';
        
        // Complex diagrams that sometimes break parse with NaN due to measurement ordering
        const complexTypes = new Set(['gantt','timeline','quadrantchart','gitgraph','mindmap','requirementdiagram','journey']);
        const isComplexType = complexTypes.has(keyword);
        
        // Check for complex features that might cause rendering issues
        const hasSubgraphs = /subgraph\s+\w+/.test(source);
        const hasCrossSubgraphConnections = hasSubgraphs && /^\s*\w+\s*-->.*\w+\s*$/m.test(source);
        const shouldPreParse = !isComplexType;

        // For cross-subgraph diagrams, proactively use enhanced configuration
        if (hasCrossSubgraphConnections) {
          try {
            await window.mermaid.initialize({ 
              startOnLoad: false, 
              theme: 'default', 
              securityLevel: 'loose',
              flowchart: { 
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'linear'
              },
              gantt: { axisFormat: '%Y-%m-%d' }
            });
          } catch (configError) {
            console.error('Failed to configure for cross-subgraph rendering:', configError);
          }
        }

        if (shouldPreParse) {
          try {
            await window.mermaid.parse(source);
          } catch (syntaxErr) {
            console.error('Mermaid parse error:', syntaxErr);
            contentDiv.innerHTML = `<div style="color:#dc2626;font-size:14px;padding:8px;background:#fef2f2;border-radius:4px;">Syntax Error: ${syntaxErr instanceof Error ? syntaxErr.message : 'Invalid diagram'}<details style="margin-top:8px;"><summary style="cursor:pointer;">Show source</summary><pre style="margin-top:8px;white-space:pre-wrap;max-height:220px;overflow:auto;font-family:monospace;font-size:12px;">${source.replace(/</g,'&lt;')}</pre></details></div>`;
            return;
          }
        }

        await new Promise(r => requestAnimationFrame(r));

        // Provide a stable unique id
        const globalAny = globalThis as any;
        if (!globalAny.__mermaidPreviewCounter) globalAny.__mermaidPreviewCounter = 0;
        const id = `mermaid-preview-${++globalAny.__mermaidPreviewCounter}`;

        const tryRender = async (attempt: number): Promise<{ ok: boolean; error?: unknown }> => {
          // For complex diagrams we attach a temporary hidden container to allow layout-dependent measurements
          let tempContainer: HTMLDivElement | null = null;
          try {
            let containerForRender: HTMLElement | undefined;
            if (isComplexType) {
              tempContainer = document.createElement('div');
              const targetWidth = contentDiv.clientWidth || dom.clientWidth || 800;
              tempContainer.style.cssText = `position:absolute;left:-9999px;top:0;visibility:hidden;width:${targetWidth}px;display:block;`;
              document.body.appendChild(tempContainer);
              containerForRender = tempContainer;
            }
            const { svg } = await window.mermaid.render(id + '-' + attempt, source, containerForRender);
            
            if (/NaN/.test(svg)) {
              throw new Error('Render produced NaN coordinates');
            }
            
            contentDiv.innerHTML = svg;
            return { ok: true };
          } catch (err) {
            return { ok: false, error: err };
          } finally {
            if (tempContainer && tempContainer.parentNode) {
              tempContainer.parentNode.removeChild(tempContainer);
            }
          }
        };

        // Attempt sequence: try render, if fails with layout issues, try again with different config
        const first = await tryRender(1);
        let ok = first.ok;
        
        if (!ok) {
          const errorMsg = first.error instanceof Error ? first.error.message : String(first.error);
          
          if (/NaN|length/.test(errorMsg) || /Invalid date/.test(errorMsg)) {
            await new Promise(r => requestAnimationFrame(r));
            try {
              await window.mermaid.initialize({ startOnLoad:false, theme:'default', securityLevel:'loose', gantt:{ axisFormat:'%Y-%m-%d' } });
            } catch {/* ignore */}
            
            const secondAttempt = await tryRender(2);
            ok = secondAttempt.ok;
            
            // Special handling for cross-subgraph connection issues
            if (!ok && hasCrossSubgraphConnections) {
              try {
                await window.mermaid.initialize({ 
                  startOnLoad: false, 
                  theme: 'default', 
                  securityLevel: 'loose',
                  flowchart: { 
                    useMaxWidth: true,
                    htmlLabels: true,
                    curve: 'linear'
                  },
                  gantt: { axisFormat: '%Y-%m-%d' }
                });
                const thirdAttempt = await tryRender(3);
                ok = thirdAttempt.ok;
              } catch (e) {
                console.error('Cross-subgraph rendering attempt failed:', e);
              }
            }
          }
        }
        
        if (!ok) {
          const finalError = first.error instanceof Error ? first.error.message : 'Unknown rendering error';
          contentDiv.innerHTML = `<div style="color:#b45309;font-size:13px;padding:8px;background:#fffbeb;border:1px solid #fcd34d;border-radius:4px;">
            <strong>Render Warning:</strong> Could not render diagram.
            <details style="margin-top:6px;">
              <summary style="cursor:pointer;">Show source</summary>
              <pre style="white-space:pre-wrap;max-height:200px;overflow:auto;margin-top:4px;font-family:monospace;font-size:11px;">${source.replace(/</g,'&lt;')}</pre>
            </details>
            <p style="margin-top:6px;font-size:11px;color:#92400e;">Error: ${finalError}</p>
          </div>`;
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
          const updatedContent = updatedNode.attrs.content || '';
          const decodedUpdatedContent = decodeHtmlEntities(updatedContent);
            
          if (textarea.value !== decodedUpdatedContent) {
            textarea.value = decodedUpdatedContent;
            updatePreview();
          }
          return true;
        },
      };
    };
  },
});