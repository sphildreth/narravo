"use client";
// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export default function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>(`mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (!elementRef.current || !chart) return;

    // Initialize mermaid with a dark theme that works well
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
    });

    // Clear any previous content
    elementRef.current.innerHTML = '';

    // Render the diagram
    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, chart);
        if (elementRef.current) {
          elementRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (elementRef.current) {
          elementRef.current.innerHTML = `
            <div class="border border-red-200 bg-red-50 p-4 rounded-md text-red-800 text-sm">
              <strong>Mermaid Diagram Error:</strong><br/>
              ${error instanceof Error ? error.message : 'Invalid diagram syntax'}
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