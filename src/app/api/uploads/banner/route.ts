// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploads } from "@/drizzle/schema";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { detectSafeUploadType } from "@/lib/upload-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const JSON_HEADERS = { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();

    // Accept multipart form data
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: { message: "file required" } }), { status: 400, headers: JSON_HEADERS });
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
    const relDir = path.posix.join("uploads", "banner");
    const relPath = path.posix.join(relDir, `${id}.${detected.extension}`);

    const absDir = path.join(process.cwd(), "public", relDir);
    const absPath = path.join(process.cwd(), "public", relPath);

    await fs.mkdir(absDir, { recursive: true });

    await fs.writeFile(absPath, arr);

    const publicUrl = `/${relPath}`;

    // Track upload in database as temporary
    const userId = session.user?.id ?? null;
    const key = relPath; // e.g., "uploads/banner/xxx.png"
    await db.insert(uploads).values({
      key,
      url: publicUrl,
      mimeType: detected.mimeType,
      size,
      status: "temporary",
      userId: userId || undefined,
    });

    return new Response(JSON.stringify({ ok: true, url: publicUrl, mimeType: detected.mimeType, size }), { status: 200, headers: JSON_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: JSON_HEADERS });
  }
}
