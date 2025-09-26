
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

describe('WXR Importer', () => {
    const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'wxr');

    const loadFixture = (name: string): string => {
        const filePath = path.join(FIXTURE_DIR, name);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Fixture not found: ${name}`);
        }
        return fs.readFileSync(filePath, 'utf-8');
    };

    describe('Fixture Loader', () => {
        it('should load a fixture file', () => {
            const fixtureContent = loadFixture('wxr_minimal.xml');
            expect(fixtureContent).toContain('<title>Test Blog</title>');
        });

        it('should throw an error for a missing fixture', () => {
            expect(() => loadFixture('non_existent_fixture.xml')).toThrow('Fixture not found: non_existent_fixture.xml');
        });
    });

    describe('XML Parsing & Namespaces', () => {
        const parser = new Parser({ explicitCharkey: true, strict: true });

        it('should parse a minimal WXR file', async () => {
            const fixtureContent = loadFixture('wxr_minimal.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            expect(parsed.rss.channel[0].title[0]._).toBe('Test Blog');
        });

        it('should handle namespaced elements correctly', async () => {
            const fixtureContent = loadFixture('wxr_namespaced.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const item = parsed.rss.channel[0].item[0];
            expect(item['content:encoded'][0]._).toBe('This post uses different namespaces.');
        });

        it('should reject malformed XML', async () => {
            const fixtureContent = loadFixture('wxr_malformed.xml');
            await expect(parser.parseStringPromise(fixtureContent)).rejects.toThrow();
        });

        it('should preserve UTF-8 encoding', async () => {
            const fixtureContent = loadFixture('wxr_encoding.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const content = parsed.rss.channel[0].item[0]['content:encoded'][0]._; 
            expect(content).toBe('Here are some emoji: 😊👍 and some accents: áéíóú.');
        });
    });
});
