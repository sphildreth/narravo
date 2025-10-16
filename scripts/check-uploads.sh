#!/bin/bash
# SPDX-License-Identifier: Apache-2.0

echo "=== Upload Directory Diagnostic ==="
echo ""

echo "1. Checking directory structure..."
ls -la public/uploads/ 2>/dev/null || echo "ERROR: public/uploads/ does not exist!"

echo ""
echo "2. Checking subdirectories..."
for dir in images videos featured; do
  if [ -d "public/uploads/$dir" ]; then
    echo "✓ public/uploads/$dir exists"
    ls -ld public/uploads/$dir
  else
    echo "✗ public/uploads/$dir MISSING"
  fi
done

echo ""
echo "3. Checking recent uploads..."
find public/uploads/ -type f -mtime -1 2>/dev/null | head -10 || echo "No recent files or directory not accessible"

echo ""
echo "4. Checking permissions..."
echo "Current user: $(whoami) ($(id -u):$(id -g))"
if command -v stat >/dev/null 2>&1; then
  # Linux stat
  stat -c "Owner: %U (%u), Group: %G (%g), Mode: %a" public/uploads/ 2>/dev/null || \
  # macOS stat
  stat -f "Owner: %Su (%u), Group: %Sg (%g), Mode: %Lp" public/uploads/
fi

echo ""
echo "5. Testing write permissions..."
TEST_FILE="public/uploads/.write-test-$$"
if touch "$TEST_FILE" 2>/dev/null; then
  echo "✓ Can write to public/uploads/"
  rm "$TEST_FILE"
else
  echo "✗ CANNOT write to public/uploads/ - PERMISSION DENIED"
fi

echo ""
echo "6. Checking disk space..."
df -h public/uploads/ 2>/dev/null || df -h .

echo ""
echo "7. Checking file counts..."
for dir in images videos featured; do
  if [ -d "public/uploads/$dir" ]; then
    count=$(find "public/uploads/$dir" -type f 2>/dev/null | wc -l)
    echo "Files in $dir: $count"
  fi
done

echo ""
echo "8. Checking database upload records (last 10)..."
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" -c "SELECT id, key, status, \"createdAt\" FROM uploads ORDER BY \"createdAt\" DESC LIMIT 10;" 2>/dev/null || echo "Cannot connect to database"
else
  echo "DATABASE_URL not set - skipping database check"
fi

echo ""
echo "9. Checking environment variables..."
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "LOG_LEVEL: ${LOG_LEVEL:-not set}"
echo "S3_ENDPOINT: ${S3_ENDPOINT:-not set}"
echo "S3_BUCKET: ${S3_BUCKET:-not set}"
echo "R2_PUBLIC_URL: ${R2_PUBLIC_URL:-not set}"

echo ""
echo "=== End Diagnostic ==="
