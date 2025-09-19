
-- scripts/posts_diagnostics.sql
-- Run within your DB (psql or any client). Helps find why posts aren't rendering.

-- 1) What columns exist on posts?
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'posts'
ORDER BY ordinal_position;

-- 2) Do we have any rows?
SELECT count(*) AS total FROM posts;

-- 3) What's the breakdown of status / published flags?
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='status') THEN
    RAISE NOTICE 'Status breakdown:';
    EXECUTE 'SELECT status, count(*) FROM posts GROUP BY status ORDER BY 2 DESC';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='published') THEN
    RAISE NOTICE 'Published (boolean) breakdown:';
    EXECUTE 'SELECT published, count(*) FROM posts GROUP BY published ORDER BY 2 DESC';
  END IF;
END$$;

-- 4) Are published_at values present?
SELECT
  SUM(CASE WHEN published_at IS NULL THEN 1 ELSE 0 END) AS null_published_at,
  MIN(published_at) AS earliest,
  MAX(published_at) AS latest
FROM posts;

-- 5) Peek at a few rows
SELECT id, slug, title, status, published, published_at
FROM posts
ORDER BY created_at DESC NULLS LAST
LIMIT 10;
