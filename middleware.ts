// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedirectsEdge } from "@/lib/redirectsEdge";

// This is a simple in-memory cache. For a real app, you might use
// something more robust like Redis or Next.js's Data Cache with revalidation.
let redirectsCache: { fromPath: string; toPath: string }[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

async function getCachedRedirects(request: NextRequest) {
  const now = Date.now();
  if (!redirectsCache || now - cacheTimestamp > CACHE_DURATION_MS) {
    redirectsCache = await getRedirectsEdge(request);
    cacheTimestamp = now;
    console.log(`[middleware] Refreshed redirects cache: ${redirectsCache.length} entries`);
  }
  return redirectsCache;
}

export async function middleware(request: NextRequest) {
  const redirects = await getCachedRedirects(request);
  const pathname = request.nextUrl.pathname;

  if (redirects) {
    for (const redirect of redirects) {
      if (pathname === redirect.fromPath) {
        const url = request.nextUrl.clone();
        url.pathname = redirect.toPath;
        console.log(`[middleware] Redirecting ${pathname} -> ${url.pathname}`);
        return NextResponse.redirect(url, 301);
      }
    }
  }

  // Inject route context for server components (e.g., Navbar)
  const requestHeaders = new Headers(request.headers);
  const isAdmin = pathname.startsWith("/admin");
  requestHeaders.set("x-app-context", isAdmin ? "admin" : "site");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - feed.xml (RSS feed)
     * - sitemap.xml (Sitemap)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|feed.xml|sitemap.xml).*)",
  ],
};
