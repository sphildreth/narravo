
import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'xml2js';
import { describe, it, expect } from 'vitest';

interface Term {
    id: number;
    name: string;
    slug: string;
    taxonomy: string;
    parent?: string;
}

interface Post {
    title: string;
    terms: Term[];
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

    const importTaxonomy = (channel: any): Term[] => {
        const terms: Term[] = [];
        if (channel['wp:category']) {
            for (const category of channel['wp:category']) {
                terms.push({
                    id: parseInt(category['wp:term_id'][0]._), 
                    name: category['wp:cat_name'][0]._, 
                    slug: category['wp:category_nicename'][0]._, 
                    taxonomy: 'category',
                    parent: category['wp:category_parent']?.[0]._, 
                });
            }
        }
        if (channel['wp:term']) {
            for (const term of channel['wp:term']) {
                terms.push({
                    id: parseInt(term['wp:term_id'][0]._), 
                    name: term['wp:term_name'][0]._, 
                    slug: term['wp:term_slug'][0]._, 
                    taxonomy: term['wp:term_taxonomy'][0]._, 
                });
            }
        }
        return terms;
    };

    describe('Taxonomies', () => {
        it('should maintain hierarchy', async () => {
            const fixtureContent = loadFixture('wxr_terms_hierarchy.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const terms = importTaxonomy(parsed.rss.channel[0]);
            expect(terms).toHaveLength(2);
            const child = terms.find(t => t.slug === 'child');
            expect(child?.parent).toBe('parent');
        });

        it('should handle custom taxonomies', async () => {
            const fixtureContent = loadFixture('wxr_custom_tax.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const terms = importTaxonomy(parsed.rss.channel[0]);
            expect(terms).toHaveLength(1);
            expect(terms[0]!.taxonomy).toBe('genre');
        });

        it('should handle term slug collisions', async () => {
            const fixtureContent = loadFixture('wxr_term_slugs_collide.xml');
            const parsed = await parser.parseStringPromise(fixtureContent);
            const terms = importTaxonomy(parsed.rss.channel[0]);
            const term1 = terms.find(t => t.parent === 'parent1');
            const term2 = terms.find(t => t.parent === 'parent2');
            expect(term1?.slug).toBe('term');
            expect(term2?.slug).toBe('term');
        });
    });
});
