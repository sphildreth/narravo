# GitHub Copilot Instructions for Narravo

## Project Overview

Narravo is a modern blog platform built with Next.js 14 App Router, TypeScript, React, and PostgreSQL. The project emphasizes type safety, performance, and clean architecture.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Auth.js (NextAuth) with GitHub/Google OAuth
- **Testing**: Vitest with React Testing Library
- **Package Manager**: pnpm
- **Deployment**: Docker Compose for local development

## Code Style & Standards

### TypeScript Configuration
- Strict mode enabled with `strictNullChecks`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`
- Use `satisfies` for type assertions when maintaining type inference
- Prefer explicit return types for functions and components
- Always handle null/undefined cases explicitly

### React/Next.js Patterns
- Use React Server Components by default; mark Client Components with `"use client"`
- Prefer App Router patterns over Pages Router
- Use Server Actions for mutations with proper validation
- Implement proper loading and error boundaries
- Follow Next.js 14 caching strategies (force-cache, no-store, revalidate)

### Database & API Design
- Use Drizzle ORM for all database operations
- Implement proper SQL injection prevention
- Use transactions for multi-table operations
- Follow REST principles for API routes
- Validate all inputs with Zod schemas

### File Organization
```
app/                    # Next.js App Router pages
├── (admin)/           # Admin routes group
├── (auth)/            # Auth routes group
├── (public)/          # Public routes group
├── api/               # API routes
components/            # Reusable React components
lib/                   # Utility functions and services
drizzle/              # Database schema and migrations
tests/                # Test files
types/                # TypeScript type definitions
```

## Development Guidelines

### Component Patterns
- Use TypeScript interfaces for props
- Implement proper error boundaries
- Use React.forwardRef for ref forwarding
- Prefer composition over inheritance
- Keep components focused and single-responsibility

### State Management
- Use React Server Components state for server data
- Use useState/useReducer for client state
- Implement optimistic updates for better UX
- Use React Hook Form for form state management

### Error Handling
- Implement proper error boundaries
- Use Next.js error pages (error.tsx, not-found.tsx)
- Log errors appropriately without exposing sensitive data
- Provide meaningful error messages to users

### Performance
- Use Next.js Image component for images
- Implement proper caching strategies
- Use React.memo for expensive components
- Optimize bundle size with dynamic imports
- Use Suspense for data fetching

### Security
- Sanitize HTML content using isomorphic-dompurify
- Validate all user inputs on both client and server
- Use CSRF protection for admin actions
- Implement proper rate limiting
- Never expose sensitive data in client-side code

### Testing
- Write unit tests for utility functions
- Use React Testing Library for component tests
- Test Server Actions and API routes
- Mock external dependencies appropriately
- Aim for meaningful test coverage over metrics

## Commands & Workflows

### Development Commands
```bash
pnpm install           # Install dependencies
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm typecheck        # Run TypeScript compiler
pnpm test             # Run tests
pnpm test:watch       # Run tests in watch mode
```

### Database Commands
```bash
pnpm drizzle:generate  # Generate migrations
pnpm drizzle:push      # Push schema to database
pnpm seed:config       # Seed configuration data
pnpm seed:posts        # Seed demo posts
```

### Import/Export
```bash
pnpm wxr:import        # Import WordPress WXR files
```

## Common Patterns & Examples

### Server Action Pattern
```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const schema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

export async function createPost(formData: FormData) {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  try {
    const post = await db.insert(posts).values(parsed.data).returning();
    revalidatePath("/admin/posts");
    return { success: true, post: post[0] };
  } catch (error) {
    return { error: "Failed to create post" };
  }
}
```

### Database Query Pattern
```typescript
import { db } from "@/lib/db";
import { posts, comments } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";

export async function getPostWithComments(slug: string) {
  const result = await db
    .select()
    .from(posts)
    .leftJoin(comments, eq(comments.postId, posts.id))
    .where(eq(posts.slug, slug))
    .orderBy(desc(comments.createdAt));

  return result;
}
```

### Component with Server Component Pattern
```typescript
import { Suspense } from "react";
import { PostList } from "@/components/PostList";
import { Loading } from "@/components/Loading";

export default async function PostsPage() {
  return (
    <div>
      <h1>Posts</h1>
      <Suspense fallback={<Loading />}>
        <PostList />
      </Suspense>
    </div>
  );
}
```

## Specific Constraints

### Database
- Use PostgreSQL-compatible SQL only
- Always use parameterized queries via Drizzle
- Implement proper indexes for query performance
- Use transactions for consistency

### Authentication
- Admin access controlled via ADMIN_EMAILS environment variable
- Use Auth.js providers (GitHub, Google)
- Implement proper session management
- Protect admin routes with middleware

### Content Security
- Sanitize all HTML content before storage and display
- Use DOMPurify for client-side sanitization
- Validate file uploads thoroughly
- Implement CSRF protection

### Caching
- Use Next.js built-in caching strategically
- Implement proper cache invalidation
- Use revalidatePath/revalidateTag appropriately

## Documentation Standards

- Update README.md for user-facing changes
- Document API endpoints with examples
- Include TypeScript types in documentation
- Provide clear setup and deployment instructions

## Commit Standards

Use Conventional Commits format:
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for test additions/changes
- `chore:` for maintenance tasks

Keep commits atomic and descriptive. Reference issues where applicable.