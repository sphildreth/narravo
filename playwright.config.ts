// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "@playwright/test";

const origin = "http://127.0.0.1:4197";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: origin, browserName: "chromium" },
  webServer: {
    env: { NODE_ENV: "development" },
    command: "pnpm exec vite --host 127.0.0.1 --port 4197 --strictPort",
    url: origin + "/tests/e2e/editor.html",
  },
});
