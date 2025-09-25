// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { replaceRemoteVideosWithPlaceholder, transformIframeVideos } from '@/../scripts/import-wxr';
// Bring in the same rewrite behavior used by importer via a minimal local copy to avoid deep imports
function rewriteMediaUrls(html: string, mediaUrlMap: Map<string, string>): string {
  let rewritten = html;
  for (const [oldUrl, newUrl] of mediaUrlMap) {
    rewritten = rewritten.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);
  }
  return rewritten;
}

describe('WXR video import policy', () => {
  it('keeps locally rewritten <video> src and sources', () => {
    const html = `
      <figure>
        <video controls poster="https://cdn.example.com/posters/abc.jpg">
          <source src="https://cdn.example.com/media/clip-720p.mp4" type="video/mp4" />
          <source src="https://cdn.example.com/media/clip-720p.webm" type="video/webm" />
        </video>
      </figure>
    `;

    const map = new Map<string, string>([
      ['https://cdn.example.com/media/clip-720p.mp4', '/uploads/imported-media/abcd.mp4'],
      ['https://cdn.example.com/media/clip-720p.webm', '/uploads/imported-media/abcd.webm'],
      ['https://cdn.example.com/posters/abc.jpg', '/uploads/imported-media/poster.jpg'],
    ]);

  const rewritten = rewriteMediaUrls(html, map);
  const after = replaceRemoteVideosWithPlaceholder(rewritten, map);
    expect(after).toContain('/uploads/imported-media/abcd.mp4');
    expect(after).toContain('/uploads/imported-media/abcd.webm');
    expect(after).toContain('/uploads/imported-media/poster.jpg');
    expect(after).not.toContain('video-cannot-be-imported.svg');
  });

  it('replaces remote <video> with placeholder if any URL remains remote', () => {
    const html = `
      <video controls src="https://videos.remote.example/clip.mp4"></video>
    `;
    const map = new Map<string, string>(); // simulate download failure or not attempted
    const after = replaceRemoteVideosWithPlaceholder(html, map);
    expect(after).toContain('/images/video-cannot-be-imported.svg');
    expect(after).not.toContain('<video');
  });

  it('replaces non-YouTube iframe with placeholder', () => {
    const html = `<iframe src="https://vimeo.com/12345" width="560" height="315"></iframe>`;
    const after = transformIframeVideos(html);
    expect(after).toContain('/images/video-cannot-be-imported.svg');
  });

  it('keeps YouTube iframe as-is', () => {
    const html = `<iframe src="https://www.youtube.com/embed/abc123" width="560" height="315"></iframe>`;
    const after = transformIframeVideos(html);
    expect(after).toContain('youtube.com/embed/abc123');
    expect(after).toContain('<iframe');
  });
});
