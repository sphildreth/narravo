# Narravo — Production Deployment Guide

This guide covers three deployment options: a single VM with Docker Compose, Proxmox LXC (Debian 13, no Docker), and Vercel + Neon. The app is a Next.js (App Router) project using PostgreSQL via Drizzle ORM. Docker Compose is a simple way to self-host; Proxmox LXC is a lightweight alternative without containers; Vercel + Neon is fully managed.

## Prerequisites
- A domain name (optional but recommended)
- Optional (OAuth): GitHub and/or Google client ID and secret
- Per option:
	- Option A (Docker Compose): Docker and Docker Compose installed on the VM
	- Option B (Proxmox LXC): Proxmox host with two LXCs (app + Postgres) on the same bridge (e.g., vmbr0)
	- Option C (Vercel + Neon): Vercel account and a Neon Postgres database

## Option A — Single VM with Docker Compose

1) Clone the repo on your VM:
```bash
git clone https://github.com/sphildreth/narravo.git
cd narravo
```

2) Configure environment variables:
```bash
cp deploy/.env.example deploy/.env
# Open deploy/.env and set values for your environment.
# Required: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
# Recommended: ADMIN_EMAILS (comma-separated), OAuth provider credentials
```

3) Build and start the stack:
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f web
```
Notes:
- First boot runs database migrations automatically (via the container entrypoint) and then starts the app on port 3000.
- The compose file starts two services: `db` (Postgres 16) and `web` (Narravo).
- If optional object storage (S3/R2) is NOT configured, uploads default to local filesystem storage under `public/uploads` and are served by the app host (localhost in dev). Ensure persistence (Docker volume or durable disk path) if you care about retaining media across redeploys.

4) Seed initial data (optional):
```bash
# Seed site config (runs inside the web container)
docker compose -f docker-compose.prod.yml exec web pnpm -s seed:config

# Seed demo posts (optional)
docker compose -f docker-compose.prod.yml exec web pnpm -s seed:posts
```

5) TLS/HTTPS (optional but recommended):
You can terminate TLS with Caddy or Nginx. Example Caddy service to add to your compose file:

```yaml
caddy:
	image: caddy:2
	restart: unless-stopped
	ports:
		- "80:80"
		- "443:443"
	volumes:
		- ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
		- caddy_data:/data
		- caddy_config:/config
	depends_on:
		- web
```

And add these named volumes at the bottom of your compose file if not present:
```yaml
volumes:
	caddy_data:
	caddy_config:
```

Alternatively, use the provided `deploy/nginx.conf` with Nginx + Certbot on the host or in a container.

6) Backup and restore:
- Backup the database and uploads to a zip:
```bash
docker compose -f docker-compose.prod.yml exec web pnpm -s backup > backup-$(date +%F).zip
```
- Restore from a backup zip (pipe the file into the container):
```bash
cat backup-YYYY-MM-DD.zip | docker compose -f docker-compose.prod.yml exec -T web pnpm -s restore
```

7) Updating to a new version:
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Security notes:
- Change default Postgres credentials in `docker-compose.prod.yml` (and update `DATABASE_URL` accordingly) before exposing to the internet.
- Use a strong `NEXTAUTH_SECRET` (e.g., `openssl rand -base64 32`).
- Set `ADMIN_EMAILS` to a comma-separated list to control admin access.

## Option B — Proxmox LXC (Debian 13, no Docker)

This option runs Narravo directly on a Debian 13 (trixie) LXC without containers. It assumes you already created a separate PostgreSQL LXC in Proxmox and can reach it over the network.

1) Create the app LXC (in Proxmox UI):
	- Template: Debian 13 (trixie)
	- Unprivileged: ON (recommended)
	- Cores/Memory: ≥1 vCPU / 1–2 GB RAM (more for imports)
	- Network: bridged (vmbr0) with DHCP or static IP
	- Storage: 2–5 GB for code + logs (more if storing local uploads)

2) Prepare the PostgreSQL LXC (one-time):
	On the Postgres container, create a database and user for Narravo:
	```bash
	sudo -u postgres psql -c "CREATE USER narravo WITH PASSWORD 'change-me-strong';"
	sudo -u postgres psql -c "CREATE DATABASE narravo OWNER narravo;"
	sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE narravo TO narravo;"
	```
	Your connection URL (from the app LXC) will look like:
	`postgres://narravo:change-me-strong@<postgres-lxc-ip>:5432/narravo`

	Networking tips (Proxmox):
	- Assign the Postgres LXC an IP on the same bridge (e.g., vmbr0) as the app LXC.
	- In `/etc/postgresql/*/main/postgresql.conf`, set `listen_addresses = '*'` (or the app LXC’s subnet) and restart PostgreSQL.
	- In `/etc/postgresql/*/main/pg_hba.conf`, add an entry allowing the app LXC IP to connect, for example:
	  `host all narravo <app-lxc-ip>/32 scram-sha-256`
	- Restart PostgreSQL: `sudo systemctl restart postgresql`

3) Install Node.js 20 LTS, pnpm, and git on the app LXC:
```bash
sudo apt update && sudo apt -y install ca-certificates curl gnupg git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
sudo corepack enable
corepack enable
corepack prepare pnpm@10 --activate
```

4) Create a dedicated user and clone the repo:
```bash
sudo adduser --system --group --home /opt/narravo narravo
sudo -u narravo -H bash -lc "cd /opt && git clone https://github.com/sphildreth/narravo.git narravo && cd narravo && pnpm i --frozen-lockfile"
```

