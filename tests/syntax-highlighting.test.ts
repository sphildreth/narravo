// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("Syntax Highlighting Support", () => {
  it("should preserve pre tags with prism class", () => {
    const input = '<pre class="prism undefined-numbers lang-bash" data-lang="Bash">echo "Hello World"</pre>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="prism undefined-numbers lang-bash" data-lang="Bash">');
    expect(result).toContain('echo "Hello World"');
  });

  it("should preserve pre tags with language class", () => {
    const input = '<pre class="language-javascript">console.log("test");</pre>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="language-javascript">');
    expect(result).toContain('console.log("test");');
  });

  it("should preserve pre tags with lang class", () => {
    const input = '<pre class="lang-python">print("hello")</pre>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="lang-python">');
    expect(result).toContain('print("hello")');
  });

  it("should preserve data-lang attribute on pre tags", () => {
    const input = '<pre class="prism" data-lang="SQL">SELECT * FROM users;</pre>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('data-lang="SQL"');
    expect(result).toContain('SELECT * FROM users;');
  });

  it("should preserve code tags with syntax highlighting classes", () => {
    const input = '<code class="language-typescript">const x: string = "test";</code>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<code class="language-typescript">');
    expect(result).toContain('const x: string = "test";');
  });

  it("should handle complex WordPress pre tag format", () => {
    const input = `
      <pre class="prism undefined-numbers lang-bash" data-lang="Bash">
#!/bin/bash
echo "Starting script..."
for i in {1..5}; do
  echo "Iteration $i"
done
echo "Script complete"
      </pre>
    `;
    
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="prism undefined-numbers lang-bash" data-lang="Bash">');
    expect(result).toContain('#!/bin/bash');
    expect(result).toContain('echo "Starting script..."');
    expect(result).toContain('for i in {1..5}; do');
  });

  it("should handle multiple code blocks in content", () => {
    const input = `
      <p>Here's some JavaScript:</p>
      <pre class="language-javascript">function hello() { console.log("Hi!"); }</pre>
      <p>And some Python:</p>
      <pre class="lang-python">def hello(): print("Hi!")</pre>
    `;
    
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="language-javascript">');
    expect(result).toContain('function hello()');
    expect(result).toContain('<pre class="lang-python">');
    expect(result).toContain('def hello()');
  });

  it("should preserve HTML entities in code blocks", () => {
    const input = '<pre class="language-html">&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;</pre>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<pre class="language-html">');
    expect(result).toContain('&lt;div&gt;Hello &amp; goodbye&lt;/div&gt;');
  });

  it("should not allow dangerous classes on pre tags", () => {
    const input = '<pre class="malicious-script onclick-handler">code</pre>';
    const result = sanitizeHtml(input);
    
    // The class should be stripped since it doesn't match safe patterns
    expect(result).not.toContain('malicious-script');
    expect(result).not.toContain('onclick-handler');
    // But the content should be preserved
    expect(result).toContain('code');
  });

  it("should handle nested code elements", () => {
    const input = '<p>Use <code class="language-bash">ls -la</code> to list files.</p>';
    const result = sanitizeHtml(input);
    
    expect(result).toContain('<code class="language-bash">');
    expect(result).toContain('ls -la');
  });
});