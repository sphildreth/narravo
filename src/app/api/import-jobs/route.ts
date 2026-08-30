// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { importJobs } from "@/drizzle/schema";
import { desc } from "drizzle-orm";
import { startImportJob } from "@/app/actions/import";
import { safeApiError } from "@/lib/api-error";

const MAX_WXR_BYTES = 50 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_WXR_BYTES + 1024 * 1024;

export async function GET() {
  try {
    await requireAdmin2FA();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const jobs = await db
    .select()
    .from(importJobs)
    .orderBy(desc(importJobs.createdAt))
    .limit(10);
  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate before asking Next.js to parse a potentially large body.
    await requireAdmin2FA();
    const declaredLength = req.headers.get("content-length");
    if (declaredLength && (
      !/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_MULTIPART_BYTES
    )) {
      return NextResponse.json({ error: "Import request is too large" }, { status: 413 });
    }

    const result = await startImportJob(await req.formData());
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    const publicError = safeApiError(error, "Failed to start import");
    return NextResponse.json(
      { error: publicError.message },
      { status: publicError.status },
    );
  }
}
