<!-- SPDX-License-Identifier: Apache-2.0 -->
# Development Guide

## Quick Reference

### Common Commands
```bash
# Development
pnpm dev                 # Start dev server (http://localhost:3000)
pnpm build              # Production build
pnpm start              # Start production server

# Code Quality
pnpm typecheck          # TypeScript compilation check
pnpm test               # Run tests
pnpm test:watch         # Run tests in watch mode
pnpm prechecks          # All local quality gates, fail-fast
pnpm prechecks:quick    # Static gates + typecheck only

# Database
pnpm drizzle:generate   # Generate migration from schema changes
pnpm drizzle:push       # Apply schema to database
pnpm seed:config        # Seed configuration data
pnpm seed:posts         # Seed demo posts

# Import/Export
pnpm wxr:import path=./wxr/sample.wxr  # Import WordPress WXR file
```

### CI and DB availability

- Unit tests do not require a running database. They use in-memory fallbacks and avoid live connections.
- The production build (pnpm build) succeeds even if the database is down. Pages that depend on DB are rendered dynamically at request time or fall back to safe defaults during build.
- If DATABASE_URL is not set, any attempt to use the db object at runtime will throw a clear error. During build, DB-backed pages/components are gated to avoid crashing the build.

### Pre-commit quality gate

`pnpm prechecks` (scripts/do-prechecks.py) runs the local gates in fail-fast
order: toolchain, release metadata, migration journal, SPDX headers, repository
hygiene, the gate tooling's own tests, lockfile sync, typecheck, ESLint, the
production build, then the Vitest suite. It stops on the first failing gate, so
fast checks surface before the slow ones. See README.md for the full gate table.

Notes for specific gates:

- **Release metadata** – bumping `package.json` requires a matching `## [x.y.z]`
  section in CHANGELOG.md and a matching README version badge.
- **Migration journal** – validates drizzle/migrations offline. Run
  `pnpm drizzle:generate` after editing `drizzle/schema.ts`; never edit a
  committed migration by hand. Add `--database` (with `DATABASE_URL` exported)
  to additionally run `pnpm drizzle:check` against a live database.
- **Production build** – warnings are treated as failures, including the Next.js
  `⚠` output that still exits zero.
- **ESLint** – `eslint . --max-warnings=0` across the workspace with
  `eslint.config.mjs` (`eslint-config-next` core-web-vitals + TypeScript rules).
  `pnpm lint:fix` applies autofixes. Every relaxation in the config is scoped to
  named files and says why; extend a scope deliberately, do not un-scope rules.
  Two dependency pins are load-bearing: ESLint stays on 9.x because
  eslint-plugin-react/jsx-a11y peer ranges stop at `^9` (ESLint 10 removed
  `context.getFilename`), and TypeScript stays on 6.x because `typescript-eslint`
  hard-errors on the TypeScript 7 native API. Drop the pins in
  `pnpm-workspace.yaml`/`package.json` only when the upstream packages allow it.
- `--install-hook` writes `.git/hooks/pre-commit`; `git commit --no-verify`
  bypasses it once, and `NARRAVO_PRECHECKS_ARGS` overrides the default arguments.

#### Deferred lint work

The gate is green today because four families of pre-existing patterns are exempted
per file, not globally. Each needs a real change with its own review:

- `@next/next/no-img-element` – five call sites keep `<img>`: the post featured
  image and comment attachments (the uploads table stores no intrinsic width or
  height, so `next/image` would need a fixed crop box instead of the natural-aspect
  layout), the lightbox (deliberately the original bytes of arbitrary imported
  media) and the two admin upload previews (`blob:` object URLs the optimizer cannot
  proxy). Avatars and the site banner do use `next/image`; converting the featured
  image properly starts with recording dimensions at upload time.
- `react-hooks/rules-of-hooks`, `static-components`, `refs`, `purity`,
  `immutability` – `TiptapEditor` declares `EditorToolbar`/`ImageBubbleMenu` inside
  render, reads and writes refs in the render body, and builds its upload session id
  with `Date.now()`/`Math.random()`. Hoisting them changes editor initialisation
  order, so do it with the skipped Playwright specs enabled.
