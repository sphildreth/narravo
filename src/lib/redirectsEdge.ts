// SPDX-License-Identifier: Apache-2.0
import type { NextRequest } from "next/server";
import type { Redirect } from "@/lib/redirects";

export async function getRedirectsEdge(request: NextRequest): Promise<Redirect[]> {
  try {
    const apiUrl = new URL("/api/redirects", request.url);
    const res = await fetch(apiUrl.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as Redirect[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

