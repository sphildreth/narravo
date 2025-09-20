export type PostDTO = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  html?: string | null;
  bodyHtml?: string | null;
  publishedAt?: string | null;
  author?: { name?: string | null; image?: string | null } | null;
};
