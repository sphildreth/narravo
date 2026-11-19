"use client";
// SPDX-License-Identifier: Apache-2.0
import { lazy, Suspense, type ComponentProps } from "react";

const Code = lazy(() => import("./CodeBlock"));
const Diagram = lazy(() => import("./MermaidDiagram"));

export function PostCodeBlock(props: ComponentProps<typeof Code>) {
  return <Suspense fallback={<pre><code>{props.children}</code></pre>}><Code {...props} /></Suspense>;
}

export function PostDiagram(props: ComponentProps<typeof Diagram>) {
  return <Suspense fallback={<pre>{props.chart}</pre>}><Diagram {...props} /></Suspense>;
}
