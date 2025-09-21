// SPDX-License-Identifier: Apache-2.0
/**
 * Middleware for handling redirects
 */

import { NextRequest, NextResponse } from 'next/server';
import { findRedirect } from '@/lib/redirects';

export async function middleware(request: NextRequest) {
  try {
    // Only handle GET requests
    if (request.method !== 'GET') {
      return NextResponse.next();
    }

    const pathname = request.nextUrl.pathname;
    
    // Skip API routes, static files, and other special paths
    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/admin/') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/theme/') ||
      pathname.includes('.') || // Skip files with extensions
      pathname === '/' ||
      pathname === '/feed.xml' ||
      pathname === '/sitemap.xml'
    ) {
      return NextResponse.next();
    }

    // Look for redirect
    const redirect = await findRedirect(pathname);
    
    if (redirect) {
      return NextResponse.redirect(
        new URL(redirect.toPath, request.url), 
        redirect.status
      );
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
};