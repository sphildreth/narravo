// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));
let gitSha = "unknown";
try { 
  gitSha = execSync("git rev-parse --short HEAD").toString().trim(); 
} catch {
  // Ignore git errors in non-git environments
}

const content = `// Auto-generated. Do not edit.
export const APP_VERSION = "${pkg.version}";
export const GIT_SHA = "${gitSha}";
export const BUILD_TIME = "${new Date().toISOString()}";
`;

writeFileSync("./src/version.ts", content);
console.log("Wrote src/version.ts =>", pkg.version, gitSha);