// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { importJobs } from "@/drizzle/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user || !(session.user as any).isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  const jobs = await db
    .select()
    .from(importJobs)
    .orderBy(desc(importJobs.createdAt))
    .limit(10);
  return NextResponse.json({ jobs });
}

