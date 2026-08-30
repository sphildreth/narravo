// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploads } from "@/drizzle/schema";
import { getS3Config, S3Service } from "@/lib/s3";
import { verifyUploadToken } from "@/lib/upload-signing";
import { detectSafeUploadType } from "@/lib/upload-validation";
import { and, eq } from "drizzle-orm";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function POST(req: NextRequest) {
  let service: S3Service | null = null;
  let key: string | null = null;
  let completed = false;
  try {
    const session = await requireSession();
    const userId = session.user?.id;
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    key = typeof body.key === "string" ? body.key : null;
    const token = typeof body.uploadToken === "string" ? body.uploadToken : "";
    const claims = verifyUploadToken(token);
    if (!userId || !key || !claims || claims.userId !== userId || claims.key !== key) {
      return json({ error: { code: "INVALID_UPLOAD_TOKEN", message: "Invalid or expired upload token" } }, 400);
    }

    const [existing] = await db
      .select()
      .from(uploads)
      .where(and(eq(uploads.key, key), eq(uploads.userId, userId)))
      .limit(1);
    if (existing) {
      completed = true;
      return json({
        ok: true,
        key: existing.key,
        url: existing.url,
        mimeType: existing.mimeType,
        size: existing.size,
      });
    }

    const config = getS3Config();
    if (!config) return json({ error: { code: "STORAGE_UNAVAILABLE", message: "Remote storage is not configured" } }, 500);
    service = new S3Service(config);
    const bytes = await service.getObjectBytes(key, claims.maxBytes);
    const detected = detectSafeUploadType(bytes);
    if (!detected || detected.kind !== claims.kind || detected.mimeType !== claims.mimeType || bytes.byteLength !== claims.size) {
      await service.deleteObject(key);
      return json({ error: { code: "UNSUPPORTED_FILE_TYPE", message: "Uploaded bytes do not match the signed upload" } }, 400);
    }
    const publicUrl = service.getPublicUrl(key);
    const [inserted] = await db.insert(uploads).values({
      key,
      url: publicUrl,
      mimeType: detected.mimeType,
      size: bytes.byteLength,
      status: "temporary",
      userId,
    }).onConflictDoNothing({ target: uploads.key }).returning({ id: uploads.id });
    if (!inserted) {
      const [concurrent] = await db
        .select()
        .from(uploads)
        .where(and(eq(uploads.key, key), eq(uploads.userId, userId)))
        .limit(1);
      if (!concurrent) throw new Error("Upload key was claimed by another user");
      completed = true;
      return json({
        ok: true,
        key: concurrent.key,
        url: concurrent.url,
        mimeType: concurrent.mimeType,
        size: concurrent.size,
      });
    }
    completed = true;
    return json({ ok: true, key, url: publicUrl, mimeType: detected.mimeType, size: bytes.byteLength });
  } catch (error) {
    if (!completed && service && key) {
      try { await service.deleteObject(key); } catch { /* best effort cleanup */ }
    }
    return json({ error: { code: "UPLOAD_VALIDATION_FAILED", message: "Upload validation failed" } }, 400);
  }
}
