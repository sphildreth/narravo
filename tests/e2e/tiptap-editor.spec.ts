// SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';

test.describe('TipTap Editor E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // We would need to navigate to a page that includes the TipTap editor
    // For now, this is a template for future implementation
    // await page.goto('/admin/posts/new');
  });

  test.skip('should display toolbar with all expected buttons', async ({ page }) => {
    // Wait for the editor to load
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    // Check for presence of key toolbar buttons
    await expect(page.getByTitle('Bold (Ctrl+B)')).toBeVisible();
    await expect(page.getByTitle('Italic (Ctrl+I)')).toBeVisible();
    await expect(page.getByTitle('Heading 1')).toBeVisible();
    await expect(page.getByTitle('Align Left')).toBeVisible();
    await expect(page.getByTitle('Insert Image')).toBeVisible();
    await expect(page.getByTitle('Code Block')).toBeVisible();
  });

  test.skip('should allow text formatting', async ({ page }) => {
    await page.waitForSelector('[data-testid="tiptap-editor"]');
    
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

  test.skip('should show language dropdown when in code block', async ({ page }) => {
    await page.waitForSelector('[data-testid="tiptap-editor"]');
    
    // Click code block button
    await page.getByTitle('Code Block').click();

    // Verify language dropdown appears
    await expect(page.getByTitle('Code Block Language')).toBeVisible();
  });

  test.skip('should handle image upload with alt text prompt', async ({ page }) => {
    await page.waitForSelector('[data-testid="tiptap-editor"]');
    
    // Mock the file input
    const fileInput = page.locator('input[type="file"][accept="image/*"]');
    
    // Set up dialog handler for alt text prompt
    page.on('dialog', dialog => dialog.accept('Test alt text'));
    
    // Trigger image upload
    await page.getByTitle('Insert Image').click();
    
    // This would need proper file upload simulation
    // await fileInput.setInputFiles('test-image.jpg');
    
    // Verify alt text prompt was handled
    // await expect(page.locator('img[alt="Test alt text"]')).toBeVisible();
  });

  test.skip('should sanitize pasted content', async ({ page }) => {
    await page.waitForSelector('[data-testid="tiptap-editor"]');
    
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