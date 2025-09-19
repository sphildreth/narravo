import { NextRequest } from "next/server";
export async function POST(req: NextRequest) {
  return new Response(JSON.stringify({ url: "https://example.com/presigned" }), { status: 200 });
}
