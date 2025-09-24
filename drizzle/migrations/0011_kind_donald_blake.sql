ALTER TABLE "posts" RENAME COLUMN "guid" TO "imported_system_id";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "posts_guid_unique";--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_imported_system_id_unique" UNIQUE("imported_system_id");