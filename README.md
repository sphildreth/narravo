# Narravo (Next.js + Postgres + Drizzle)

Minimal blog engine with Next.js App Router, Auth.js (GitHub/Google), Drizzle (Postgres), nested comments, reactions, and WXR import.

## Quick start
```bash
pnpm i
cp .env.example .env   # set DATABASE_URL + auth keys
pnpm drizzle:push      # create tables
pnpm dev
```

## Docker-based DB onboarding (Postgres in minutes)

**Prereqs**: Docker & Docker Compose, Node 18+, and `pnpm` (or `npm`/`yarn`).  
We ship a minimal `docker-compose.yml` that runs Postgres locally.

### 1) Start Postgres with Docker
```bash
# from repo root
docker compose up -d db
# Wait until the container is healthy (first start can take a few seconds)
docker ps
```

The compose file exposes Postgres on `localhost:5432` with:
- **DB name**: `narravo`
- **User**: `narravo`
- **Password**: `changeme`

### 2) Create your env file
```bash
cp .env.example .env
```

Set `DATABASE_URL` to match the Compose service:
```
DATABASE_URL=postgres://narravo:changeme@localhost:5432/narravo
```

(Also set your `NEXTAUTH_SECRET` and GitHub/Google OAuth keys when ready.)

### Admin access

Narravo grants admin capabilities to emails defined in the `ADMIN_EMAILS` env var. Provide a comma-separated list (case-insensitive):

```
ADMIN_EMAILS=admin@example.com,editor@example.com
```

Only allowlisted accounts can reach admin-only server actions once those slices land.

### 3) Install deps & create tables
```bash
pnpm i
pnpm drizzle:push
```

This pushes the Drizzle schema to your local Postgres and creates tables (`posts`, `users`, `comments`, `comment_attachments`, `reactions`, `redirects`).

### 4) Run the dev server
```bash
pnpm dev
# open http://localhost:3000
```

### 5) (Optional) Try the WXR importer stub
```bash
pnpm wxr:import path=./sample.wxr
```
_(The stub just creates placeholder posts by title. The real importer will also download media and rewrite URLs.)_

### Verify DB connection
- Quick check with psql (optional):
  ```bash
  docker exec -it $(docker ps -qf name=narravo-next-db) psql -U narravo -d narravo -c "\dt"
  ```

### Stop / reset the DB
```bash
# stop only
docker compose stop db

# remove container but keep data
docker compose rm -f db

# nuke data volume (fresh start)
docker compose down -v
```

### Troubleshooting
- **Port 5432 already in use**: shut down other Postgres services or edit the `ports:` mapping in `docker-compose.yml` (e.g., `55432:5432`) and update `DATABASE_URL` accordingly.
- **`drizzle:push` fails**: ensure `DATABASE_URL` is correct and the container is running: `docker compose ps`.
- **Auth callback mismatch**: once you deploy or change ports, update `NEXTAUTH_URL` and your GitHub/Google OAuth app callback URLs to match.
