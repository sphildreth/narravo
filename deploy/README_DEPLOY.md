# Narravo — Production Deployment Guide

## Option A — Single VM (Docker Compose)
1) Clone repo to VM:
```bash
git clone https://github.com/your/repo.git narravo && cd narravo
```

2) Add files from this bundle:
- Dockerfile
- docker-compose.prod.yml
- deploy/entrypoint.sh
- deploy/.env.example (copy to deploy/.env)
- deploy/Caddyfile (optional) or deploy/nginx.conf

3) Configure env:
```bash
cp deploy/.env.example deploy/.env
# edit values, especially DATABASE_URL, NEXTAUTH_SECRET, OAuth keys
```

4) Build & run:
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f web
```
Migrations run on boot via drizzle-kit push, then Next.js listens on :3000.

5) TLS:
- Caddy (auto HTTPS) with deploy/Caddyfile, or
- Nginx + Certbot.

## Option B — Vercel + Neon
- Create Neon DB, get connection string.
- Import repo into Vercel.
- Add env vars (DATABASE_URL, NEXTAUTH_URL/SECRET, OAuth).
- Run migrations once from local against Neon:
```bash
DATABASE_URL="<neon-url>" pnpm drizzle:push
```

## Update cycle
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