5) Configure environment and run migrations:
```bash
# Replace placeholders, keep the quotes around URLs/secrets
sudo tee /etc/narravo.env >/dev/null <<'EOF'
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=replace-with-strong-secret
DATABASE_URL=postgres://narravo:change-me-strong@<postgres-lxc-ip>:5432/narravo
ADMIN_EMAILS=admin@example.com
EOF

# Run migrations (one-time, uses DATABASE_URL from the command line)
sudo -u narravo -H bash -lc "cd /opt/narravo && DATABASE_URL=\"$(grep ^DATABASE_URL= /etc/narravo.env | cut -d= -f2- )\" pnpm -s drizzle:push"
```

6) Build the app:
```bash
sudo -u narravo -H bash -lc "cd /opt/narravo && pnpm -s build"
```

Optional: If you prefer a non-root writable uploads dir, create and link it:
```bash
sudo -u narravo -H bash -lc "mkdir -p /opt/narravo-data/uploads && ln -snf /opt/narravo-data/uploads /opt/narravo/public/uploads"
```

7) Run as a systemd service:
```bash
sudo tee /etc/systemd/system/narravo.service >/dev/null <<'EOF'
[Unit]
Description=Narravo (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=narravo
Group=narravo
WorkingDirectory=/opt/narravo
EnvironmentFile=/etc/narravo.env
ExecStart=/usr/bin/env pnpm start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now narravo
sudo systemctl status narravo --no-pager -l
```
Narravo listens on port 3000 by default. You can set `PORT=3000` in `/etc/narravo.env` if you want to be explicit.

Logs and health:
- View logs: `journalctl -u narravo -f`
- Check port: `ss -ltnp | grep 3000`

8) Enable HTTPS with Caddy (reverse proxy to :3000):
```bash
sudo apt -y install caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
your-domain.com {
  encode zstd gzip
  reverse_proxy localhost:3000
}
EOF
sudo systemctl enable --now caddy
sudo systemctl status caddy --no-pager -l
```
Point your domain A/AAAA DNS to the app LXC IP. Caddy will obtain/renew certificates automatically.

9) Optional: seed sample data (runs inside the app directory):
```bash
sudo -u narravo -H bash -lc "cd /opt/narravo && pnpm -s seed:config && pnpm -s seed:posts"
```

10) Backups and updates:
```bash
# Backup (creates a zip on stdout)
sudo -u narravo -H bash -lc "cd /opt/narravo && pnpm -s backup" > backup-$(date +%F).zip

# Update to latest code and rebuild
sudo -u narravo -H bash -lc "cd /opt/narravo && git pull && pnpm -s i --frozen-lockfile && pnpm -s build"
sudo systemctl restart narravo

# Restore (from a local zip file)
sudo -u narravo -H bash -lc "cd /opt/narravo && pnpm -s restore" < backup-YYYY-MM-DD.zip
```

Security notes:
- Use a strong `NEXTAUTH_SECRET` and rotate it if compromised.
- Keep the app user (`narravo`) unprivileged, and restrict file permissions to `/opt/narravo`.
- Restrict PostgreSQL to trusted networks and strong credentials on the DB LXC.
- Consider enabling S3/R2 for media storage in `/etc/narravo.env` if you expect large uploads.
 - On Proxmox, consider backups/snapshots of both LXCs (app and DB) for disaster recovery.


## Option C — Vercel + Neon (managed Postgres)
1) Create a Neon Postgres database and copy the connection string.
2) Import this repository into Vercel and set the following environment variables:
	 - `DATABASE_URL` — your Neon connection string
	 - `NEXTAUTH_URL` — your production URL (e.g., https://your-domain.com)
	 - `NEXTAUTH_SECRET` — strong random value
	 - OAuth provider credentials (GitHub/Google) as needed
	 - Optional: `ADMIN_EMAILS`, S3/R2 config, analytics salt
3) Run migrations once against Neon (from your local dev machine):
```bash
DATABASE_URL="<your-neon-url>" pnpm -s drizzle:push
```
Vercel will build and serve the app. No container is needed in this setup.

## Required and optional environment variables
- Required:
	- `DATABASE_URL`
	- `NEXTAUTH_URL`
	- `NEXTAUTH_SECRET`
- Recommended:
	- `ADMIN_EMAILS` (comma-separated emails with admin access)
	- OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional storage (pick one):
	- S3: `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`
	- R2: `R2_REGION`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- Optional analytics and content behavior:
	- `ANALYTICS_IP_SALT`, `EXCERPT_MAX_CHARS`, `EXCERPT_ELLIPSIS`, `EXCERPT_INCLUDE_BLOCK_CODE`

## Notes and troubleshooting
- Migrations:
	- Option A (Docker Compose): executed at container start by `deploy/entrypoint.sh`. To manage manually, comment that step and run `pnpm drizzle:push` during deploys.
	- Option B (Proxmox LXC): run `pnpm drizzle:push` manually (as shown in step 5) and on schema changes.
	- Option C (Vercel + Neon): run `pnpm drizzle:push` against Neon from a trusted environment (e.g., your local machine or CI).
- Ports and proxies:
	- Self-hosted (Options A/B) listens on port 3000 by default. Use Caddy/Nginx to expose 80/443 and handle TLS.
	- Vercel handles ports and TLS automatically.
- Storage:
 	- If S3/R2 is not configured, Narravo stores media locally under `public/uploads` and serves it from the app host (localhost in development). Ensure persistence: for Docker use volumes; for LXC/VM use a durable path (e.g., `/opt/narravo-data/uploads`).
