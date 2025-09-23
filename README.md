<!-- SPDX-License-Identifier: Apache-2.0 -->

# Narravo: A Modern Next.js Blog Engine 🚀

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-blue?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-blue?logo=drizzle&logoColor=white)](https://orm.drizzle.team/)
[![Auth.js](https://img.shields.io/badge/Auth.js-blue?logo=next.js&logoColor=white)](https://authjs.dev/)
[![Docker](https://img.shields.io/badge/Docker-blue?logo=docker&logoColor=white)](https://www.docker.com/)

Narravo is a sleek, minimal, and feature-rich blog engine designed for developers who appreciate modern web technologies and a robust content management experience. Built with the latest Next.js App Router, TypeScript, and Drizzle ORM, it offers a powerful foundation for your next personal blog or content platform.

✨ **Key Features:**

*   **Next.js 14 App Router:** Leverage Server Components, Server Actions, and advanced caching for optimal performance.
*   **TypeScript:** Enjoy a fully typed codebase for enhanced reliability and developer experience.
*   **Tailwind CSS:** Rapidly build beautiful, responsive UIs with a utility-first CSS framework.
*   **PostgreSQL + Drizzle ORM:** A modern, type-safe ORM for seamless database interactions.
*   **Auth.js (NextAuth):** Secure authentication with GitHub and Google OAuth providers out-of-the-box.
*   **WordPress WXR Import:** Robustly import posts, comments, media, tags, and more from WordPress via the Admin UI or CLI.
*   **Nested Comments & Reactions:** Engage your audience with threaded comments, attachments (image/video), and emoji-like reactions.
*   **Admin Dashboard:** A powerful moderation queue to manage comments, attachments, and user content.
*   **S3/R2 Media Uploads:** Scalable media storage with presigned URLs for AWS S3 or Cloudflare R2.
*   **Config Service:** Centralized, database-backed configuration for dynamic feature and UX settings.
*   **Dockerized Development:** Easy local setup with Docker Compose for PostgreSQL.
*   **Comprehensive Testing:** Built with Vitest and Testing Library for robust code quality.

---

## 🚀 Quick Start

Get Narravo up and running in minutes!

**Prerequisites:**
*   [Docker](https://www.docker.com/get-started)
*   [Node.js](https://nodejs.org/en/download/) (v18+)
*   [pnpm](https://pnpm.io/installation)

```bash
# 0) Start PostgreSQL database with Docker Compose
docker compose up -d db

# 1) Install project dependencies
pnpm install

# 2) Configure environment variables
cp .env.example .env
# IMPORTANT: Ensure DATABASE_URL and NEXTAUTH_SECRET are set.
# For local Docker, .env.example defaults usually work.

# 3) Apply database schema (create tables)
pnpm drizzle:push

# 4) Seed essential configuration defaults
pnpm seed:config

# 5) (Optional) Seed demo posts and comments
pnpm seed:posts

# 6) Start the development server
pnpm dev
# Open your browser to http://localhost:3000
```

> 💡 **Manual DB Setup:** If you prefer a manual PostgreSQL instance, update `DATABASE_URL` in your `.env` file and skip the `docker compose up -d db` step.

---

## ⚙️ Configuration

All environment variables are documented in detail within the `.env.example` file. Copy it to `.env` and adjust as needed:

```bash
cp .env.example .env
```

**Key Variables:**

*   `DATABASE_URL`: PostgreSQL connection string.
*   `NEXTAUTH_SECRET`: A strong, random string for session/JWT encryption.
*   `NEXTAUTH_URL`: Your application's URL (e.g., `http://localhost:3000`).
*   `ADMIN_EMAILS`: Comma-separated list of emails for admin access.

**Optional Integrations:**

*   **OAuth:** `GITHUB_ID`, `GITHUB_SECRET`, `GOOGLE_ID`, `GOOGLE_SECRET`
*   **Media Storage:** Configure either `S3_*` (AWS S3) or `R2_*` (Cloudflare R2) variables.

---

## 🗄️ Database Management

Narravo uses Drizzle ORM for type-safe database interactions and migrations.

*   **Generate Migrations:** Create new migration files based on schema changes.
    ```bash
    pnpm drizzle:generate
    ```
*   **Apply Schema:** Push the current schema to your database.
    ```bash
    pnpm drizzle:push
    ```
*   **Seed Configuration:** Essential for initial setup and default settings.
    ```bash
    pnpm seed:config
    ```
*   **Seed Demo Content:** Populate your blog with sample posts and comments.
    ```bash
    pnpm seed:posts
    ```

---

## 🛠️ Development Scripts

A quick reference for common development tasks:

| Command                 | Description                                     |
| :---------------------- | :---------------------------------------------- |
| `pnpm dev`              | Start the Next.js development server            |
| `pnpm build`            | Create a production-ready build                 |
| `pnpm start`            | Start the production server                     |
| `pnpm typecheck`        | Run TypeScript type checks                      |
| `pnpm test`             | Execute the full test suite (Vitest)            |
| `pnpm test:watch`       | Run tests in watch mode                         |
| `pnpm drizzle:generate` | Generate new Drizzle migrations                 |
| `pnpm drizzle:push`     | Apply schema changes to the database            |
| `pnpm seed:config`      | Seed default configuration values               |
| `pnpm seed:posts`       | Seed demo posts and comments                    |

---

## 📂 Project Structure

A high-level overview of the project's directory layout:

```
src/app/                # Next.js App Router routes (admin, auth, public, api)
src/components/         # Reusable UI components
src/lib/                # Server-side services, utilities, and business logic
src/types/              # TypeScript types (consolidated)
drizzle/                # Drizzle ORM schema and database migrations
scripts/                # Utility scripts (seeding)
tests/                  # Unit and integration tests
docs/                   # Project documentation and specifications
```

---

## 🔄 WordPress WXR Import

Narravo includes a powerful and resilient WordPress import tool to migrate your content from a WordPress WXR export file.

**Import Capabilities:**

*   **Comprehensive Content:** Imports posts, comments (with threading), categories, and tags.
*   **Flexible Statuses:** Choose which post statuses to import (e.g., `publish`, `draft`).
*   **Media & SEO:** Downloads media to S3/R2, rewrites content URLs, and creates 301 redirects from old WordPress post URLs.
*   **Resilient Process:** Features include dry-runs, real-time progress, job cancellation, and detailed error logging.
*   **Admin UI & CLI:** Manage imports through the Admin Dashboard or automate them with a CLI script.

For a complete guide, see the [**WordPress Import Documentation**](./docs/wordpress-import.md).

---

## 🧪 Testing

We use [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) for our test suite.

*   **Run all tests:**
    ```bash
    pnpm test
    ```
*   **Type checking only:**
    ```bash
    pnpm typecheck
    ```

---

## 🤝 Contributing

We welcome contributions! Please refer to our [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for detailed guidelines.

**Quick Guidelines:**

*   Use `pnpm` for package management.
*   Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for clear commit messages.
*   Keep Pull Requests focused and include tests for behavior changes.
*   Align with existing project patterns (App Router, Server Actions, Drizzle, Zod).
*   Update documentation (`docs/` and `README.md`) as needed.

---

## 📄 License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for more details.

---

## 🧑 About Me Sidebar

An optional About Me section can appear in the public sidebar.

- Enable/disable: SITE.ABOUT-ME.ENABLED (boolean)
- Title: SITE.ABOUT-ME.TITLE (string)
- Content: SITE.ABOUT-ME.CONTENT (string)

You can manage these in the Admin Dashboard:

- Navigate to Admin -> System -> About Me
- Toggle enable, edit the title and content, then Save Changes

When enabled, the About Me section renders above the Recent posts list.
