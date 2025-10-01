#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Audit script to find admin routes that don't use requireAdmin2FA
 * Usage: node scripts/audit-admin-2fa.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ADMIN_DIR = "src/app/(admin)";
const EXEMPTED_ROUTES = [
  "admin/security/2fa/setup", // Initial 2FA setup - must use requireAdmin
  "admin/security/page.tsx",  // Security dashboard - shows 2FA status
];

function findAdminRoutes(dir, routes = []) {
  const entries = readdirSync(dir);
  
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      findAdminRoutes(fullPath, routes);
    } else if (entry === "page.tsx" || entry === "route.ts") {
      routes.push(fullPath);
    }
  }
  
  return routes;
}

function analyzeRoute(filePath) {
  const content = readFileSync(filePath, "utf-8");
  
  // Check if it's an exempted route
  const isExempted = EXEMPTED_ROUTES.some(exempted => filePath.includes(exempted));
  
  // Check what auth method is used
  const hasRequireAdmin2FA = content.includes("requireAdmin2FA");
  const hasRequireAdmin = content.includes("requireAdmin") && !hasRequireAdmin2FA;
  const hasRequireSession = content.includes("requireSession");
  const hasNoAuth = !hasRequireAdmin2FA && !hasRequireAdmin && !hasRequireSession;
  
  return {
    filePath,
    isExempted,
    hasRequireAdmin2FA,
    hasRequireAdmin,
    hasRequireSession,
    hasNoAuth,
    needsUpdate: !isExempted && !hasRequireAdmin2FA && (hasRequireAdmin || hasNoAuth),
  };
}

console.log("🔍 Auditing admin routes for 2FA enforcement...\n");

const routes = findAdminRoutes(ADMIN_DIR);
const analysis = routes.map(analyzeRoute);

const needsUpdate = analysis.filter(r => r.needsUpdate);
const compliant = analysis.filter(r => r.hasRequireAdmin2FA || r.isExempted);
const noAuth = analysis.filter(r => r.hasNoAuth);

console.log("📊 Summary:");
console.log(`   Total admin routes: ${routes.length}`);
console.log(`   ✅ Compliant (using requireAdmin2FA): ${compliant.length}`);
console.log(`   ⚠️  Using requireAdmin (needs update): ${needsUpdate.length}`);
console.log(`   ❌ No authentication (critical): ${noAuth.length}`);

if (needsUpdate.length > 0) {
  console.log("\n⚠️  Routes that should use requireAdmin2FA:");
  needsUpdate.forEach(r => {
    console.log(`   - ${r.filePath.replace("src/app/(admin)/", "")}`);
  });
}

if (noAuth.length > 0) {
  console.log("\n❌ Routes with NO authentication (CRITICAL):");
  noAuth.forEach(r => {
    console.log(`   - ${r.filePath.replace("src/app/(admin)/", "")}`);
  });
}

if (compliant.length === routes.length) {
  console.log("\n✅ All admin routes are properly protected with 2FA!");
} else {
  console.log("\n⚠️  Action required: Update routes to use requireAdmin2FA");
  console.log("\nRecommendation:");
  console.log("1. Replace `requireAdmin()` with `requireAdmin2FA()` in all non-exempted routes");
  console.log("2. This ensures 2FA is enforced before accessing sensitive admin functions");
  process.exit(1);
}
