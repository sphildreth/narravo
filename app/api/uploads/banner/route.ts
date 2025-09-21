// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    // Accept multipart form data
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ ok: false, error: { message: "file required" } }), { status: 400 });
    }

    const mime = file.type || "";
    if (!mime.startsWith("image/")) {
      return new Response(JSON.stringify({ ok: false, error: { message: "Only image uploads are supported" } }), { status: 400 });
    }

    const size = file.size ?? 0;
    if (size <= 0 || size > DEFAULT_MAX_IMAGE_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: { message: `Image size must be >0 and <= ${DEFAULT_MAX_IMAGE_BYTES} bytes` } }), { status: 400 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const id = randomUUID();
    const relDir = path.posix.join("uploads", "banner");
    const relPath = path.posix.join(relDir, `${id}.${ext || "bin"}`);

    const absDir = path.join(process.cwd(), "public", relDir);
    const absPath = path.join(process.cwd(), "public", relPath);

    await fs.mkdir(absDir, { recursive: true });

    const arr = new Uint8Array(await file.arrayBuffer());
    await fs.writeFile(absPath, arr);

    const publicUrl = `/${relPath}`;

    return new Response(JSON.stringify({ ok: true, url: publicUrl }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}
