-- Add body_md column for raw markdown content  
ALTER TABLE "posts" ADD COLUMN "body_md" text;

-- Add body_html column for rendered HTML content (nullable initially for backfill)
ALTER TABLE "posts" ADD COLUMN "body_html" text;

-- Backfill body_html with existing html content for all posts
UPDATE "posts" SET "body_html" = "html" WHERE "body_html" IS NULL;

-- Make body_html NOT NULL after backfill (this will be handled in application code for new posts)
-- ALTER TABLE "posts" ALTER COLUMN "body_html" SET NOT NULL;