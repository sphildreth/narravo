import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect, vi } from 'vitest';

interface Attachment {
    title: string;
    url: string;
    parentId?: number;
    status?: string;
}

interface Media {
    title: string;
    url: string;
    downloaded: boolean;
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

    const downloadMedia = async (url: string): Promise<boolean> => {
        if (url.includes('missing')) {
            return false;
        }
        return true;
    };

    const importAttachments = async (wxrItems: any[]): Promise<Media[]> => {
        const attachments: Attachment[] = [];
        for (const item of wxrItems) {
            if (item['wp:post_type'][0]._ === 'attachment') {
                attachments.push({
                    title: item.title[0]._, 
                    url: item['wp:attachment_url'][0]._, 
                    parentId: item['wp:post_parent']?.[0]._, 
                    status: item['wp:status']?.[0]._, 
                });
            }
        }

        const media: Media[] = [];
        for (const attachment of attachments) {
            const downloaded = await downloadMedia(attachment.url);
            if (downloaded) {
                media.push({ title: attachment.title, url: attachment.url, downloaded: true });
            }
        }
        return media;
    };

    describe('Attachments & Media', () => {
        it('should import attachments and set parent/child relationships', async () => {
            const fixtureContent = loadFixture('wxr_attachments.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const attachments: Attachment[] = [];
            for (const item of wxrItems) {
                if (item['wp:post_type'][0]._ === 'attachment') {
                    attachments.push({
                        title: item.title[0]._, 
                        url: item['wp:attachment_url'][0]._, 
                        parentId: parseInt(item['wp:post_parent'][0]._), 
                        status: item['wp:status'][0]._, 
                    });
                }
            }
            expect(attachments).toHaveLength(1);
            expect(attachments[0]!.parentId).toBe(1);
            expect(attachments[0]!.status).toBe('inherit');
        });

        it('should handle missing attachments', async () => {
            const logSpy = vi.spyOn(console, 'log');
            const fixtureContent = loadFixture('wxr_attachment_missing_file.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const wxrItems = parsed.rss.channel[0].item;
            const media = await importAttachments(wxrItems);
            expect(media).toHaveLength(0);
        });
    });
});