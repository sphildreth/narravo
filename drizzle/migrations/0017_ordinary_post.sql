CREATE TYPE "public"."upload_status" AS ENUM('temporary', 'committed');--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"status" "upload_status" DEFAULT 'temporary' NOT NULL,
	"user_id" uuid,
	"post_id" uuid,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"committed_at" timestamp with time zone,
	CONSTRAINT "uploads_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_status_idx" ON "uploads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "uploads_created_at_idx" ON "uploads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "uploads_post_id_idx" ON "uploads" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "uploads_session_id_idx" ON "uploads" USING btree ("session_id");