- `react-hooks/set-state-in-effect` – `ImageLightbox`, `RenderTimeBadge` and
  `PostForm` sync external state (portal mount, `Server-Timing`, object-URL
  previews) with `setState` inside an effect; `useSyncExternalStore` or event-driven
  resets are the intended replacements. `CodeBlock` was the fourth case and is done:
  it sampled `<html data-theme>` once on mount, so toggling the theme left rendered
  code in the old palette until reload (covered by
  `tests/components/CodeBlockTheme.test.tsx`).
- `react-hooks/purity` on the post page – it times its own server render with
  `performance.now()`.

### Project Structure Patterns

#### Page Routes (App Router)
```typescript
// app/(public)/posts/[slug]/page.tsx
interface Props {
  params: { slug: string };
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug);
  if (!post) notFound();
  
  return <PostDetail post={post} />;
}
```

#### Server Actions
```typescript
// app/(admin)/posts/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function createPost(formData: FormData) {
  const parsed = createPostSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  // Database operation
  const post = await db.insert(posts).values(parsed.data).returning();
  
  revalidatePath("/admin/posts");
  return { success: true, post: post[0] };
}
```

#### Database Queries
```typescript
// lib/posts.ts
import { db } from "@/lib/db";
import { posts, comments } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function getPostWithComments(slug: string) {
  return await db
    .select()
    .from(posts)
    .leftJoin(comments, eq(comments.postId, posts.id))
    .where(eq(posts.slug, slug))
    .orderBy(desc(comments.createdAt));
}
```

#### Component Patterns
```typescript
// components/PostCard.tsx
interface PostCardProps {
  post: {
    id: string;
    title: string;
    excerpt?: string;
    publishedAt?: Date;
  };
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="p-4 border rounded-lg">
      <h3 className="text-xl font-semibold">{post.title}</h3>
      {post.excerpt && <p className="text-muted">{post.excerpt}</p>}
      {post.publishedAt && (
        <time className="text-sm text-muted">
          {post.publishedAt.toLocaleDateString()}
        </time>
      )}
    </article>
  );
}
```

### Database Schema Changes

1. **Edit schema**: Modify `drizzle/schema.ts`
2. **Generate migration**: `pnpm drizzle:generate`
3. **Review migration**: Check generated SQL in `drizzle/migrations/`
4. **Apply changes**: `pnpm drizzle:push`
5. **Update types**: TypeScript types are auto-generated

### Testing Patterns

```typescript
// tests/components/PostCard.test.tsx
import { render, screen } from "@testing-library/react";
import { PostCard } from "@/components/PostCard";

test("renders post title", () => {
  const post = {
    id: "1",
    title: "Test Post",
    excerpt: "Test excerpt",
    publishedAt: new Date("2024-01-01"),
  };

  render(<PostCard post={post} />);
  
  expect(screen.getByText("Test Post")).toBeInTheDocument();
  expect(screen.getByText("Test excerpt")).toBeInTheDocument();
});
```

### Environment Variables

Required variables for development:
```bash
# Database
DATABASE_URL=postgres://narravo:changeme@localhost:5432/narravo

# Auth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# OAuth (optional for development)
AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret
AUTH_GOOGLE_ID=your-google-client-id  
AUTH_GOOGLE_SECRET=your-google-client-secret

# Admin access
ADMIN_EMAILS=admin@example.com,editor@example.com

# File uploads (optional)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_BUCKET=your-bucket-name
```

### Debugging Tips

1. **Database issues**: Check PostgreSQL container is running with `docker ps`
2. **TypeScript errors**: Run `pnpm typecheck` for detailed error messages
3. **Build failures**: Clear `.next` directory and rebuild
4. **Auth issues**: Verify OAuth app callback URLs match `NEXTAUTH_URL`
5. **Import errors**: Use absolute imports with `@/` prefix

### Performance Best Practices

- Use Server Components for data fetching
- Implement proper caching with `revalidatePath`/`revalidateTag`
- Optimize images with Next.js `Image` component
- Use `Suspense` boundaries for loading states
- Minimize client-side JavaScript bundle size