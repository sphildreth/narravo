import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setGlobal = vi.fn();
const service = { setGlobal };
const ConfigServiceImpl = vi.fn(() => service);
const db = { execute: vi.fn() };
const logger = { info: vi.fn(), error: vi.fn() };

vi.mock("@/lib/config", () => ({ ConfigServiceImpl }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/logger", () => ({ default: logger }));

describe("scripts/seed-config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setGlobal.mockResolvedValue(undefined);
    const exitSpy = vi.spyOn(process, "exit");
    exitSpy.mockImplementation(((code?: number) => {
      throw new Error(`process.exit should not be called (code: ${code ?? "undefined"})`);
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds all configuration keys", async () => {
    await import("@/scripts/seed-config");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ConfigServiceImpl).toHaveBeenCalledWith({ db });
    expect(logger.info).toHaveBeenCalledWith("Seeded configuration defaults.");
    expect(logger.error).not.toHaveBeenCalled();

    const keys = setGlobal.mock.calls.map((call) => call[0]);
    expect(keys).toEqual([
      "SYSTEM.CACHE.DEFAULT-TTL",
      "PUBLIC.HOME.REVALIDATE-SECONDS",
      "COMMENTS.MAX-DEPTH",
      "COMMENTS.TOP-PAGE-SIZE",
      "COMMENTS.REPLIES-PAGE-SIZE",
      "COMMENTS.AUTO-APPROVE",
      "RATE.COMMENTS-PER-MINUTE",
      "RATE.REACTIONS-PER-MINUTE",
      "RATE.MIN-SUBMIT-SECS",
      "UPLOADS.IMAGE-MAX-BYTES",
      "UPLOADS.VIDEO-MAX-BYTES",
      "UPLOADS.VIDEO-MAX-DURATION-SECONDS",
      "UPLOADS.ALLOWED-MIME-IMAGE",
      "UPLOADS.ALLOWED-MIME-VIDEO",
      "FEED.LATEST-COUNT",
      "ARCHIVE.MONTHS-SIDEBAR",
      "PUBLIC.ARCHIVE.PAGE-SIZE",
      "MODERATION.PAGE-SIZE",
      "APPEARANCE.BANNER.ENABLED",
      "APPEARANCE.BANNER.IMAGE-URL",
      "APPEARANCE.BANNER.ALT",
      "APPEARANCE.BANNER.CREDIT",
      "APPEARANCE.BANNER.OVERLAY",
      "APPEARANCE.BANNER.FOCAL-X",
      "APPEARANCE.BANNER.FOCAL-Y",
      "VIEW.SESSION-WINDOW-MINUTES",
      "VIEW.TRENDING-DAYS",
      "VIEW.ADMIN-SPARKLINE-DAYS",
      "VIEW.REVALIDATE-SECONDS",
      "VIEW.COUNT-BOTS",
      "VIEW.RESPECT-DNT",
      "RATE.VIEWS-PER-MINUTE",
      "VIEW.PUBLIC-SHOW-RENDER-BADGE",
      "PAGE.TRACK-VIEWS",
      "PAGE.TRACK-HOMEPAGE",
      "PAGE.TRACK-CATEGORIES",
      "PAGE.TRACK-TAGS",
      "VIEW.DATE-FORMAT",
      "SITE.ABOUT-ME.ENABLED",
      "SITE.ABOUT-ME.TITLE",
      "SITE.ABOUT-ME.CONTENT",
    ]);
    expect(setGlobal).toHaveBeenCalledTimes(41);
    expect(setGlobal).toHaveBeenCalledWith("SYSTEM.CACHE.DEFAULT-TTL", 5, expect.objectContaining({ type: "integer", required: true }));
  });
});
