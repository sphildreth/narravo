// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "@playwright/test";

test("restores media separately and requires explicit selection for a bulk purge", async ({ page }, info) => {
  await page.goto("/tests/e2e/editor.html?data-operations");
  await page.getByLabel("Mode", { exact: true }).selectOption("hard");
  const preview = page.getByRole("button", { name: "Preview Purge" });
  await expect(preview).toBeDisabled();
  await page.getByLabel("Target ID (UUID)").fill("unfinished");
  await expect(preview).toBeDisabled();
  await page.getByLabel("Target ID (UUID)").clear();
  await page.getByLabel("Select all posts").check();
  await expect(preview).toBeEnabled();
  await page.getByLabel("Restore media separately").check();
  await page.locator("main").screenshot({ path: info.outputPath("data-operations.png") });
  await page.route("**/api/admin/purge", route => route.fulfill({
    json: { ok: true, dryRun: true, recordsAffected: 0, preview: { type: "post", mode: "hard" } },
  }));
  const sent = page.waitForRequest("**/api/admin/purge");
  await preview.click();
  expect((await sent).postDataJSON()).toEqual({ type: "post", mode: "hard", dryRun: true, allPosts: true });
});
