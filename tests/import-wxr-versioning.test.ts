
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

    describe('Versioning & Compatibility', () => {
        const parser = new Parser({ explicitCharkey: true });

        it('should read the WXR version', async () => {
            const fixtureContent = loadFixture('wxr_v1_2.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const version = parsed.rss.channel[0]['wp:wxr_version'][0]._; 
            expect(version).toBe('1.2');
        });

        it('should handle different WXR versions', async () => {
            const fixtureContent11 = loadFixture('wxr_v1_1.xml');
            const parsed11 = await parser.parseStringPromise(fixtureContent11);
            const version11 = parsed11.rss.channel[0]['wp:wxr_version'][0]._; 
            expect(version11).toBe('1.1');

            const fixtureContent12 = loadFixture('wxr_v1_2.xml');
            const parsed12 = await parser.parseStringPromise(fixtureContent12);
            const version12 = parsed12.rss.channel[0]['wp:wxr_version'][0]._; 
            expect(version12).toBe('1.2');
        });
    });
});
