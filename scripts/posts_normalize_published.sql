
-- scripts/posts_normalize_published.sql
-- Make sure posts will appear even if seeder didn't set fields.
-- Review before running in production.

-- If status column exists, set a default and backfill.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='status') THEN
    -- set default to 'published' if not present already
    BEGIN
      ALTER TABLE posts ALTER COLUMN status SET DEFAULT 'published';
    EXCEPTION WHEN others THEN
      -- ignore if not applicable
      NULL;
    END;
    -- backfill NULLs to 'published'
    UPDATE posts SET status = 'published' WHERE status IS NULL;
  END IF;
END$$;

-- If published_at exists, default to now() and backfill missing timestamps.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='published_at') THEN
    BEGIN
      ALTER TABLE posts ALTER COLUMN published_at SET DEFAULT now();
    EXCEPTION WHEN others THEN
      NULL;
    END;
    UPDATE posts SET published_at = now() WHERE published_at IS NULL;
  END IF;
END$$;

-- If a boolean published flag exists, backfill true when status is published.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='posts' AND column_name='published') THEN
    UPDATE posts
      SET published = true
      WHERE (published IS NULL OR published = false)
        AND (status = 'published' OR status IS NULL);
  END IF;
END$$;
