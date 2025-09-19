# Narravo (Next.js + Postgres + Drizzle)

Minimal blog engine with Next.js App Router, Auth.js (GitHub/Google), Drizzle (Postgres), nested comments, reactions, and WXR import.

## Quick start
```bash
pnpm i
cp .env.example .env   # set DATABASE_URL + auth keys
pnpm drizzle:push      # create tables
pnpm dev
```
