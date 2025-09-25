import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

interface Comment {
    id: number;
    author?: string;
    authorEmail?: string;
    authorUrl?: string;
    content?: string;
    approved?: boolean;
    parentId?: number;
    type?: string;
}

describe('WXR Importer', () => {
    const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'wxr');
    const parser = new Parser({ explicitCharkey: true });

    const loadFixture = (name: string): string => {
        const filePath = path.join(FIXTURE_DIR, name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Fixture not found: ${name}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    };

    const importComments = (item: any): Comment[] => {
        const comments: Comment[] = [];
        if (item['wp:comment']) {
            for (const comment of item['wp:comment']) {
                comments.push({
                    id: parseInt(comment['wp:comment_id'][0]._), 
                    author: comment['wp:comment_author']?.[0]._, 
                    authorEmail: comment['wp:comment_author_email']?.[0]._, 
                    authorUrl: comment['wp:comment_author_url']?.[0]._, 
                    content: comment['wp:comment_content']?.[0]._, 
                    approved: comment['wp:comment_approved']?.[0]._ === '1',
                    parentId: parseInt(comment['wp:comment_parent']?.[0]._), 
                    type: comment['wp:comment_type']?.[0]._, 
                });
            }
        }
        return comments;
    };

    describe('Comments, Pingbacks, Trackbacks', () => {
        it('should handle threaded comments', async () => {
            const fixtureContent = loadFixture('wxr_comments_basic.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            const comments = importComments(item);
            expect(comments).toHaveLength(2);
            const child = comments.find(c => c.id === 2);
            expect(child?.parentId).toBe(1);
        });

        it('should preserve author info', async () => {
            const fixtureContent = loadFixture('wxr_comments_basic.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            const comments = importComments(item);
            const guest = comments.find(c => c.id === 1);
            expect(guest?.author).toBe('Guest Author');
            expect(guest?.authorEmail).toBe('guest@example.com');
            expect(guest?.authorUrl).toBe('http://example.com');
        });

        it('should handle pingbacks and trackbacks', async () => {
            const fixtureContent = loadFixture('wxr_pingbacks.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            const comments = importComments(item);
            expect(comments).toHaveLength(2);
            const pingback = comments.find(c => c.id === 1);
            const trackback = comments.find(c => c.id === 2);
            expect(pingback?.type).toBe('pingback');
            expect(trackback?.type).toBe('trackback');
        });
    });
});