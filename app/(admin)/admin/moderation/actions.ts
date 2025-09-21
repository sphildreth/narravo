"use server";

import { requireAdmin } from "@/lib/auth";
import { getModerationQueue, revalidateAfterModeration, type ModerationFilter } from "@/lib/moderation";
import { moderateComments, type ModerateInput, type ModerationRepo } from "@/lib/adminModeration";
import { db } from "@/lib/db";
import { comments, commentAttachments } from "@/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { ConfigServiceImpl } from "@/lib/config";

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

export async function getModerationData(
  filter: ModerationFilter = {},
  page: number = 1
) {
  await requireAdmin();
  
  const config = new ConfigServiceImpl({ db });
  const pageSize = await config.getNumber("MODERATION.PAGE-SIZE");
  if (pageSize == null) throw new Error("Missing required config: MODERATION.PAGE-SIZE");

  return await getModerationQueue(filter, page, pageSize);
}

export async function performModerationAction(input: ModerateInput) {
  await requireAdmin();

  const repo = new DrizzleModerationRepo();
  const results = await moderateComments(repo, input);

  // Extract post IDs for revalidation
  const postIds: string[] = [];
  if (input.ids?.length) {
    // Get post IDs from the comment IDs
    const commentData = await db.execute(sql`
      SELECT DISTINCT post_id 
      FROM comments 
      WHERE id = ANY(${JSON.stringify(input.ids)})
    `);
    
    const rows: any[] = (commentData as any).rows ?? (Array.isArray(commentData) ? commentData : []);
    postIds.push(...rows.map(row => row.post_id));
  } else if (input.id) {
    // Single comment operation
    const commentData = await db.execute(sql`
      SELECT post_id 
      FROM comments 
      WHERE id = ${input.id}
    `);
    
    const rows: any[] = (commentData as any).rows ?? (Array.isArray(commentData) ? commentData : []);
    if (rows[0]?.post_id) {
      postIds.push(rows[0].post_id);
    }
  }

  // Revalidate affected post pages
  if (postIds.length > 0) {
    await revalidateAfterModeration(postIds);
  }

  return { success: true, results };
}