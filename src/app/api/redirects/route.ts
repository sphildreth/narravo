// SPDX-License-Identifier: Apache-2.0
import { getRedirects } from "@/lib/redirects";
import logger from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // avoid prerendering during static export

export async function GET() {
  try {
    const redirects = await getRedirects();
    return Response.json(redirects, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      logger.warn("Failed to load redirects; returning empty list");
    }
    return Response.json([], {
      headers: {
        "Cache-Control": "public, max-age=5, s-maxage=5",
      },
    });
  }
}

