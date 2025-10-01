#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Fix admin routes to use requireAdmin2FA
 * Usage: node scripts/fix-admin-2fa.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ADMIN_DIR = "src/app/(admin)";
const EXEMPTED_ROUTES = [
  "admin/security/2fa/setup", // Initial 2FA setup
  "admin/security/page.tsx",  // Security dashboard
];

const DRY_RUN = process.argv.includes("--dry-run");

function findAdminRoutes(dir, routes = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      findAdminRoutes(fullPath, routes);
    } else if (entry === "page.tsx") {
      routes.push(fullPath);
    }
  }
  
  return routes;
}

function fixRoute(filePath) {
  const content = readFileSync(filePath, "utf-8");
  
  // Check if exempted
  const isExempted = EXEMPTED_ROUTES.some(exempted => filePath.includes(exempted));
  if (isExempted) {
    return { filePath, changed: false, reason: "Exempted route" };
  }
  
  // Already using requireAdmin2FA
  if (content.includes("requireAdmin2FA")) {
    return { filePath, changed: false, reason: "Already using requireAdmin2FA" };
  }
  
  let newContent = content;
  let changed = false;
  
  // Case 1: Replace requireAdmin import and usage
  if (content.includes("requireAdmin")) {
    newContent = newContent.replace(
      /import { requireAdmin } from "@\/lib\/auth";/g,
      'import { requireAdmin2FA } from "@/lib/auth";'
    );
    newContent = newContent.replace(
      /await requireAdmin\(\);/g,
      "await requireAdmin2FA();"
    );
    newContent = newContent.replace(
      /const session = await requireAdmin\(\);/g,
      "const session = await requireAdmin2FA();"
    );
    changed = true;
  }
  // Case 2: No auth - add it
  else if (!content.includes("requireAdmin2FA") && !content.includes("requireSession")) {
    // Find the export default function line
    const functionMatch = content.match(/export default (async )?function/);
    if (functionMatch) {
      // Add import at the top (after SPDX and before first non-comment line)
      const lines = content.split("\n");
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("//") || lines[i].startsWith("/*") || lines[i].trim() === "") {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
      lines.splice(insertIndex, 0, 'import { requireAdmin2FA } from "@/lib/auth";');
      
      // Add requireAdmin2FA call at the start of the function
      const funcLineIndex = lines.findIndex(l => l.includes("export default"));
      if (funcLineIndex >= 0) {
        // Find the opening brace
        let braceIndex = funcLineIndex;
        while (braceIndex < lines.length && !lines[braceIndex].includes("{")) {
          braceIndex++;
        }
        if (braceIndex < lines.length) {
          // Insert after the opening brace
          const indent = lines[braceIndex + 1]?.match(/^\s*/)?.[0] || "  ";
          lines.splice(braceIndex + 1, 0, `${indent}await requireAdmin2FA();`);
          lines.splice(braceIndex + 2, 0, "");
        }
      }
      
      newContent = lines.join("\n");
      changed = true;
    }
  }
  
  if (changed && !DRY_RUN) {
    writeFileSync(filePath, newContent, "utf-8");
    return { filePath, changed: true, reason: "Updated to use requireAdmin2FA" };
  }
  
  return { filePath, changed, reason: changed ? "Would update (dry run)" : "No changes needed" };
}

console.log(DRY_RUN ? "🔍 DRY RUN: Analyzing changes..." : "🔧 Fixing admin routes...");
console.log();

const routes = findAdminRoutes(ADMIN_DIR);
const results = routes.map(fixRoute);

const changed = results.filter(r => r.changed || r.reason.includes("Would update"));
const unchanged = results.filter(r => !r.changed && !r.reason.includes("Would update"));

console.log("📊 Summary:");
console.log(`   Total routes: ${routes.length}`);
console.log(`   ${DRY_RUN ? "Would update" : "Updated"}: ${changed.length}`);
console.log(`   Unchanged: ${unchanged.length}`);

if (changed.length > 0) {
  console.log(`\n${DRY_RUN ? "⚠️  Would update:" : "✅ Updated:"}`);
  changed.forEach(r => {
    console.log(`   - ${r.filePath.replace("src/app/(admin)/", "")}`);
  });
}

if (DRY_RUN) {
  console.log("\n💡 Run without --dry-run to apply changes");
} else {
  console.log("\n✅ All admin routes have been updated to use requireAdmin2FA!");
  console.log("\n⚠️  IMPORTANT: Run tests to verify:");
  console.log("   pnpm typecheck && pnpm test");
}
