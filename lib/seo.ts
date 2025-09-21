// SPDX-License-Identifier: Apache-2.0
import { listPosts } from "@/lib/posts";
import { getArchiveMonths } from "@/lib/archives";
import type { PostDTO } from "@/src/types/content";
import type { Metadata } from "next";

const escapeXML = (str: string) => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export async function generateSitemap(siteUrl: string): Promise<string> {
  const urls: string[] = [];

  // Add home page
  urls.push(`<url><loc>${siteUrl}</loc></url>`);

  // Add posts
  let nextCursor: { publishedAt: string; id: string } | null = null;
  do {
    const postResult = await listPosts({ limit: 50, cursor: nextCursor });
    postResult.items.forEach((post) => {
      urls.push(`<url><loc>${siteUrl}/${post.slug}</loc></url>`);
    });
    nextCursor = postResult.nextCursor;
  } while (nextCursor);

  // Add archives
  const archiveMonths = await getArchiveMonths();
  archiveMonths.forEach((archive) => {
    urls.push(`<url><loc>${siteUrl}/archive/${archive.slug}</loc></url>`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join("\n  ")}
</urlset>`;

  return sitemap;
}

export function generatePostMetadata(post: PostDTO, siteUrl: string, siteName: string): Metadata {
  const postUrl = `${siteUrl}/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt || null,
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      type: "article",
      url: postUrl,
      title: post.title,
      description: post.excerpt || "",
      publishedTime: post.publishedAt || undefined,
      siteName: siteName,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || "",
    },
  };
}

export function generatePostJsonLd(post: PostDTO, siteUrl: string, siteName: string): string {
  const postUrl = `${siteUrl}/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl,
    },
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.publishedAt,
    "author": {
      "@type": "Organization",
      "name": siteName,
    },
    "publisher": {
      "@type": "Organization",
      "name": siteName,
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/images/logo-269x255.png`,
      },
    },
  };
  return JSON.stringify(jsonLd, null, 2);
}
