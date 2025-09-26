import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

interface Post {
    title: string;
    content: string;
    excerpt?: string;
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

    const importContent = (item: any): Post => {
        let content = item['content:encoded'][0]._; 
        let excerpt = item['excerpt:encoded']?.[0]._; 

        if (!excerpt) {
            const moreTag = content.indexOf('<!--more-->');
            if (moreTag !== -1) {
                excerpt = content.substring(0, moreTag);
                content = content.substring(moreTag + 11);
            }
        }

        return {
            title: item.title[0]._, 
            content: content,
            excerpt: excerpt,
        };
    };

    describe('Content Fields', () => {
        it('should handle the more tag', async () => {
            const fixtureContent = loadFixture('wxr_more_excerpt.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item1 = parsed.rss.channel[0].item[0];
            const post1 = importContent(item1);
            expect(post1.excerpt).toBe('This is the excerpt.');
            expect(post1.content).toBe('This is the rest of the content.');

            const item2 = parsed.rss.channel[0].item[1];
            const post2 = importContent(item2);
            expect(post2.excerpt).toBe('This is the excerpt.');
            expect(post2.content).toBe('This is the rest of the content.<!--more-->This should be ignored.');
        });

        it('should preserve shortcodes', async () => {
            const fixtureContent = loadFixture('wxr_shortcodes.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            const post = importContent(item);
            expect(post.content).toContain('[gallery]');
            expect(post.content).toContain('[audio src="audio.mp3"]');
            expect(post.content).toContain('[shortcode attr="x"]text[/shortcode]');
        });

        it('should handle CDATA content', async () => {
            const fixtureContent = loadFixture('wxr_cdata_content.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            const post = importContent(item);
            expect(post.content).toBe('<p>This is some HTML content.</p>');
        });
    });
});