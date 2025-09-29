"use server";
// SPDX-License-Identifier: Apache-2.0

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, comments, reactions } from "@/drizzle/schema";
import { eq, like, desc, asc, sql, and, or, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isEmailAdmin } from "@/lib/admin";
import logger from '@/lib/logger';

// Types for user management
export interface UsersFilter {
  search?: string;
  isAdmin?: boolean;
}

export interface UsersSortOptions {
  field: "email" | "name" | "createdAt" | "commentsCount" | "reactionsCount";
  direction: "asc" | "desc";
}

export interface UserWithStats {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  createdAt: Date | null;
  isAdmin: boolean;
  commentsCount: number;
  reactionsCount: number;
  recentComments: Array<{
    id: string;
    bodyHtml: string;
    createdAt: Date;
    postTitle: string;
    postSlug: string;
    status: string;
  }>;
}

// Input validation schemas
const anonymizeUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.literal("ANONYMIZE"),
});

// Confirmation schema for hard delete
const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.literal("DELETE"),
});

// Get paginated users with filtering and sorting
export async function getUsersWithFilters(
  filter: UsersFilter = {},
  sort: UsersSortOptions = { field: "email", direction: "asc" },
  page: number = 1,
  pageSize: number = 50
) {
  await requireAdmin();
  
  const offset = (page - 1) * pageSize;
  
  // Build where conditions
  const conditions = [];
  
  if (filter.search) {
    conditions.push(
      or(
        like(users.email, `%${filter.search}%`),
        like(users.name, `%${filter.search}%`)
      )
    );
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get users with basic info
  let orderBy;
  const direction = sort.direction === "asc" ? asc : desc;
  switch (sort.field) {
    case "name":
      orderBy = direction(users.name);
      break;
    case "createdAt":
      orderBy = direction(sql`COALESCE(${users.email}, '')::timestamp`); // Use email as proxy for created
      break;
    default:
      orderBy = direction(users.email);
  }
  
  const query = db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize + 1) // Get one extra to check if there are more pages
    .offset(offset);
  
  const rows = await query;
  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);
  
  // Get total count for pagination info
  const totalQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);
  
  const [totalResult] = await totalQuery;
  const total = totalResult?.count ?? 0;
  
  // Get stats for each user
  const userIds = items.map((u: any) => u.id);
  const userStats = await getUserStats(userIds);
  
  // Apply admin filter if specified
  const usersWithStats = items.map((user: any) => {
    const stats = userStats[user.id] || { commentsCount: 0, reactionsCount: 0, recentComments: [] };
    const isAdmin = isEmailAdmin(user.email);
    
    return {
      ...user,
      createdAt: null, // Users table doesn't have createdAt, using null
      isAdmin,
      ...stats,
    };
  }).filter((user: any) => {
    if (filter.isAdmin !== undefined) {
      return filter.isAdmin ? user.isAdmin : !user.isAdmin;
    }
    return true;
  });
  
  return {
    items: usersWithStats,
    pagination: {
      page,
      pageSize,
      total,
      hasMore,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

// Get detailed user information
export async function getUserDetails(userId: string) {
  await requireAdmin();
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user) {
    return null;
  }
  
  // Get user stats
  const stats = await getUserStats([userId]);
  const userStats = stats[userId] || { commentsCount: 0, reactionsCount: 0, recentComments: [] };
  
  const isAdmin = isEmailAdmin(user.email);
  
  return {
    ...user,
    createdAt: null, // Users table doesn't have createdAt, using null
    isAdmin,
    ...userStats,
  };
}

// Helper function to get user statistics
async function getUserStats(userIds: string[]): Promise<Record<string, {
  commentsCount: number;
  reactionsCount: number;
  recentComments: Array<{
    id: string;
    bodyHtml: string;
    createdAt: Date;
    postTitle: string;
    postSlug: string;
    status: string;
  }>;
}>> {
  if (userIds.length === 0) return {};
  
  // Get comment counts
  const commentCountsQuery = sql`
    SELECT 
      c.user_id,
      COUNT(*)::int as count
    FROM comments c
    WHERE c.user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY c.user_id
  `;
  
  const commentCountsResult: any = await db.execute(commentCountsQuery);
  const commentCountsRows: any[] = (commentCountsResult as any).rows ?? (Array.isArray(commentCountsResult) ? commentCountsResult : []);
  
  const commentCounts: Record<string, number> = {};
  commentCountsRows.forEach(row => {
    commentCounts[row.user_id] = Number(row.count);
  });
  
  // Get reaction counts
  const reactionCountsQuery = sql`
    SELECT 
      r.user_id,
      COUNT(*)::int as count
    FROM reactions r
    WHERE r.user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY r.user_id
  `;
  
  const reactionCountsResult: any = await db.execute(reactionCountsQuery);
  const reactionCountsRows: any[] = (reactionCountsResult as any).rows ?? (Array.isArray(reactionCountsResult) ? reactionCountsResult : []);
  
  const reactionCounts: Record<string, number> = {};
  reactionCountsRows.forEach(row => {
    reactionCounts[row.user_id] = Number(row.count);
  });
  
  // Get recent comments for each user
  const recentCommentsQuery = sql`
    SELECT 
      c.user_id,
      c.id,
      c.body_html as "bodyHtml",
      c.created_at as "createdAt",
      c.status,
      p.title as "postTitle",
      p.slug as "postSlug"
    FROM comments c
    LEFT JOIN posts p ON p.id = c.post_id
    WHERE c.user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY c.created_at DESC
    LIMIT 100
  `;
  
  const recentCommentsResult: any = await db.execute(recentCommentsQuery);
  const recentCommentsRows: any[] = (recentCommentsResult as any).rows ?? (Array.isArray(recentCommentsResult) ? recentCommentsResult : []);
  
  const recentCommentsByUser: Record<string, any[]> = {};
  recentCommentsRows.forEach(row => {
    if (!recentCommentsByUser[row.user_id]) {
      recentCommentsByUser[row.user_id] = [];
    }
    const userComments = recentCommentsByUser[row.user_id];
    if (userComments && userComments.length < 10) { // Limit to 10 recent comments per user
      userComments.push({
        id: row.id,
        bodyHtml: row.bodyHtml,
        createdAt: new Date(row.createdAt),
        postTitle: row.postTitle || 'Untitled',
        postSlug: row.postSlug || '',
        status: row.status,
      });
    }
  });
  
  // Combine all stats
  const result: Record<string, any> = {};
  userIds.forEach(userId => {
    result[userId] = {
      commentsCount: commentCounts[userId] || 0,
      reactionsCount: reactionCounts[userId] || 0,
      recentComments: recentCommentsByUser[userId] || [],
    };
  });
  
  return result;
}

// Anonymize user (delete user record, comments remain but are disassociated)
export async function anonymizeUser(formData: FormData) {
  await requireAdmin();
  
  const data = {
    userId: formData.get("userId") as string,
    confirmation: formData.get("confirmation") as string,
  };
  
  // Validate input
  const parsed = anonymizeUserSchema.safeParse(data);
  if (!parsed.success) {
    return { 
      error: parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ") 
    };
  }
  
  const { userId } = parsed.data;
  
  try {
    // Get user info before deletion
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user) {
      return { error: "User not found" };
    }
    
    // Check if user is an admin
    if (isEmailAdmin(user.email)) {
      return { error: "Cannot anonymize admin users" };
    }
    
    // Get comment count for confirmation
    const commentCountQuery = sql`
      SELECT COUNT(*)::int as count
      FROM comments
      WHERE user_id = ${userId}
    `;
    
    const commentCountResult: any = await db.execute(commentCountQuery);
    const commentCountRows: any[] = (commentCountResult as any).rows ?? (Array.isArray(commentCountResult) ? commentCountResult : []);
    const commentCount = Number(commentCountRows[0]?.count ?? 0);
    
    // Delete user (comments will be set to userId=null via foreign key constraint)
    await db.delete(users).where(eq(users.id, userId));
    
    // Revalidate admin pages
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");
    
    return { 
      success: true, 
      message: `User "${user.name || user.email}" has been anonymized. ${commentCount} comments are now anonymous.`
    };
  } catch (error) {
    logger.error("Error anonymizing user:", error);
    return { error: "Failed to anonymize user" };
  }
}

