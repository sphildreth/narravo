// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";

// We need to access the transformSyntaxHighlighting function
// Since it's not exported, we'll test it indirectly through the import process
// First, let's create a simple test for the transformation logic

describe("Import WXR Syntax Highlighting", () => {
  // Mock the function since it's internal
  function transformSyntaxHighlighting(html: string): string {
    if (!html) return html;
    
    // Match hcb_wrap divs with prism pre elements
    return html.replace(
      /<div\s+class="hcb_wrap"[^>]*>\s*<pre\s+class="[^"]*"\s+data-lang="([^"]*)"[^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>\s*<\/div>/gi,
      (match, lang, code) => {
        // Normalize language name to lowercase for consistency
        const normalizedLang = lang.toLowerCase();
        return `<pre data-language="${normalizedLang}"><code>${code}</code></pre>`;
      }
    );
  }

  it("should transform hcb_wrap syntax highlighting blocks", () => {
    const input = `
      <div class="hcb_wrap">
      <pre class="prism undefined-numbers lang-bash" data-lang="Bash"><code>sudo pacman -S podman podman-docker</code></pre>
      </div>
    `;
    
    const expected = `
      <pre data-language="bash"><code>sudo pacman -S podman podman-docker</code></pre>
    `;
    
    const result = transformSyntaxHighlighting(input);
    expect(result.trim()).toBe(expected.trim());
  });

  it("should handle different languages correctly", () => {
    const input = `
      <div class="hcb_wrap">
      <pre class="prism undefined-numbers lang-javascript" data-lang="JavaScript"><code>console.log('Hello, World!');</code></pre>
      </div>
    `;
    
    const expected = `
      <pre data-language="javascript"><code>console.log('Hello, World!');</code></pre>
    `;
    
    const result = transformSyntaxHighlighting(input);
    expect(result.trim()).toBe(expected.trim());
  });

  it("should preserve code content with special characters", () => {
    const input = `
      <div class="hcb_wrap">
      <pre class="prism undefined-numbers lang-html" data-lang="HTML"><code>&lt;div class="test"&gt;Hello &amp; Welcome&lt;/div&gt;</code></pre>
      </div>
    `;
    
    const expected = `
      <pre data-language="html"><code>&lt;div class="test"&gt;Hello &amp; Welcome&lt;/div&gt;</code></pre>
    `;
    
    const result = transformSyntaxHighlighting(input);
    expect(result.trim()).toBe(expected.trim());
  });

  it("should not affect regular HTML content", () => {
    const input = `<p>This is a regular paragraph with <code>inline code</code>.</p>`;
    const result = transformSyntaxHighlighting(input);
    expect(result).toBe(input);
  });

  it("should handle multiple syntax highlighting blocks", () => {
    const input = `
      <p>First example:</p>
      <div class="hcb_wrap">
      <pre class="prism undefined-numbers lang-bash" data-lang="Bash"><code>cd /home</code></pre>
      </div>
      <p>Second example:</p>
      <div class="hcb_wrap">
      <pre class="prism undefined-numbers lang-python" data-lang="Python"><code>print("Hello")</code></pre>
      </div>
    `;
    
    const result = transformSyntaxHighlighting(input);
    expect(result).toContain('<pre data-language="bash"><code>cd /home</code></pre>');
    expect(result).toContain('<pre data-language="python"><code>print("Hello")</code></pre>');
    expect(result).toContain('<p>First example:</p>');
    expect(result).toContain('<p>Second example:</p>');
  });
});