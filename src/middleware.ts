// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedirectsEdge } from "@/lib/redirectsEdge";
import logger from "@/lib/logger";

// Simple in-memory cache for redirects
let redirectsCache: { fromPath: string; toPath: string }[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

async function getCachedRedirects(request: NextRequest) {
  const now = Date.now();
  if (!redirectsCache || now - cacheTimestamp > CACHE_DURATION_MS) {
    redirectsCache = await getRedirectsEdge(request);
    cacheTimestamp = now;
    logger.debug(`Refreshed redirects cache: ${redirectsCache?.length ?? 0} entries`);
  }
  return redirectsCache;
}

export async function middleware(request: NextRequest) {
  const startTime = performance.now();
  const pathname = request.nextUrl.pathname;

  logger.debug(`Processing: ${pathname}`);
  
  const redirects = await getCachedRedirects(request);
  logger.debug(`Found ${redirects?.length || 0} redirects in cache`);

  // Handle YYYY/MM/DD/slug format
  const dateBasedPathRegex = /^\/\d{4}\/\d{2}\/\d{2}\/(.+)$/;
  const match = pathname.match(dateBasedPathRegex);

  if (match && match[1]) {
    const slug = match[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}`;
    logger.debug(`DATE-BASED REDIRECT - Redirecting ${pathname} -> ${url.pathname}`);
    return NextResponse.redirect(url, 301);
  }
  
  if (redirects && redirects.length > 0) {
    for (const redirect of redirects) {
      // Handle exact match first
      if (pathname === redirect.fromPath) {
        const url = request.nextUrl.clone();
        url.pathname = redirect.toPath;
        logger.debug(`EXACT MATCH - Redirecting ${pathname} -> ${url.pathname}`);
        return NextResponse.redirect(url, 301);
      }
      
      // Handle trailing slash variations - more robust approach
      // Case 1: Request has no slash, database has slash
      if (!pathname.endsWith('/') && redirect.fromPath === pathname + '/') {
        const url = request.nextUrl.clone();
        url.pathname = redirect.toPath;
        logger.debug(`TRAILING SLASH MATCH (add/) - Redirecting ${pathname} -> ${url.pathname}`);
        return NextResponse.redirect(url, 301);
      }
      
      // Case 2: Request has slash, database has no slash  
      if (pathname.endsWith('/') && redirect.fromPath === pathname.slice(0, -1)) {
        const url = request.nextUrl.clone();
        url.pathname = redirect.toPath;
        logger.debug(`TRAILING SLASH MATCH (remove/) - Redirecting ${pathname} -> ${url.pathname}`);
        return NextResponse.redirect(url, 301);
      }
    }
    
    if (pathname.includes('ghost-iron-maiden')) {
      logger.debug(`Ghost path detected: ${pathname}`);
      const matchingRedirect = redirects.find(r => 
        r.fromPath.includes('ghost-iron-maiden') || r.toPath.includes('ghost-iron-maiden')
      );
      if (matchingRedirect) {
        logger.debug(`Found matching ghost redirect: ${matchingRedirect.fromPath} -> ${matchingRedirect.toPath}`);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (uploaded static files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
