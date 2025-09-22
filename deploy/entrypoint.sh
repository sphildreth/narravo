#!/usr/bin/env sh
set -e
echo "Starting Narravo…"
echo "DATABASE_URL=$DATABASE_URL"
if [ -f "./drizzle.config.ts" ] || [ -f "./drizzle.config.js" ]; then
  echo "Running Drizzle migrations (push)…"
  npx drizzle-kit@latest push || echo "Warning: drizzle push failed — continuing"
fi
echo "Launching Next.js on :3000"
node node_modules/next/dist/bin/next start -p 3000
