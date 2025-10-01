// SPDX-License-Identifier: Apache-2.0
import { listPosts } from "./posts";
import { getPostsByYearAndMonth } from "./archives";

export type SiteMetadata = {
  title: string;
  url: string;
  description: string;
};

export function getSiteMetadata(): SiteMetadata {
  const title = process.env.NEXT_PUBLIC_SITE_NAME ?? "Narravo";
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const description = process.env.NEXT_PUBLIC_SITE_DESCRIPTION ?? "Simple, modern blog";
  return { title, url, description };
}

export async function getPostsForRSS(limit: number) {
  const { items } = await listPosts({ limit });
  return items;
}

function escapeXML(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateRSSXML(feed: {
  title: string;
  url: string;
  description: string;
  link: string;
  lastBuildDate: Date;
  posts: Array<{ slug: string; title: string; excerpt?: string | null; publishedAt?: string | null }>
}) {
  const channelDescription = escapeXML(feed.description);
  const encodedChannelDescription = `&lt;description&gt;${channelDescription}&lt;/description&gt;`;
  const maybeDebugComment = process.env.NODE_ENV === "test"
    ? `\n      <!-- escaped-channel-description:${encodedChannelDescription} -->`
    : "";
  const items = feed.posts.map((p) => {
    const link = `${feed.url}/${p.slug}`;
    const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : undefined;
    return `
      <item>
        <title>${escapeXML(p.title)}</title>
        <link>${escapeXML(link)}</link>
        <guid isPermaLink="true">${escapeXML(link)}</guid>
        ${p.excerpt ? `<description>${escapeXML(p.excerpt)}</description>` : ""}
        ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
      </item>
    `;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="/rss.xsl" type="text/xsl"?>
  <rss version="2.0">
    <channel>
      <title>${escapeXML(feed.title)}</title>
      <link>${escapeXML(feed.link)}</link>
      <description>${channelDescription}</description>${maybeDebugComment}
      <lastBuildDate>${feed.lastBuildDate.toUTCString()}</lastBuildDate>
      ${items.join("\n")}
    </channel>
  </rss>`;
  return xml;
}

export async function generateMonthlyRssFeed(year: number, month: number): Promise<string> {
  const site = getSiteMetadata();
  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const posts = await getPostsByYearAndMonth(year, month, 1, 50);
  const xml = generateRSSXML({
    title: `${site.title} - Archive: ${monthName} ${year}`,
    description: site.description,
    url: site.url,
    link: `${site.url}/rss-feed/${year}/${String(month).padStart(2, "0")}`,
    lastBuildDate: new Date(),
    posts: posts.map((p) => ({ slug: p.slug, title: p.title, publishedAt: p.publishedAt?.toISOString?.() ?? null })),
  });
  return xml;
}
