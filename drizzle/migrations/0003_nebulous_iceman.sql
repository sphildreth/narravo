ALTER TABLE "posts" ADD COLUMN "guid" text;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_guid_unique" UNIQUE("guid");