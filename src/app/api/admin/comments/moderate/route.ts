// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, commentAttachments } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { moderateComments, type ModerationRepo } from "@/lib/adminModeration";

class DrizzleModerationRepo implements ModerationRepo {
  async updateStatus(ids: string[], status: "approved" | "spam" | "deleted"): Promise<number> {
    let count = 0;
    for (const id of ids) {
      await db.update(comments).set({ status }).where(eq(comments.id, id));
      count += 1;
    }
    return count;
  }
  async hardDelete(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      await db.delete(comments).where(eq(comments.id, id));
      count += 1;
    }
    return count;
  }
  async editComment(id: string, bodyMd: string, bodyHtml: string): Promise<boolean> {
    await db.update(comments).set({ bodyMd, bodyHtml }).where(eq(comments.id, id));
    return true;
  }
  async removeAttachment(attachmentId: string): Promise<boolean> {
    await db.delete(commentAttachments).where(eq(commentAttachments.id, attachmentId));
    return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const data = await req.json().catch(() => ({}));
    const repo = new DrizzleModerationRepo();
    const result = await moderateComments(repo, data);
    return new Response(JSON.stringify({ ok: true, results: result }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 400;
    if (status === 400) console.error("/api/admin/comments/moderate error:", err);
    return new Response(JSON.stringify({ ok: false, error: { message } }), { status, headers: { "Content-Type": "application/json" } });
  }
}
