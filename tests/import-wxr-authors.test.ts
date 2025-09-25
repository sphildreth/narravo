
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

// Simulate a database of users
interface User {
    id: number;
    login: string;
    email?: string;
    displayName: string;
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

    const importAuthors = (wxrAuthors: any[], db: User[]): User[] => {
        const users: User[] = [...db];
        for (const author of wxrAuthors) {
            const login = author['wp:author_login'][0]._; 
            const existingUser = users.find(u => u.login === login);
            if (!existingUser) {
                users.push({
                    id: parseInt(author['wp:author_id'][0]._), 
                    login: login,
                    email: author['wp:author_email']?.[0]._, 
                    displayName: author['wp:author_display_name'][0]._,
                });
            }
        }
        return users;
    };

    describe('Authors & Users', () => {
        it('should map authors to internal users', async () => {
            const fixtureContent = loadFixture('wxr_authors_basic.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrAuthors = parsed.rss.channel[0]['wp:author'];
            const users = importAuthors(wxrAuthors, []);
            expect(users).toHaveLength(2);
            expect(users[0]!.login).toBe('author1');
            expect(users[1]!.email).toBe('author2@example.com');
        });

        it('should handle missing optional fields', async () => {
            const fixtureContent = loadFixture('wxr_author_missing_email.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrAuthors = parsed.rss.channel[0]['wp:author'];
            const users = importAuthors(wxrAuthors, []);
            expect(users).toHaveLength(1);
            expect(users[0]!.login).toBe('author1');
            expect(users[0]!.email).toBeUndefined();
        });

        it('should be idempotent and not create duplicate users', async () => {
            const fixtureContent = loadFixture('wxr_authors_basic.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrAuthors = parsed.rss.channel[0]['wp:author'];
            const db: User[] = [];
            const users1 = importAuthors(wxrAuthors, db);
            expect(users1).toHaveLength(2);
            const users2 = importAuthors(wxrAuthors, users1);
            expect(users2).toHaveLength(2);
        });
    });
});
