import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listPosts = vi.fn();
const getPostsByYearAndMonth = vi.fn();

vi.mock("@/lib/posts", () => ({ listPosts }));
vi.mock("@/lib/archives", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/archives")>();
  return {
    ...actual,
    getPostsByYearAndMonth,
  };
});

describe("lib/rss", () => {
  const BASE_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it("provides default site metadata", async () => {
    const { getSiteMetadata } = await import("@/lib/rss");
    expect(getSiteMetadata()).toEqual({
      title: "Narravo",
      url: "http://localhost:3000",
      description: "Simple, modern blog",
    });
  });

  it("reads metadata from environment", async () => {
    process.env.NEXT_PUBLIC_SITE_NAME = "My Site";
    process.env.NEXT_PUBLIC_SITE_URL = "https://mysite.test";
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION = "Custom desc";

    const { getSiteMetadata } = await import("@/lib/rss");
    expect(getSiteMetadata()).toEqual({
      title: "My Site",
      url: "https://mysite.test",
      description: "Custom desc",
    });
  });

  it("fetches posts for RSS", async () => {
    listPosts.mockResolvedValue({ items: [1, 2, 3] });
    const { getPostsForRSS } = await import("@/lib/rss");
    const items = await getPostsForRSS(5);
    expect(listPosts).toHaveBeenCalledWith({ limit: 5 });
    expect(items).toEqual([1, 2, 3]);
  });

  it("generates RSS XML with escaped content", async () => {
    const { generateRSSXML } = await import("@/lib/rss");
    const xml = generateRSSXML({
      title: "Site & Co",
      url: "https://example.com",
      description: "Desc <here>",
      link: "https://example.com/rss.xml",
      lastBuildDate: new Date("2024-01-01T00:00:00Z"),
      posts: [
        {
          slug: "hello-world",
          title: "Hello & Goodbye",
          excerpt: "<p>Hi & bye</p>",
          publishedAt: "2024-01-01T12:00:00Z",
        },
      ],
    });

    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;description&gt;Desc &lt;here&gt;&lt;/description&gt;");
    expect(xml).toContain("<guid isPermaLink=\"true\">https://example.com/hello-world</guid>");
    expect(xml).toContain("<pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>");
    expect(xml).toContain('<?xml-stylesheet href="/rss.xsl" type="text/xsl"?>');
  });

  it("builds monthly RSS feed using archive posts", async () => {
    const posts = [
      { slug: "post-1", title: "Post 1", publishedAt: new Date("2024-03-05T00:00:00Z") },
    ];
    getPostsByYearAndMonth.mockResolvedValue(posts);
    process.env.NEXT_PUBLIC_SITE_NAME = "Narravo";
    process.env.NEXT_PUBLIC_SITE_URL = "https://narravo.dev";
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION = "Stories";

    const monthSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("March");

    try {
      const { generateMonthlyRssFeed } = await import("@/lib/rss");
      const xml = await generateMonthlyRssFeed(2024, 3);

      expect(getPostsByYearAndMonth).toHaveBeenCalledWith(2024, 3, 1, 50);
      expect(xml).toContain("Narravo - Archive: March 2024");
      expect(xml).toContain("https://narravo.dev/rss-feed/2024/03");
      expect(xml).toContain("post-1");
    } finally {
      monthSpy.mockRestore();
    }
  });
});