// Delete user entirely (hard delete)
export async function deleteUser(formData: FormData) {
  await requireAdmin();

  const data = {
    userId: formData.get("userId") as string,
    confirmation: formData.get("confirmation") as string,
  };

  const parsed = deleteUserSchema.safeParse(data);
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")
    };
  }

  const { userId } = parsed.data;

  try {
    // Get user info and admin check
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { error: "User not found" };
    }

    if (isEmailAdmin(user.email)) {
      return { error: "Cannot delete admin users" };
    }

    // Count comments to report back
    const commentCountResult: any = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM comments WHERE user_id = ${userId}
    `);
    const commentCountRows: any[] = (commentCountResult as any).rows ?? (Array.isArray(commentCountResult) ? commentCountResult : []);
    const commentCount = Number(commentCountRows[0]?.count ?? 0);

    // Delete user's comments first (to fully remove their content)
    if (commentCount > 0) {
      await db.delete(comments).where(eq(comments.userId, userId));
    }

    // Delete the user (reactions/config will cascade per FK rules)
    await db.delete(users).where(eq(users.id, userId));

    // Revalidate admin pages
    revalidatePath("/admin/users");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: `User "${user.name || user.email}" and ${commentCount} comment(s) have been deleted.`,
    };
  } catch (error) {
    logger.error("Error deleting user:", error);
    return { error: "Failed to delete user" };
  }
}

// Export user data (GDPR compliance)
export async function exportUserData(userId: string) {
  await requireAdmin();
  
  try {
    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
    if (!user) {
      return { error: "User not found" };
    }
    
    // Get user comments
    const userCommentsQuery = sql`
      SELECT 
        c.id,
        c.body_html as "bodyHtml",
        c.body_md as "bodyMd",
        c.status,
        c.created_at as "createdAt",
        p.title as "postTitle",
        p.slug as "postSlug"
      FROM comments c
      LEFT JOIN posts p ON p.id = c.post_id
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
    `;
    
    const commentsResult: any = await db.execute(userCommentsQuery);
    const commentsRows: any[] = (commentsResult as any).rows ?? (Array.isArray(commentsResult) ? commentsResult : []);
    
    // Get user reactions
    const userReactionsQuery = sql`
      SELECT 
        r.target_type as "targetType",
        r.target_id as "targetId",
        r.kind,
        r.created_at as "createdAt"
      FROM reactions r
      WHERE r.user_id = ${userId}
      ORDER BY r.created_at DESC
    `;
    
    const reactionsResult: any = await db.execute(userReactionsQuery);
    const reactionsRows: any[] = (reactionsResult as any).rows ?? (Array.isArray(reactionsResult) ? reactionsResult : []);
    
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      comments: commentsRows,
      reactions: reactionsRows,
      exportedAt: new Date().toISOString(),
    };
    
    return { success: true, data: exportData };
  } catch (error) {
    logger.error("Error exporting user data:", error);
    return { error: "Failed to export user data" };
  }
}

// Get admin visibility information
export async function getAdminVisibility() {
  await requireAdmin();
  
  try {
    // Get all admin emails from environment
    const adminEmails = process.env.ADMIN_EMAILS?.split(',')
      .map(email => email.trim().toLowerCase())
      .filter(Boolean) || [];
    
    // Find users that match admin emails
    const adminUsersQuery = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(
        adminEmails.length > 0 
          ? sql`LOWER(${users.email}) IN (${sql.join(adminEmails.map(email => sql`${email}`), sql`, `)})`
          : sql`false` // No admin emails configured
      );
    
    const adminUsers = await adminUsersQuery;
    
    return {
      adminEmails,
      adminUsers,
      totalAdmins: adminEmails.length,
      registeredAdmins: adminUsers.length,
    };
  } catch (error) {
    logger.error("Error getting admin visibility:", error);
    return {
      adminEmails: [],
      adminUsers: [],
      totalAdmins: 0,
      registeredAdmins: 0,
    };
  }
}