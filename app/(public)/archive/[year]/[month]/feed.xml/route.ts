// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { getMonthlyPostsForRSS, generateRSSXML, getSiteMetadata } from "@/lib/rss";
import { validateArchiveParams } from "@/lib/archives";

interface MonthlyFeedRouteParams {
  params: Promise<{ year: string; month: string }>;
}

export async function GET(request: NextRequest, { params }: MonthlyFeedRouteParams) {
  const { year, month } = await params;
  
  const validation = validateArchiveParams(year, month);
  if (!validation.isValid || !validation.yearNum || !validation.monthNum) {
    notFound();
  }

  const posts = await getMonthlyPostsForRSS(validation.yearNum, validation.monthNum);
  
  if (posts.length === 0) {
    notFound();
  }

  const siteMetadata = getSiteMetadata();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const monthName = monthNames[validation.monthNum - 1];
  const feedTitle = `${siteMetadata.title} - ${monthName} ${validation.yearNum}`;
  const feedDescription = `Posts from ${monthName} ${validation.yearNum}`;
  
  const rssXML = generateRSSXML({
    title: feedTitle,
    description: feedDescription,
    link: siteMetadata.url,
    posts,
    lastBuildDate: new Date(),
  });

  return new Response(rssXML, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

// Enable ISR
export const revalidate = 3600; // 1 hour