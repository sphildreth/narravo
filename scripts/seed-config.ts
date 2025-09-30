// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import logger from "@/lib/logger";

async function main() {
  const service = new ConfigServiceImpl({ db });

  // Cache TTL (minutes)
  await service.setGlobal("SYSTEM.CACHE.DEFAULT-TTL", 5, { type: "integer", required: true });

  // ISR / public
  await service.setGlobal("PUBLIC.HOME.REVALIDATE-SECONDS", 60, { type: "integer", required: true });

  // Comments
  await service.setGlobal("COMMENTS.MAX-DEPTH", 5, { type: "integer", required: true });
  await service.setGlobal("COMMENTS.TOP-PAGE-SIZE", 10, { type: "integer", required: true });
  await service.setGlobal("COMMENTS.REPLIES-PAGE-SIZE", 3, { type: "integer", required: true });
  await service.setGlobal("COMMENTS.AUTO-APPROVE", true, { type: "boolean", required: true });

  // Rate limits
  await service.setGlobal("RATE.COMMENTS-PER-MINUTE", 5, { type: "integer", required: true });
  await service.setGlobal("RATE.REACTIONS-PER-MINUTE", 20, { type: "integer", required: true });
  await service.setGlobal("RATE.MIN-SUBMIT-SECS", 2, { type: "integer", required: true });

  // Upload limits
  await service.setGlobal("UPLOADS.IMAGE-MAX-BYTES", 5_000_000, { type: "integer", required: true });
  await service.setGlobal("UPLOADS.VIDEO-MAX-BYTES", 50_000_000, { type: "integer", required: true });
  await service.setGlobal("UPLOADS.VIDEO-MAX-DURATION-SECONDS", 90, { type: "integer", required: true });
  
  // Optional MIME type allowlists (JSON arrays)
  await service.setGlobal("UPLOADS.ALLOWED-MIME-IMAGE", ["image/jpeg", "image/png", "image/gif", "image/webp"], { type: "json", required: false });
  await service.setGlobal("UPLOADS.ALLOWED-MIME-VIDEO", ["video/mp4", "video/webm"], { type: "json", required: false });

  // Feeds & archives
  await service.setGlobal("FEED.LATEST-COUNT", 20, { type: "integer", required: true });
  await service.setGlobal("ARCHIVE.MONTHS-SIDEBAR", 24, { type: "integer", required: true });
  await service.setGlobal("PUBLIC.ARCHIVE.PAGE-SIZE", 10, { type: "integer", required: true }); // Add this line

  // Moderation defaults
  await service.setGlobal("MODERATION.PAGE-SIZE", 20, { type: "integer", required: true });

  // Appearance / Banner defaults
  await service.setGlobal("APPEARANCE.BANNER.ENABLED", false, { type: "boolean", required: true });
  await service.setGlobal("APPEARANCE.BANNER.IMAGE-URL", "", { type: "string", required: true });
  await service.setGlobal("APPEARANCE.BANNER.ALT", "", { type: "string", required: true });
  await service.setGlobal("APPEARANCE.BANNER.CREDIT", "", { type: "string", required: true });
  await service.setGlobal("APPEARANCE.BANNER.OVERLAY", 0.45, { type: "number", required: true });
  await service.setGlobal("APPEARANCE.BANNER.FOCAL-X", 0.5, { type: "number", required: true });
  await service.setGlobal("APPEARANCE.BANNER.FOCAL-Y", 0.5, { type: "number", required: true });

  // Analytics configuration
  await service.setGlobal("VIEW.SESSION-WINDOW-MINUTES", 30, { type: "integer", required: true });
  await service.setGlobal("VIEW.TRENDING-DAYS", 7, { type: "integer", required: true });
  await service.setGlobal("VIEW.ADMIN-SPARKLINE-DAYS", 30, { type: "integer", required: true });
  await service.setGlobal("VIEW.REVALIDATE-SECONDS", 60, { type: "integer", required: true });
  await service.setGlobal("VIEW.COUNT-BOTS", false, { type: "boolean", required: true });
  await service.setGlobal("VIEW.RESPECT-DNT", true, { type: "boolean", required: true });
  await service.setGlobal("RATE.VIEWS-PER-MINUTE", 120, { type: "integer", required: true });
  await service.setGlobal("VIEW.PUBLIC-SHOW-RENDER-BADGE", true, { type: "boolean", required: false });
  
  // Page-level analytics configuration
  await service.setGlobal("PAGE.TRACK-VIEWS", true, { type: "boolean", required: true });
  await service.setGlobal("PAGE.TRACK-HOMEPAGE", true, { type: "boolean", required: true });
  await service.setGlobal("PAGE.TRACK-CATEGORIES", true, { type: "boolean", required: true });
  await service.setGlobal("PAGE.TRACK-TAGS", true, { type: "boolean", required: true });
  
  // Date format (date-fns format) — default example renders 2025-04-25 as "April 25, 2025"
  await service.setGlobal("VIEW.DATE-FORMAT", "MMMM d, yyyy", { type: "string", required: false });

  // About me
  await service.setGlobal("SITE.ABOUT-ME.ENABLED", false, { type: "boolean", required: true });
  await service.setGlobal("SITE.ABOUT-ME.TITLE", "About Me", { type: "string", required: true });
  await service.setGlobal("SITE.ABOUT-ME.CONTENT", "", { type: "string", required: true });

  logger.info("Seeded configuration defaults.");
}

main().catch((err) => {
  logger.error(err);
  process.exit(1);
});