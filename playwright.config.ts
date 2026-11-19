// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:4198";
const fixtureOrigin = "http://127.0.0.1:4197";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: origin, browserName: "chromium" },
  webServer: [
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 4198",
      url: origin + "/healthz",
      env: { NODE_ENV: "production", AUTH_TRUST_HOST: "true" },
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 4197 --strictPort",
      url: fixtureOrigin + "/tests/e2e/data-operations.html",
      env: { NODE_ENV: "development" },
    },
  ],
});
