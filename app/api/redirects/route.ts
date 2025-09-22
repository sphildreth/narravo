// SPDX-License-Identifier: Apache-2.0
import { getRedirects } from "@/lib/redirects";

export const runtime = "nodejs";

export async function GET() {
  try {
    const redirects = await getRedirects();
    return Response.json(redirects, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (err) {
    console.error("Failed to load redirects:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

