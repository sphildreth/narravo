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

# Database
pnpm drizzle:generate   # Generate migration from schema changes
pnpm drizzle:push       # Apply schema to database
pnpm seed:config        # Seed configuration data
pnpm seed:posts         # Seed demo posts

# Import/Export
pnpm wxr:import path=./wxr/sample.wxr  # Import WordPress WXR file
```

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