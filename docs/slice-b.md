# Slice B — Post Model & Static Rendering

- Queries live in `lib/posts.ts`; use `getPostBySlug(slug)` for individual pages and `listPosts({ page, pageSize })` for archives.
- Static post pages cache data with the tag pattern `post:{id}`; call `revalidateTag("post:{id}")` after mutations to refresh both the post and any cached list views.
- Home pagination is static with ISR (60s) and exposes list-level tags `posts:list` and `posts:list:page:{n}` for targeted revalidation.
