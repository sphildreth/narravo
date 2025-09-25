// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataOperationLogs, posts, comments, commentAttachments } from "@/drizzle/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

// Accept id when valid UUID; otherwise drop it so slug/BULK paths can proceed
const idOptionalUuid = z.preprocess((v) => {
  if (typeof v !== "string") return undefined;
  // Basic UUID v4-ish check; final validation is done by z.string().uuid()
  const looksUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v.trim());
  return looksUuid ? v.trim() : undefined;
}, z.string().uuid().optional());

const purgeRequestSchema = z.object({
  type: z.enum(["post", "comment", "comment_attachment"]),
  mode: z.enum(["soft", "hard"]),
  dryRun: z.boolean().default(true),
  
  // Identifiers
  id: idOptionalUuid,
  slug: z.string().optional(),
  ids: z.array(z.string().uuid()).optional(),
  
  // Filters for bulk operations
  filter: z.object({
    createdBefore: z.string().optional(),
    status: z.string().optional(),
    userId: z.string().uuid().optional(),
  }).optional(),
  
  // Confirmation for hard delete
  confirmationPhrase: z.string().optional(),
});

type PurgeRequest = z.infer<typeof purgeRequestSchema>;

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    // Derive a safe user id for audit/deletedBy, even if tests mock requireAdmin() as boolean
    const currentUserId = (session && typeof session === "object" && (session as any).user && (session as any).user.id) ? (session as any).user.id : null;

    const body = await req.json();
    const parsed = purgeRequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return new Response(JSON.stringify({
        ok: false,
        error: { 
          message: "Invalid request",
          details: parsed.error.errors 
        }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { type, mode, dryRun, id, slug, ids, filter, confirmationPhrase } = parsed.data;

    // Validate hard delete confirmation — compute effective target the same way UI should
    if (mode === "hard" && !dryRun) {
      const effectiveTarget = id || slug || "BULK";
      const expectedPhrase = `DELETE ${type} ${effectiveTarget}`;
      if (confirmationPhrase !== expectedPhrase) {
        return new Response(JSON.stringify({
          ok: false,
          error: { 
            message: `Hard delete requires confirmation phrase: "${expectedPhrase}"` 
          }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Create audit log entry
    const operationId = nanoid();
    const operationType = mode === "soft" ? "purge_soft" : "purge_hard";
    const logEntry = await db.insert(dataOperationLogs).values({
      operationType,
      userId: currentUserId,
      details: {
        type,
        mode,
        dryRun,
        id,
        slug,
        ids,
        filter,
        operationId,
      },
      status: "started",
      ipAddress: req.ip || req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    }).returning();

    try {
      let recordsAffected = 0;
      const preview: any = {
        type,
        mode,
        records: [],
        cascadeEffects: {},
      };

      if (type === "post") {
        // Build query conditions
        let whereConditions: any[] = [];

        if (id) {
          whereConditions.push(eq(posts.id, id));
        } else if (slug) {
          whereConditions.push(eq(posts.slug, slug));
        } else if (ids?.length) {
          whereConditions.push(inArray(posts.id, ids));
        } else if (filter) {
          if (filter.createdBefore) {
            whereConditions.push(sql`${posts.createdAt} < ${filter.createdBefore}`);
          }
          // Add other filter conditions as needed
        }

        // Only show non-deleted posts for soft delete
        if (mode === "soft") {
          whereConditions.push(isNull(posts.deletedAt));
        }

        // Determine where clause; allow BULK hard delete of all posts when explicitly confirmed
        let whereClause: any;
        if (whereConditions.length === 0) {
          if (mode === "hard" && !dryRun) {
            // BULK hard delete — operate on all posts
            whereClause = sql`1=1`;
          } else {
            throw new Error("No valid identifiers or filters provided");
          }
        } else {
          whereClause = whereConditions.length === 1
            ? whereConditions[0]
            : and(...whereConditions);
        }

        // Get posts that would be affected
        const postsToDelete = await db
          .select({
            id: posts.id,
            slug: posts.slug,
            title: posts.title,
            createdAt: posts.createdAt,
          })
          .from(posts)
          .where(whereClause);

        recordsAffected = postsToDelete.length;
        preview.records = postsToDelete;

        if (postsToDelete.length > 0) {
          const postIds = postsToDelete.map((p: any) => p.id);
          
          // Check cascade effects (comments that would be affected)
          const commentsCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(comments)
            .where(
              and(
                inArray(comments.postId, postIds),
                isNull(comments.deletedAt)
              )
            );
          
          preview.cascadeEffects.comments = commentsCount[0]?.count || 0;

          if (!dryRun) {
            if (mode === "soft") {
              // Soft delete posts
              await db
                .update(posts)
                .set({
                  deletedAt: new Date(),
                  deletedBy: currentUserId,
                })
                .where(whereClause);
            } else {
              // Hard delete posts (comments cascade via foreign key)
              await db.delete(posts).where(whereClause);
            }
          }
        }

      } else if (type === "comment") {
        // Similar logic for comments
        let whereConditions: any[] = [];

        if (id) {
          whereConditions.push(eq(comments.id, id));
        } else if (ids?.length) {
          whereConditions.push(inArray(comments.id, ids));
        } else if (filter) {
          if (filter.createdBefore) {
            whereConditions.push(sql`${comments.createdAt} < ${filter.createdBefore}`);
          }
          if (filter.status) {
            whereConditions.push(eq(comments.status, filter.status));
          }
          if (filter.userId) {
            whereConditions.push(eq(comments.userId, filter.userId));
          }
        }

        if (mode === "soft") {
          whereConditions.push(isNull(comments.deletedAt));
        }

        if (whereConditions.length === 0) {
          throw new Error("No valid identifiers or filters provided");
        }

        const whereClause = whereConditions.length === 1 
          ? whereConditions[0] 
          : and(...whereConditions);

        const commentsToDelete = await db
          .select({
            id: comments.id,
            postId: comments.postId,
            bodyHtml: comments.bodyHtml,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .where(whereClause);

        recordsAffected = commentsToDelete.length;
  preview.records = commentsToDelete.map((c: any) => ({
          id: c.id,
          postId: c.postId,
          excerpt: c.bodyHtml.substring(0, 100) + "...",
          createdAt: c.createdAt,
        }));

        if (commentsToDelete.length > 0 && !dryRun) {
          if (mode === "soft") {
            await db
              .update(comments)
              .set({
                deletedAt: new Date(),
                deletedBy: currentUserId,
              })
              .where(whereClause);
          } else {
            await db.delete(comments).where(whereClause);
          }
        }
      }

      // Update audit log with completion
      await db.update(dataOperationLogs)
        .set({
          status: "completed",
          recordsAffected,
          completedAt: new Date(),
        })
        .where(eq(dataOperationLogs.id, logEntry[0]!.id));

      return new Response(JSON.stringify({
        ok: true,
        operationId,
        dryRun,
        recordsAffected,
        preview,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      // Update audit log with error
      await db.update(dataOperationLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
        })
        .where(eq(dataOperationLogs.id, logEntry[0]!.id));

      throw error;
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message === "Forbidden" || message === "Unauthorized" ? 403 : 500;
    
    return new Response(JSON.stringify({
      ok: false,
      error: { message }
    }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}