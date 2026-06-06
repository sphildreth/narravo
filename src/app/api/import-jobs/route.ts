// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { importJobs } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

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
