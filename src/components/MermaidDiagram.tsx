"use client";
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import logger from '@/lib/logger';

// Type declaration for window.mermaid
declare global {
  interface Window {
    mermaid?: any;
  }
}

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export default function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!elementRef.current || !chart) return;

    // Generate ID only on client side to avoid hydration mismatch
    if (!idRef.current) {
      idRef.current = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Clear any previous content
    elementRef.current.innerHTML = '';

    // Decode HTML entities in chart content for proper Mermaid rendering
    const decodedChart = chart
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&nbsp;/g, " ");

    // Render the diagram
    const renderDiagram = async () => {
      try {
        // Analyze diagram complexity before rendering
        const hasSubgraphs = /subgraph\s+\w+/.test(decodedChart);
        const hasCrossSubgraphConnections = hasSubgraphs && /^\s*\w+\s*-->.*\w+\s*$/m.test(decodedChart);
        const hasHtmlTags = /<br\/?>/i.test(decodedChart) || /<small>/i.test(decodedChart);
        
        logger.debug('MermaidDiagram render analysis:', { hasSubgraphs, hasCrossSubgraphConnections, hasHtmlTags });

        // Determine appropriate configuration based on diagram complexity
        const config = {
          startOnLoad: false,
          theme: 'default' as const,
          securityLevel: 'loose' as const,
          gantt: { axisFormat: '%Y-%m-%d' },
          ...(hasCrossSubgraphConnections && {
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: 'linear' as const
            }
          })
        };

        // Ensure mermaid is properly initialized
        if (!window.mermaid) {
          const mermaidModule = await import('mermaid');
          await mermaidModule.default.initialize(config);
          window.mermaid = mermaidModule.default;
        } else {
          // Re-initialize with appropriate config
          await mermaid.initialize(config);
        }

        // Generate a stable unique ID for this render using the component's ID
        const renderId = `${idRef.current}-render-${Math.random().toString(36).substr(2, 9)}`;
        
        // Parse first to catch syntax errors early
        await window.mermaid.parse(decodedChart);
        
        const { svg } = await window.mermaid.render(renderId, decodedChart);
        if (elementRef.current) {
          elementRef.current.innerHTML = svg;
        }
      } catch (error) {
        logger.error('Mermaid rendering error:', error);
        if (elementRef.current) {
          elementRef.current.innerHTML = `
            <div class="border border-red-200 bg-red-50 p-4 rounded-md text-red-800 text-sm">
              <strong>Mermaid Diagram Error:</strong><br/>
              ${error instanceof Error ? error.message : 'Invalid diagram syntax'}
              <details class="mt-2">
                <summary class="cursor-pointer text-xs">Show diagram source</summary>
                <pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">${decodedChart.replace(/</g, '&lt;')}</pre>
              </details>
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [chart]);

  return (
    <div 
      ref={elementRef}
      className={`mermaid-diagram ${className}`}
      style={{ textAlign: 'center' }}
    />
  );
}