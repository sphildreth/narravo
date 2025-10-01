import { beforeEach, describe, expect, it, vi } from "vitest";

const tagCalls: string[] = [];
const revalidateTag = vi.fn((tag: string) => {
  tagCalls.push(tag);
});
const getArchiveCacheTag = vi.fn((year: number, month?: number) =>
  month ? `archive:${year}-${String(month).padStart(2, "0")}` : `archive:${year}`
);

vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/archives", () => ({ getArchiveCacheTag }));

describe("lib/revalidation", () => {
  beforeEach(() => {
    vi.resetModules();
    revalidateTag.mockClear();
    getArchiveCacheTag.mockClear();
    tagCalls.length = 0;
  });

  it("revalidates post and home tags", async () => {
    const { revalidatePostAndArchives } = await import("@/lib/revalidation");
    revalidatePostAndArchives("123");

    expect(revalidateTag).toHaveBeenCalledWith("post:123");
    expect(revalidateTag).toHaveBeenCalledWith("home");
    expect(getArchiveCacheTag).not.toHaveBeenCalled();
  });

  it("revalidates archive tags when published date provided", async () => {
    const { revalidatePostAndArchives } = await import("@/lib/revalidation");
    revalidatePostAndArchives("abc", "2024-03-15T00:00:00Z");

    expect(getArchiveCacheTag).toHaveBeenCalledWith(2024);
    expect(getArchiveCacheTag).toHaveBeenCalledWith(2024, 3);
    expect(revalidateTag).toHaveBeenCalledWith("archive:2024");
    expect(revalidateTag).toHaveBeenCalledWith("archive:2024-03");
  });

  it("ignores invalid date inputs", async () => {
    const { revalidatePostAndArchives } = await import("@/lib/revalidation");
    revalidatePostAndArchives("abc", "invalid-date");

    expect(getArchiveCacheTag).not.toHaveBeenCalled();
    expect(revalidateTag).toHaveBeenCalledWith("home");
  });

  it("revalidates all archives by home tag", async () => {
    const { revalidateAllArchives } = await import("@/lib/revalidation");
    revalidateAllArchives();
    expect(revalidateTag).toHaveBeenCalledWith("home");
  });

  it("revalidates appearance by home tag", async () => {
    const { revalidateAppearance } = await import("@/lib/revalidation");
    revalidateAppearance();
    expect(revalidateTag).toHaveBeenCalledWith("home");
  });
});
