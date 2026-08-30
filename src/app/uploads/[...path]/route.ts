// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import fs from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { detectSafeUploadType } from "@/lib/upload-validation";

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");
const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff" };

function isContained(candidate: string): boolean {
  const relative = path.relative(UPLOAD_DIR, candidate);
  return Boolean(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const filePath = params.path.join("/");
    const absolutePath = path.resolve(UPLOAD_DIR, filePath);
    if (!isContained(absolutePath)) return new NextResponse("Forbidden", { status: 403, headers: SECURITY_HEADERS });

    const stats = await stat(absolutePath).catch(() => null);
    if (!stats?.isFile()) return new NextResponse("Not Found", { status: 404, headers: SECURITY_HEADERS });

    // A symlink must not escape the upload root either.
    const resolvedPath = await realpath(absolutePath).catch(() => null);
    if (!resolvedPath || !isContained(resolvedPath)) return new NextResponse("Forbidden", { status: 403, headers: SECURITY_HEADERS });

    const handle = await open(resolvedPath, "r");
    const header = Buffer.alloc(64);
    let bytesRead = 0;
    try {
      ({ bytesRead } = await handle.read(header, 0, header.length, 0));
    } finally {
      await handle.close();
    }

    const detected = detectSafeUploadType(header.subarray(0, bytesRead));
    const headers: Record<string, string> = {
      "Content-Type": detected?.mimeType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (!detected) {
      const safeName = path.basename(resolvedPath).replace(/[^A-Za-z0-9._-]/g, "_");
      headers["Content-Disposition"] = `attachment; filename="${safeName || "download"}"`;
    }

    const fileStream = fs.createReadStream(resolvedPath);
    const stream = Readable.toWeb(fileStream);
    // @ts-expect-error Node.js web streams are compatible with Next Response.
    return new NextResponse(stream, { status: 200, headers });
  } catch (error) {
    console.error("Error serving upload:", error);
    return new NextResponse("Internal Server Error", { status: 500, headers: SECURITY_HEADERS });
  }
}
