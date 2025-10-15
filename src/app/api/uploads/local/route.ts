// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { localStorageService } from "@/lib/local-storage";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { requireAdmin, getSessionUserId } from "@/lib/auth";
import { uploads } from "@/drizzle/schema";
import logger from '@/lib/logger';

function isSafeKey(key: string): boolean {
  if (!key) return false;
  // Disallow path traversal and absolute paths
  if (key.includes("..")) return false;
  if (key.startsWith("/")) return false;
  // Basic allowlist for prefixes
  if (!(key.startsWith("images/") || key.startsWith("videos/") || key.startsWith("uploads/") || key.startsWith("featured/"))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    
    const form = await req.formData();
    const file = form.get("file");
    const key = String(form.get("key") || "");
    const overrideCT = form.get("Content-Type");
    const sessionId = form.get("sessionId") || null;

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: { code: "NO_FILE", message: "Missing file" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isSafeKey(key)) {
      return new Response(JSON.stringify({ ok: false, error: { code: "INVALID_KEY", message: "Invalid upload key" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Determine content type; prefer explicit override, then file.type, else octet-stream
    const contentType = typeof overrideCT === "string" && overrideCT ? overrideCT : (file.type || "application/octet-stream");

    // Load validation config to mirror /api/r2/sign behavior
    const config = new ConfigServiceImpl({ db });
    const imageMaxBytes = await config.getNumber("UPLOADS.IMAGE-MAX-BYTES");
    const videoMaxBytes = await config.getNumber("UPLOADS.VIDEO-MAX-BYTES");
    const allowedImageMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-IMAGE")) ?? [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const allowedVideoMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-VIDEO")) ?? [
      "video/mp4",
      "video/webm",
    ];

    if (imageMaxBytes == null || videoMaxBytes == null) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "CONFIG_MISSING", message: "Upload limits not configured" } }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const isImage = contentType.startsWith("image/") || key.startsWith("images/");
    const isVideo = contentType.startsWith("video/") || key.startsWith("videos/");

    if (!isImage && !isVideo) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "INVALID_MIME_TYPE", message: "Only image and video files are supported" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Enforce key prefix consistency where possible
    if (isImage && key.startsWith("videos/")) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "KEY_TYPE_MISMATCH", message: "Image content must use images/ prefix" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (isVideo && key.startsWith("images/")) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "KEY_TYPE_MISMATCH", message: "Video content must use videos/ prefix" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate size against configured max
    const size = typeof (file as any).size === "number" ? (file as any).size as number : undefined;
    const maxBytes = isImage ? imageMaxBytes : videoMaxBytes;
    if (typeof size === "number" && size > maxBytes) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "FILE_TOO_LARGE", message: `File size ${size} exceeds limit of ${maxBytes} bytes` } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate MIME allowlist
    const allowedMimes = isImage ? allowedImageMimes : allowedVideoMimes;
    if (!allowedMimes.includes(contentType)) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "INVALID_MIME_TYPE", message: `MIME type ${contentType} not allowed` } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Save file to local storage
    const buf = new Uint8Array(await file.arrayBuffer());
    await localStorageService.putObject(key, buf, contentType);
    const url = localStorageService.getPublicUrl(key);

    // Track upload in database as temporary
    const userId = await getSessionUserId();
    await db.insert(uploads).values({
      key,
      url,
      mimeType: contentType,
      size,
      status: "temporary",
      userId: userId || undefined,
      sessionId: sessionId ? String(sessionId) : undefined,
    });

    return new Response(JSON.stringify({ ok: true, url, key }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    logger.error("/api/uploads/local error:", err);
    return new Response(JSON.stringify({ ok: false, error: { code: "INTERNAL", message: "Upload failed" } }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
