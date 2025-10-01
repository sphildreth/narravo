import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listPosts = vi.fn();
const listArchiveMonths = vi.fn();
const warn = vi.fn();

vi.mock("@/lib/posts", () => ({ listPosts }));
vi.mock("@/lib/archives", () => ({ listArchiveMonths }));
vi.mock("@/lib/logger", () => ({ default: { warn } }));

describe("lib/seo", () => {
  const BASE_ENV = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...BASE_ENV };
  });

  afterEach(() => {
    process.env = { ...BASE_ENV };
  });

  it("generates sitemap with posts and archives", async () => {
    listPosts
      .mockResolvedValueOnce({
        items: [{ slug: "post-1" }],
        nextCursor: { publishedAt: "2024-01-01", id: "1" },
      })
      .mockResolvedValueOnce({ items: [{ slug: "post-2" }], nextCursor: null });
    listArchiveMonths.mockResolvedValue([
      { year: 2024, month: 3 },
      { year: 2023, month: 12 },
    ]);

    const { generateSitemap } = await import("@/lib/seo");
    const xml = await generateSitemap("https://narravo.dev");

    expect(listPosts).toHaveBeenCalledTimes(2);
    expect(xml).toContain("https://narravo.dev/post-1");
    expect(xml).toContain("https://narravo.dev/post-2");
    expect(xml).toContain("https://narravo.dev/archives/2024/03");
    expect(xml).toContain("https://narravo.dev/archives/2024");
    expect(xml).toContain("https://narravo.dev/rss-feed/2023/12");
  });

  it("logs warning when posts query fails", async () => {
    listPosts.mockRejectedValue(new Error("db"));
    listArchiveMonths.mockResolvedValue([]);
    process.env = { ...process.env, NODE_ENV: "production" };

    const { generateSitemap } = await import("@/lib/seo");
    const xml = await generateSitemap("https://narravo.dev");

    expect(xml).toContain("https://narravo.dev");
    expect(warn).toHaveBeenCalledWith("Sitemap: failed to list posts; continuing with partial sitemap");
  });

  it("logs warning when archive query fails", async () => {
    listPosts.mockResolvedValue({ items: [], nextCursor: null });
    listArchiveMonths.mockRejectedValue(new Error("db"));
    process.env = { ...process.env, NODE_ENV: "production" };

    const { generateSitemap } = await import("@/lib/seo");
    await generateSitemap("https://narravo.dev");

    expect(warn).toHaveBeenCalledWith("Sitemap: failed to list archive months; continuing without archives");
  });

  it("builds post metadata", async () => {
    const { generatePostMetadata } = await import("@/lib/seo");
    const metadata = generatePostMetadata(
      {
        id: "1",
        slug: "post-1",
        title: "Post Title",
        excerpt: "Excerpt",
        publishedAt: "2024-01-01T00:00:00Z",
      } as any,
      "https://narravo.dev",
      "Narravo"
    );

    expect(metadata.alternates?.canonical).toBe("https://narravo.dev/post-1");
    expect(metadata.openGraph?.url).toBe("https://narravo.dev/post-1");
    expect(metadata.twitter?.title).toBe("Post Title");
  });

  it("builds post JSON-LD", async () => {
    const { generatePostJsonLd } = await import("@/lib/seo");
    const json = generatePostJsonLd(
      {
        id: "1",
        slug: "post-1",
        title: "Post Title",
        excerpt: "Excerpt",
        publishedAt: "2024-01-01T00:00:00Z",
      } as any,
      "https://narravo.dev",
      "Narravo"
    );

    const data = JSON.parse(json);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data.publisher.logo.url).toBe("https://narravo.dev/images/logo-269x255.png");
  });
});
