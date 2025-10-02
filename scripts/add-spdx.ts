#!/usr/bin/env tsx
/*
  SPDX Header Insertion Script
  - Walks the repo (excluding common build/vendor dirs)
  - Inserts SPDX-License-Identifier: Apache-2.0 at the top of applicable files
  - Respects shebangs, encoding lines, and keeps Next.js "use client/server" directives as first statements
*/

import { promises as fs } from "fs";
import path from "path";
import logger from "@/lib/logger";

const ROOT = process.cwd();
const SPDX_TEXT = "SPDX-License-Identifier: Apache-2.0";

// Directories to skip
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "out",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  ".vscode",
  ".idea",
]);

// File extensions that allow comments and should receive SPDX headers
// Based on the prompt's list
const EXT_STYLES: Record<string, "slash" | "hash" | "block" | "html"> = {
  ".ts": "slash",
  ".tsx": "slash",
  ".cts": "slash",
  ".mts": "slash",
  ".js": "slash",
  ".jsx": "slash",
  ".cjs": "slash",
  ".mjs": "slash",
  ".go": "slash",
  ".rs": "slash",
  ".sh": "hash",
  ".bash": "hash",
  ".zsh": "hash",
  ".ps1": "hash",
  ".yaml": "hash",
  ".yml": "hash",
  ".toml": "hash",
  ".py": "hash",
  ".css": "block",
  ".scss": "block",
  ".sass": "block",
  ".md": "html",
};

function makeHeader(style: "slash" | "hash" | "block" | "html"): string {
  switch (style) {
    case "slash":
      return `// ${SPDX_TEXT}`;
    case "hash":
      return `# ${SPDX_TEXT}`;
    case "block":
      return `/* ${SPDX_TEXT} */`;
    case "html":
      return `<!-- ${SPDX_TEXT} -->`;
  }
}

function shouldSkipFile(file: string): boolean {
  const bn = path.basename(file);
  // Skip JSON and lockfiles or binary-like common formats
  if (bn.endsWith(".json") || bn.endsWith(".lock") || bn.endsWith(".lockb")) return true;
  if (bn.endsWith(".png") || bn.endsWith(".jpg") || bn.endsWith(".jpeg") || bn.endsWith(".gif") || bn.endsWith(".svg") || bn.endsWith(".ico")) return true;
  if (bn === "LICENSE" || bn === "NOTICE") return true;
  return false;
}

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out = await walk(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function getStyleForFile(file: string): { style: "slash" | "hash" | "block" | "html"; header: string } | null {
  const ext = path.extname(file).toLowerCase();
  const style = EXT_STYLES[ext];
  if (!style) return null;
  return { style, header: makeHeader(style) };
}

function hasSpdx(content: string): boolean {
  return content.includes("SPDX-License-Identifier:");
}

function isWhitespaceOrComment(line: string, style: "slash" | "hash" | "block" | "html"): boolean {
  const l = line.trim();
  if (l === "") return true;
  if (style === "slash") return l.startsWith("//") || l.startsWith("/*");
  if (style === "hash") return l.startsWith("#");
  if (style === "block") return l.startsWith("/*");
  if (style === "html") return l.startsWith("<!--");
  return false;
}

function isUseDirective(line: string): boolean {
  const l = line.trim();
  // Match 'use client' or 'use server' with single/double quotes and optional semicolon
  return (
    l === "'use client'" || l === '"use client"' || l === "'use server'" || l === '"use server"' ||
    l === "'use client';" || l === '"use client";' || l === "'use server';" || l === '"use server";'
  );
}

function isPyEncoding(line: string): boolean {
  const l = line.trim();
  return /^#.*coding[:=]/.test(l);
}

async function processFile(file: string): Promise<boolean> {
  if (shouldSkipFile(file)) return false;
  const styleInfo = getStyleForFile(file);
  if (!styleInfo) return false;
  const { style, header } = styleInfo;
  const raw = await fs.readFile(file, "utf8");
  if (hasSpdx(raw)) return false;

  const lines = raw.split(/\r?\n/);
  let idx = 0;

  // Preserve shebangs
  if ((lines[0] ?? "").startsWith("#!")) {
    idx = 1;
    // Also preserve possible Python encoding line immediately after shebang
    if (path.extname(file) === ".py" && isPyEncoding(lines[1] ?? "")) {
      idx = 2;
    }
  } else if (path.extname(file) === ".py" && isPyEncoding(lines[0] ?? "")) {
    // Python files may have encoding line without shebang
    idx = 1;
  }

  // For JS/TS files, ensure 'use client'/'use server' remains the first statement
  const jsLike = [".ts", ".tsx", ".cts", ".mts", ".js", ".jsx", ".cjs", ".mjs"];
  if (jsLike.includes(path.extname(file))) {
    // Advance past any leading whitespace-only lines
    let scan = idx;
    while (scan < lines.length && (lines[scan] ?? "").trim() === "") scan++;

    // Find first non-empty, non-line-comment block to check for 'use' directive
    let scan2 = idx;
    while (
      scan2 < lines.length &&
      (((lines[scan2] ?? "").trim() === "") || (lines[scan2] ?? "").trim().startsWith("//") || (lines[scan2] ?? "").trim().startsWith("/*"))
    ) {
      scan2++;
    }
    if (scan2 < lines.length && isUseDirective(lines[scan2] ?? "")) {
      // place SPDX after the directive line
      idx = scan2 + 1;
    }
  }

  // Insert header at the computed position while preserving trailing newline semantics
  const updated = [...lines];
  updated.splice(idx, 0, header);

  let out = updated.join("\n");
  if (raw.endsWith("\n") && !out.endsWith("\n")) {
    out += "\n";
  }

  await fs.writeFile(file, out, "utf8");
  return true;
}

async function main() {
  const all = await walk(ROOT);
  let changed = 0;
  for (const f of all) {
    try {
      const did = await processFile(f);
      if (did) changed++;
    } catch (err) {
      // Non-fatal; just log and continue
      logger.error(`SPDX: failed to process ${f}:`, (err as Error).message);
    }
  }
  logger.info(`SPDX: processed ${all.length} files, added header to ${changed} files.`);
}

main().catch((e) => {
  logger.error(e);
  process.exit(1);
});
