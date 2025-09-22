// SPDX-License-Identifier: Apache-2.0
export type PostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  bodyMd?: string | null; // Raw markdown content
  bodyHtml?: string | null; // Rendered HTML content
  html?: string | null; // Legacy field - deprecated
  publishedAt?: string | null;
  author?: { name?: string | null; image?: string | null } | null;
  viewsTotal?: number;
  viewsLastNDays?: number;
};
