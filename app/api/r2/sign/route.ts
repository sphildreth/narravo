// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { ConfigServiceImpl } from "@/lib/config";
import { S3Service, getS3Config } from "@/lib/s3";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const config = new ConfigServiceImpl({ db });
    
    // Get configuration values
    const imageMaxBytes = await config.getNumber("UPLOADS.IMAGE-MAX-BYTES");
    const videoMaxBytes = await config.getNumber("UPLOADS.VIDEO-MAX-BYTES");
    const videoMaxDuration = await config.getNumber("UPLOADS.VIDEO-MAX-DURATION-SECONDS");
    
    if (imageMaxBytes == null) throw new Error("Missing required config: UPLOADS.IMAGE-MAX-BYTES");
    if (videoMaxBytes == null) throw new Error("Missing required config: UPLOADS.VIDEO-MAX-BYTES");
    if (videoMaxDuration == null) throw new Error("Missing required config: UPLOADS.VIDEO-MAX-DURATION-SECONDS");

    // Get optional MIME type allowlists
    const allowedImageMimes = await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-IMAGE") ?? [
      "image/jpeg",
      "image/png", 
      "image/gif",
      "image/webp"
    ];
    const allowedVideoMimes = await config.getJSON<string[]>("UPLOADS.ALLOWED-MIME-VIDEO") ?? [
      "video/mp4",
      "video/webm"
    ];

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { filename, mimeType, size, kind } = body;

    if (!filename || !mimeType || typeof size !== 'number') {
      return new Response(
        JSON.stringify({ error: { code: "INVALID_REQUEST", message: "Missing filename, mimeType, or size" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate based on kind
    const isImage = kind === "image" || mimeType.startsWith("image/");
    const isVideo = kind === "video" || mimeType.startsWith("video/");
    
    if (!isImage && !isVideo) {
      return new Response(
        JSON.stringify({ error: { code: "INVALID_MIME_TYPE", message: "Only image and video files are supported" } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check size limits
    const maxBytes = isImage ? imageMaxBytes : videoMaxBytes;
    if (size > maxBytes) {
      return new Response(
        JSON.stringify({ 
          error: { 
            code: "FILE_TOO_LARGE", 
            message: `File size ${size} exceeds limit of ${maxBytes} bytes for ${kind}s` 
          } 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check MIME type allowlist
    const allowedMimes = isImage ? allowedImageMimes : allowedVideoMimes;
    if (!allowedMimes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ 
          error: { 
            code: "INVALID_MIME_TYPE", 
            message: `MIME type ${mimeType} not allowed for ${kind}s` 
          } 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get S3/R2 configuration
    const s3Config = getS3Config();
    if (!s3Config) {
      // In development/test, return a mock response
      return new Response(
        JSON.stringify({ 
          url: "https://example.com/presigned",
          fields: { "Content-Type": mimeType },
          key: `uploads/mock-${Date.now()}.${filename.split('.').pop()}`,
          policy: {
            kind: isImage ? "image" : "video",
            limits: {
              imageMaxBytes,
              videoMaxBytes,
              videoMaxDurationSeconds: videoMaxDuration,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create S3/R2 service and generate presigned URL
    const s3Service = new S3Service(s3Config);
    const presignedData = await s3Service.createPresignedPost(filename, mimeType, {
      maxBytes,
      allowedMimeTypes: allowedMimes,
      keyPrefix: isImage ? "images" : "videos",
    });

    return new Response(
      JSON.stringify({
        url: presignedData.url,
        fields: presignedData.fields,
        key: presignedData.key,
        policy: {
          kind: isImage ? "image" : "video",
          limits: {
            imageMaxBytes,
            videoMaxBytes,
            videoMaxDurationSeconds: videoMaxDuration,
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in /api/r2/sign:", error);
    return new Response(
      JSON.stringify({ 
        error: { 
          code: "INTERNAL_ERROR", 
          message: error instanceof Error ? error.message : "Internal server error" 
        } 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}