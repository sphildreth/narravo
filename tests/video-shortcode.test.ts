// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from 'vitest';
import { expandShortcodes } from '@/lib/markdown';

// Test the video shortcode processing
describe('Video Shortcode', () => {
  describe('Markdown expansion', () => {
    it('should expand video shortcode to HTML video element', () => {
      const input = '[video mp4="http://localhost:3000/uploads/test.mp4"][/video]';
      const result = expandShortcodes(input);
      
      expect(result).toContain('<video');
      expect(result).toContain('controls');
      expect(result).toContain('data-shortcode-preview="true"');
      expect(result).toContain('src="http://localhost:3000/uploads/test.mp4"');
      expect(result).toContain('data-shortcode-src="http://localhost:3000/uploads/test.mp4"');
      expect(result).toContain('<source src="http://localhost:3000/uploads/test.mp4" type="video/mp4"');
    });

    it('should handle video shortcode with multiple sources', () => {
      const input = '[video mp4="http://example.com/test.mp4" webm="http://example.com/test.webm" ogv="http://example.com/test.ogv"][/video]';
      const result = expandShortcodes(input);
      
      expect(result).toContain('<source src="http://example.com/test.mp4" type="video/mp4"');
      expect(result).toContain('<source src="http://example.com/test.webm" type="video/webm"');
      expect(result).toContain('<source src="http://example.com/test.ogv" type="video/ogg"');
    });

    it('should handle video shortcode with additional attributes', () => {
      const input = '[video mp4="http://example.com/test.mp4" width="640" height="480" poster="http://example.com/poster.jpg" autoplay muted][/video]';
      const result = expandShortcodes(input);
      
      expect(result).toContain('width="640"');
      expect(result).toContain('height="480"');
      expect(result).toContain('poster="http://example.com/poster.jpg"');
      expect(result).toContain('autoplay');
      expect(result).toContain('muted');
      expect(result).toContain('playsinline'); // Should be added automatically with autoplay
    });

    it('should ignore invalid video shortcodes', () => {
      const input = '[video][/video]'; // No sources
      const result = expandShortcodes(input);
      
      expect(result).toBe(input); // Should return original
    });

    it('should handle mixed content with video shortcode', () => {
      const input = '# Test\n\n[video mp4="http://example.com/test.mp4"][/video]\n\nSome text after.';
      const result = expandShortcodes(input);
      
      expect(result).toContain('# Test');
      expect(result).toContain('<video');
      expect(result).toContain('Some text after.');
    });

    it('should handle the specific video shortcode from the test document', () => {
      const input = '[video mp4="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4"][/video]';
      const result = expandShortcodes(input);
      
      expect(result).toContain('<video');
      expect(result).toContain('controls');
      expect(result).toContain('data-shortcode-preview="true"');
      expect(result).toContain('src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4"');
      expect(result).toContain('data-shortcode-src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4"');
      expect(result).toContain('<source src="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4" type="video/mp4"');
    });
  });

  describe('MarkdownShortcodes Extension', () => {
    // Test that the MarkdownShortcodes extension uses the same logic
    it('should use the same expandShortcodes function as the main library', async () => {
      const { expandShortcodes } = await import('@/lib/markdown');
      
      const input = '[video mp4="http://localhost:3000/uploads/test.mp4" autoplay muted][/video]';
      const result = expandShortcodes(input);
      
      // Should include boolean attributes that were missing in the old version
      expect(result).toContain('autoplay');
      expect(result).toContain('muted');
      expect(result).toContain('playsinline');
      expect(result).toContain('data-shortcode-preview="true"');
      expect(result).toContain('data-shortcode-src');
      expect(result).toContain('data-sources');
    });
  });

  describe('TipTap Editor Integration', () => {
    // Note: TipTap editor tests would require a more complex setup with jsdom
    // For now, we test the key components that make video shortcodes work
    
    it('should generate video shortcode HTML that matches VideoShortcode extension patterns', () => {
      const input = '[video mp4="http://localhost:3000/uploads/test.mp4"][/video]';
      const result = expandShortcodes(input);
      
      // The VideoShortcode extension looks for these patterns in parseHTML
      expect(result).toMatch(/<div[^>]*data-video-shortcode="true"[^>]*>/);
      expect(result).toMatch(/<video[^>]*data-shortcode-preview="true"[^>]*>/);
      expect(result).toMatch(/<video[^>]*data-shortcode-src="[^"]*"[^>]*>/);
      expect(result).toMatch(/<video[^>]*data-sources="[^"]*"[^>]*>/);
      expect(result).toContain('class="video-shortcode-frame"');
    });

    it('should handle the kitchen sink test document video shortcode', () => {
      const kitchenSinkMarkdown = `## Video (Shortcode, not iframe)

[video mp4="http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4"][/video]

> Use the **Video** button to insert; the editor will generate this shortcode automatically. Confirm playback in your renderer.`;

      const result = expandShortcodes(kitchenSinkMarkdown);
      
      expect(result).toContain('## Video (Shortcode, not iframe)');
      expect(result).toContain('<video');
      expect(result).toContain('data-shortcode-preview="true"');
      expect(result).toContain('http://localhost:3000/uploads/file_example_MP4_480_1_5MG.mp4');
      expect(result).toContain('> Use the **Video** button');
    });
  });
});