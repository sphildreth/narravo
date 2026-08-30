#!/usr/bin/env sh
set -e
echo "Starting Narravo…"
if [ -f "./drizzle.config.ts" ] || [ -f "./drizzle.config.js" ]; then
  echo "Running Drizzle migrations…"
  pnpm drizzle:migrate || {
    echo "❌ Migration failed!"
    exit 1
  }
fi
echo "Launching Next.js on :3000"
exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
