"use client";
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import TiptapEditor from "@/components/editor/TiptapEditor";

export default function TiptapDemo() {
  const [markdown, setMarkdown] = useState(`# Welcome to the Enhanced TipTap Editor!

This is a demonstration of our **enhanced WYSIWYG editor** with the following features:

## Text Formatting
- **Bold text**
- *Italic text*  
- ~~Strikethrough~~
- \`inline code\`

## Code Blocks with Language Support

\`\`\`typescript
interface User {
  name: string;
  email: string;
}

const user: User = {
  name: "John Doe", 
  email: "john@example.com"
};
\`\`\`

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

## Lists and Structure

### Bullet Lists
- First item
- Second item 
- Third item

### Task Lists
- [x] Completed task with **bold text**
- [ ] Incomplete task with *italic text*
- [x] Another completed task with \`inline code\`
- [ ] Parent task with nested items
  - [x] Nested completed task
  - [ ] Nested incomplete task with longer text that should wrap properly and align with the checkbox
  - [ ] Another nested task
    - [x] Third level task
    - [ ] Third level incomplete with even longer text that definitely should wrap and test our alignment

### Numbered Lists
1. Step one
2. Step two
3. Step three

### Block Quotes
> This is a blockquote with some important information.

## Links and Media
[Visit the GitHub repo](https://github.com/sphildreth/narravo)

Try the toolbar features:
- **Text alignment** (left, center, right)
- **Code language selection** (when cursor is in code block)
- **Image uploads** with alt text prompts
- **Safe paste handling** with DOMPurify sanitization
`);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">TipTap WYSIWYG Editor Demo</h1>
        <p className="text-muted-foreground">
          Enhanced editor with alignment, code highlighting, security, and accessibility features
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Editor</h2>
          <TiptapEditor
            initialMarkdown={markdown}
            onChange={setMarkdown}
            placeholder="Start writing your content..."
            className="border rounded-lg"
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Markdown Output</h2>
          <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
            <code>{markdown}</code>
          </pre>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Features Implemented ✅</h3>
          <ul className="space-y-1 text-sm">
            <li>• Text alignment for paragraphs and headings</li>
            <li>• Syntax highlighting for 18+ programming languages</li>
            <li>• Enhanced image support with alignment and captions</li>
            <li>• Comprehensive toolbar with ARIA labels and tooltips</li>
            <li>• Secure paste handling with DOMPurify sanitization</li>
            <li>• Safe external link handling (rel="noopener noreferrer")</li>
            <li>• Dynamic language loading for optimal performance</li>
            <li>• Markdown round-trip with HTML support for alignment</li>
            <li>• Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)</li>
            <li>• Accessibility features and screen reader support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}