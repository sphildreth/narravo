// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { generateMonthlyRssFeed } from "@/lib/rss";

export async function GET(request: NextRequest, { params }: { params: { year: string; month: string } }) {
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return new Response("Invalid year or month", { status: 400 });
  }

  const rss = await generateMonthlyRssFeed(year, month);

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
