// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';

test.describe('TipTap Editor E2E Tests', () => {
  test('should display toolbar with all expected buttons', async ({ page }) => {
    await page.goto("/tests/e2e/editor.html");

    // Check for presence of key toolbar buttons
    await expect(page.getByTitle('Bold (Ctrl+B)')).toBeVisible();
    await expect(page.getByTitle('Italic (Ctrl+I)')).toBeVisible();
    await expect(page.getByTitle('Heading 1')).toBeVisible();
    await expect(page.getByTitle('Align Left')).toBeVisible();
    await expect(page.getByTitle('Insert Image')).toBeVisible();
    await expect(page.getByTitle('Code Block', { exact: true })).toBeVisible();
  });

  test('should allow text formatting', async ({ page }) => {
    await page.goto("/tests/e2e/editor.html");
    
    // Type some text
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await editor.type('Hello World');

    // Select the text
    await page.keyboard.press('Control+a');

    // Click bold button
    await page.getByTitle('Bold (Ctrl+B)').click();

    // Verify the text is now bold
    await expect(editor.locator('strong')).toHaveText('Hello World');
  });

  test('should show language dropdown when in code block', async ({ page }) => {
    await page.goto("/tests/e2e/editor.html");
    
    // Click code block button
    await page.getByTitle('Code Block', { exact: true }).click();

    // Verify language dropdown appears
    await expect(page.getByTitle('Code Block Language')).toBeVisible();
  });

  test('should handle image upload with alt text prompt', async ({ page }) => {
    await page.goto("/tests/e2e/editor.html");
    
    // Set up dialog handler for alt text prompt
    page.on('dialog', dialog => dialog.accept('Test alt text'));
    
    await page.route("**/api/r2/sign", route => route.fulfill({
      json: { method: "POST", url: "/fixture/image-upload" },
    }));
    await page.route("**/fixture/image-upload", route => route.fulfill({
      json: { url: "/fixture/image.png" },
    }));
    const chooser = page.waitForEvent("filechooser");
    await page.getByTitle("Insert Image").click();
    await (await chooser).setFiles({
      name: "sample.png", mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64"),
    });
    await expect(page.locator(".ProseMirror img")).toHaveAttribute("alt", "Test alt text");
  });

  test('should sanitize pasted content', async ({ page }) => {
    await page.goto("/tests/e2e/editor.html");
    
    const editor = page.locator('.ProseMirror');
    await editor.click();

    // Simulate pasting malicious content
    await page.evaluate(() => {
      const maliciousHtml = '<script>alert("xss")</script><p>Safe content</p>';
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', maliciousHtml);
      
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true
      });
      
      document.querySelector('.ProseMirror')?.dispatchEvent(pasteEvent);
    });

    // Verify script tags are removed but safe content remains
    await expect(editor.locator('script')).toHaveCount(0);
    await expect(editor.locator('p')).toContainText('Safe content');
  });
});