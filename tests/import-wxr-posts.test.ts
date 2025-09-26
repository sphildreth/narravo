import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

// Simulate a database of posts
interface Post {
    title: string;
    postType: string;
    content: string;
    status?: string;
    password?: string;
    isSticky?: boolean;
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

    const importPosts = (wxrItems: any[]): Post[] => {
        const posts: Post[] = [];
        for (const item of wxrItems) {
            // For this test suite, we only care about posts, not revisions or nav menu items
            if (item['wp:post_type'][0]._ === 'post') {
                posts.push({
                    title: item.title[0]._, 
                    postType: item['wp:post_type'][0]._, 
                    content: item['content:encoded'][0]._, 
                    status: item['wp:status']?.[0]._, 
                    password: item['wp:post_password']?.[0]._, 
                    isSticky: item['wp:is_sticky']?.[0]._ === '1',
                });
            }
        }
        return posts;
    };

    describe('Posts / Pages / Custom Post Types', () => {
        it('should import different post types', async () => {
            const fixtureContent = loadFixture('wxr_posts_mix.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts: Post[] = [];
            for (const item of wxrItems) {
                posts.push({
                    title: item.title[0]._, 
                    postType: item['wp:post_type'][0]._, 
                    content: item['content:encoded'][0]._, 
                });
            }
            expect(posts).toHaveLength(3);
            expect(posts[0]!.postType).toBe('post');
            expect(posts[1]!.postType).toBe('page');
            expect(posts[2]!.postType).toBe('product');
        });

        it('should import different post statuses', async () => {
            const fixtureContent = loadFixture('wxr_post_statuses.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(5);
            expect(posts[0]!.status).toBe('publish');
            expect(posts[1]!.status).toBe('draft');
            expect(posts[2]!.status).toBe('private');
            expect(posts[3]!.status).toBe('pending');
            expect(posts[4]!.status).toBe('future');
        });

        it('should import password protected posts', async () => {
            const fixtureContent = loadFixture('wxr_post_password.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(1);
            expect(posts[0]!.password).toBe('password');
        });

        it('should import sticky posts', async () => {
            const fixtureContent = loadFixture('wxr_sticky.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(1);
            expect(posts[0]!.isSticky).toBe(true);
        });

        it('should handle revisions', async () => {
            const fixtureContent = loadFixture('wxr_revisions.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(1);
            expect(posts[0]!.content).toBe('This is the final content.');
        });

        it('should handle nav menu items', async () => {
            const fixtureContent = loadFixture('wxr_nav_menu_items.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(0);
        });

        it('should preserve Gutenberg blocks', async () => {
            const fixtureContent = loadFixture('wxr_gutenberg_blocks.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const posts = importPosts(wxrItems);
            expect(posts).toHaveLength(1);
            expect(posts[0]!.content).toContain('<!-- wp:paragraph -->');
        });
    });
});