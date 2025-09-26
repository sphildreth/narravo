
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

interface Post {
    title: string;
    guid?: string;
    internalId: string;
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

    const importPostsWithGuids = (items: any[], db: Post[]): Post[] => {
        const posts: Post[] = [...db];
        for (const item of items) {
            const guid = item.guid?.[0]._; 
            const itemTitle = item.title[0]._; 

            const existingPost = posts.find(p => p.guid === guid && p.title === itemTitle);

            if (existingPost) {
                // Post with same guid and title already exists, do nothing for idempotency
                continue;
            }

            let internalId = guid;
            if (!internalId || posts.some(p => p.internalId === internalId)) {
                internalId = `${itemTitle}-${Date.now()}-${Math.random()}`;
            }

            posts.push({
                title: itemTitle, 
                guid: guid,
                internalId: internalId,
            });
        }
        return posts;
    };

    describe('GUIDs, IDs, and Mapping', () => {
        it('should handle duplicate GUIDs', async () => {
            const fixtureContent = loadFixture('wxr_duplicate_guids.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const items = parsed.rss.channel[0].item;
            const posts = importPostsWithGuids(items, []);
            expect(posts).toHaveLength(2);
            expect(posts[0]!.internalId).not.toBe(posts[1]!.internalId);
        });

        it('should handle missing GUIDs', async () => {
            const fixtureContent = loadFixture('wxr_missing_guid.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const items = parsed.rss.channel[0].item;
            const posts = importPostsWithGuids(items, []);
            expect(posts).toHaveLength(1);
            expect(posts[0]!.internalId).not.toBeUndefined();
        });

        it('should be idempotent on re-import', async () => {
            const fixtureContent = loadFixture('wxr_duplicate_guids.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const items = parsed.rss.channel[0].item;
            const db: Post[] = [];
            const posts1 = importPostsWithGuids(items, db);
            const posts2 = importPostsWithGuids(items, posts1);
            expect(posts2).toHaveLength(posts1.length);
        });
    });
});
