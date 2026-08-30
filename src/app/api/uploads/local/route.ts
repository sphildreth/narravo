// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { localStorageService } from "@/lib/local-storage";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { uploads } from "@/drizzle/schema";
import { detectSafeUploadType, isConfiguredSafeType } from "@/lib/upload-validation";
import logger from "@/lib/logger";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    const requestedKind = form.get("kind");
    const sessionIdValue = form.get("sessionId");

    if (!(file instanceof File)) {
      return json({ ok: false, error: { code: "NO_FILE", message: "Missing file" } }, 400);
    }

    const body = new Uint8Array(await file.arrayBuffer());
    const size = body.byteLength;
    const detected = detectSafeUploadType(body);
    if (!detected) {
      return json({ ok: false, error: { code: "UNSUPPORTED_FILE_TYPE", message: "Only supported raster images and videos are allowed" } }, 400);
    }

    if (requestedKind !== null && requestedKind !== "image" && requestedKind !== "video") {
      return json({ ok: false, error: { code: "INVALID_KIND", message: "Invalid upload kind" } }, 400);
    }
    if (typeof requestedKind === "string" && requestedKind !== detected.kind) {
      return json({ ok: false, error: { code: "KEY_TYPE_MISMATCH", message: "Upload kind does not match file bytes" } }, 400);
    }

    const config = new ConfigServiceImpl({ db });
    const imageMaxBytes = await config.getNumber("UPLOADS.IMAGE-MAX-BYTES") ?? 5_000_000;
    const videoMaxBytes = await config.getNumber("UPLOADS.VIDEO-MAX-BYTES") ?? 50_000_000;
    const allowedImageMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-IMAGE")) ?? [
      "image/jpeg", "image/png", "image/gif", "image/webp",
    ];
    const allowedVideoMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-VIDEO")) ?? [
      "video/mp4", "video/webm",
    ];
    const maxBytes = detected.kind === "image" ? imageMaxBytes : videoMaxBytes;
    const allowedMimes = detected.kind === "image" ? allowedImageMimes : allowedVideoMimes;

    if (size <= 0 || size > maxBytes) {
      return json({ ok: false, error: { code: "FILE_TOO_LARGE", message: `File size ${size} exceeds limit of ${maxBytes} bytes` } }, 400);
    }
    if (!isConfiguredSafeType(detected, allowedMimes)) {
      return json({ ok: false, error: { code: "INVALID_MIME_TYPE", message: `Detected file type ${detected.mimeType} is not allowed` } }, 400);
    }

    // The storage key is always generated here. Client-supplied key and
    // Content-Type fields are deliberately ignored.
    const key = `${detected.kind === "image" ? "images" : "videos"}/${randomUUID()}.${detected.extension}`;
    await localStorageService.putObject(key, body, detected.mimeType);
    const url = localStorageService.getPublicUrl(key);

    const sessionId = typeof sessionIdValue === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(sessionIdValue)
      ? sessionIdValue
      : undefined;
    await db.insert(uploads).values({
      key,
      url,
      mimeType: detected.mimeType,
      size,
      status: "temporary",
      userId: session.user?.id || undefined,
      sessionId,
    });

    return json({ ok: true, url, key, mimeType: detected.mimeType, size });
  } catch (err) {
    logger.error("/api/uploads/local error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return json({
      ok: false,
      error: {
        code: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "INTERNAL",
        message: status === 500 ? "Upload failed" : message,
      },
    }, status);
  }
}
