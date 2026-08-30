// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { ConfigServiceImpl } from "@/lib/config";
import { S3Service, getS3Config } from "@/lib/s3";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getSafeUploadTypeByMime, isConfiguredSafeType } from "@/lib/upload-validation";
import { createUploadToken } from "@/lib/upload-signing";
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
    const userId = session.user?.id;
    if (!userId) return json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, 401);

    const config = new ConfigServiceImpl({ db });
    const imageMaxBytes = await config.getNumber("UPLOADS.IMAGE-MAX-BYTES") ?? 5_000_000;
    const videoMaxBytes = await config.getNumber("UPLOADS.VIDEO-MAX-BYTES") ?? 50_000_000;
    const videoMaxDuration = await config.getNumber("UPLOADS.VIDEO-MAX-DURATION-SECONDS") ?? 90;
    const allowedImageMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-IMAGE")) ?? [
      "image/jpeg", "image/png", "image/gif", "image/webp",
    ];
    const allowedVideoMimes = (await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-VIDEO")) ?? [
      "video/mp4", "video/webm",
    ];

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const filename = typeof body.filename === "string" ? body.filename : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.toLowerCase() : "";
    const size = body.size;
    const kind = body.kind;
    const detectedFromClaim = getSafeUploadTypeByMime(mimeType);

    if (!filename || filename.length > 255 || !detectedFromClaim ||
      (kind !== "image" && kind !== "video") || detectedFromClaim.kind !== kind ||
      !Number.isSafeInteger(size) || (size as number) <= 0) {
      return json({ error: { code: "INVALID_REQUEST", message: "Invalid upload metadata" } }, 400);
    }

    const maxBytes = kind === "image" ? imageMaxBytes : videoMaxBytes;
    const allowedMimes = kind === "image" ? allowedImageMimes : allowedVideoMimes;
    if ((size as number) > maxBytes || !isConfiguredSafeType(detectedFromClaim, allowedMimes)) {
      return json({ error: { code: "INVALID_UPLOAD", message: "Upload metadata is not allowed" } }, 400);
    }

    const policy = {
      kind,
      limits: { imageMaxBytes, videoMaxBytes, videoMaxDurationSeconds: videoMaxDuration },
    };
    const s3Config = getS3Config();
    if (!s3Config) {
      // The local endpoint assigns the final key after it detects the bytes.
      return json({
        url: "/api/uploads/local",
        fields: { kind },
        key: null,
        method: "POST",
        publicUrl: null,
        policy,
      });
    }

    const s3Service = new S3Service(s3Config);
    const presignedData = await s3Service.createPresignedPost(filename, mimeType, {
      maxBytes,
      allowedMimeTypes: allowedMimes,
      contentLength: size as number,
      keyPrefix: kind === "image" ? "images" : "videos",
    });
    const uploadToken = createUploadToken({
      key: presignedData.key,
      kind,
      mimeType,
      size: size as number,
      maxBytes,
      userId,
      expiresAt: Math.floor(Date.now() / 1000) + 5 * 60,
    });

    return json({
      url: presignedData.url,
      fields: presignedData.fields,
      key: presignedData.key,
      method: "PUT",
      completionUrl: "/api/r2/complete",
      uploadToken,
      publicUrl: null,
      policy,
    });
  } catch (error) {
    logger.error("Error in /api/r2/sign:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return json({ error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message: status === 500 ? "Internal server error" : message } }, status);
  }
}
