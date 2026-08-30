// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploads } from "@/drizzle/schema";
import { randomUUID } from "node:crypto";
import { detectSafeUploadType } from "@/lib/upload-validation";
import { consumeSharedRateLimit } from "@/lib/shared-rate-limit";
import { localStorageService } from "@/lib/local-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_MULTIPART_BYTES = DEFAULT_MAX_IMAGE_BYTES + 1024 * 1024;
const JSON_HEADERS = { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };

export async function POST(req: NextRequest) {
  let storedKey: string | null = null;
  try {
    const declaredLength = req.headers.get("content-length");
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_MULTIPART_BYTES)) {
      return new Response(JSON.stringify({ ok: false, error: { message: "Upload request is too large" } }), { status: 413, headers: JSON_HEADERS });
    }
    const session = await requireAdmin2FA();

    // Accept multipart form data
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: { message: "file required" } }), { status: 400, headers: JSON_HEADERS });
    }
    if (file.size <= 0 || file.size > DEFAULT_MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: { message: `Image size must be >0 and <= ${DEFAULT_MAX_IMAGE_BYTES} bytes` } }), { status: 400, headers: JSON_HEADERS });
    }

    const userId = session.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ ok: false, error: { message: "Unauthorized" } }), { status: 401, headers: JSON_HEADERS });
    }
    const uploadLimit = await consumeSharedRateLimit(`upload:banner:${userId}`, 10, 60 * 1000);
    if (uploadLimit.limited) {
      return new Response(JSON.stringify({ ok: false, error: { message: "Too many upload attempts" } }), { status: 429, headers: JSON_HEADERS });
    }

    const arr = new Uint8Array(await file.arrayBuffer());
    const detected = detectSafeUploadType(arr);
    if (!detected || detected.kind !== "image") {
      return new Response(JSON.stringify({ ok: false, error: { message: "Only supported raster image uploads are allowed" } }), { status: 400, headers: JSON_HEADERS });
    }

    const size = arr.byteLength;
    if (size <= 0 || size > DEFAULT_MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: { message: `Image size must be >0 and <= ${DEFAULT_MAX_IMAGE_BYTES} bytes` } }), { status: 400, headers: JSON_HEADERS });
    }

    const id = randomUUID();
    const key = `banner/${id}.${detected.extension}`;
    await localStorageService.putObject(key, arr, detected.mimeType);
    storedKey = key;
    const publicUrl = localStorageService.getPublicUrl(key);

    // Track upload in database as temporary
    await db.insert(uploads).values({
      key,
      url: publicUrl,
      mimeType: detected.mimeType,
      size,
      status: "temporary",
      userId,
    });
    storedKey = null;

    return new Response(JSON.stringify({ ok: true, url: publicUrl, mimeType: detected.mimeType, size }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    if (storedKey) {
      try { await localStorageService.deleteObject(storedKey); } catch { /* best effort cleanup */ }
    }
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    return new Response(JSON.stringify({ ok: false, error: { message: status === 500 ? "Upload failed" : message } }), { status, headers: JSON_HEADERS });
  }
}
