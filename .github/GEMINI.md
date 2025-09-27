# Gemini Assistant Instructions for the Narravo Project

This document provides context for the AI assistant working on the Narravo codebase. Please adhere to these guidelines.

## 1. Project Overview

Narravo is a content and blogging platform built with a modern web stack. It focuses on performance, security, and robust content management features, including a Tiptap-based rich-text editor, comments, and WordPress content import.

## 2. Core Technologies

*   **Framework:** Next.js 15 (App Router)
*   **Language:** TypeScript
*   **Package Manager:** pnpm
*   **Database ORM:** Drizzle ORM with `pg` for PostgreSQL
*   **Authentication:** NextAuth.js v5
*   **Styling:** Tailwind CSS
*   **UI Components:** Radix UI primitives and Lucide for icons.
*   **Editor:** Tiptap for the rich-text editor.
*   **Form Handling:** React Hook Form

## 3. Architectural Principles

*   **Directory Structure:** We use the Next.js App Router conventions.
    *   API routes are in `src/app/api/`.
    *   Server-side logic, database queries, and utilities are in `src/lib/`.
*   **Data Mutations:** Use Server Actions (`src/app/actions/`) for all data mutations. Server Actions are configured with a `5mb` body size limit.
*   **Data Access:** All database interactions must go through the Drizzle ORM. The schema is defined in `drizzle/schema.ts`. Do not write raw SQL.
*   **Security:** The application implements a strict Content Security Policy (CSP). See `next.config.mjs` for details on allowed sources.
*   **Environment Variables:** Use the Zod-based schema in `env.d.ts` for type-safe environment variables.

## 4. Coding Conventions & Style

*   **Formatting:** All code is formatted with Prettier.
*   **Linting:** We use ESLint with the `eslint-config-next` preset.
*   **Naming:**
    *   Use `camelCase` for variables and functions.
    *   Use `PascalCase` for React components and TypeScript types/interfaces.
*   **Typing:** TypeScript is mandatory. Use strict types and avoid `any` whenever possible. Define shared types in `src/types/`.

## 5. Testing

*   **Unit/Component Tests:** We use Vitest and React Testing Library.
    *   Run tests with `pnpm test`.
    *   Test files are located in the `tests/` directory with a `.test.ts` or `.test.tsx` extension.
*   **E2E Tests:** End-to-end tests are in `tests/e2e/` and use Playwright.
*   **Philosophy:** Write tests for all new business logic, especially in `src/lib/`, `src/app/actions/`, and for critical UI components.

## 6. Important Scripts

*   **Development:** `pnpm dev`
*   **Testing:** `pnpm test`
*   **Type Checking:** `pnpm typecheck`
*   **Database Migrations:** `pnpm drizzle:generate`