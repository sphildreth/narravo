import { ConfigServiceImpl } from "../lib/config";
import { db } from "../lib/db";

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

  console.log("Seeded configuration defaults.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
