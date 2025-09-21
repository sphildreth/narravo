// SPDX-License-Identifier: Apache-2.0
/**
 * Redirects handling utilities
 */

import { db } from "@/lib/db";
import { redirects } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Find redirect for a given path
 */
export async function findRedirect(fromPath: string): Promise<{ toPath: string; status: number } | null> {
  try {
    const result = await db
      .select({
        toPath: redirects.toPath,
        status: redirects.status,
      })
      .from(redirects)
      .where(eq(redirects.fromPath, fromPath))
      .limit(1);

    return result[0] || null;
  } catch (error) {
    console.error('Error finding redirect:', error);
    return null;
  }
}

/**
 * Create a new redirect
 */
export async function createRedirect(fromPath: string, toPath: string, status: number = 301): Promise<void> {
  await db.insert(redirects).values({
    fromPath,
    toPath,
    status,
  });
}

/**
 * Get all redirects (for bulk operations)
 */
export async function getAllRedirects(): Promise<Array<{ fromPath: string; toPath: string; status: number }>> {
  try {
    const result = await db
      .select({
        fromPath: redirects.fromPath,
        toPath: redirects.toPath,
        status: redirects.status,
      })
      .from(redirects);

    return result;
  } catch (error) {
    console.error('Error getting all redirects:', error);
    return [];
  }
}