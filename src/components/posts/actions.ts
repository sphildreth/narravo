"use server";
// SPDX-License-Identifier: Apache-2.0
import { listPosts } from "@/lib/posts";
export async function fetchMorePosts({ cursor, limit = 10 }: { cursor: any, limit?: number }) {
  const r = await listPosts({ cursor, limit });
  return r;
}
