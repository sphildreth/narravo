CREATE TYPE "public"."data_operation_type" AS ENUM('export', 'restore', 'purge_soft', 'purge_hard');--> statement-breakpoint
CREATE TABLE "data_operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_type" "data_operation_type" NOT NULL,
	"user_id" uuid,
	"details" jsonb NOT NULL,
	"status" text NOT NULL,
	"records_affected" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"archive_filename" text,
	"archive_checksum" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "data_operation_logs" ADD CONSTRAINT "data_operation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_operation_logs_user_id_idx" ON "data_operation_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_operation_logs_type_idx" ON "data_operation_logs" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "data_operation_logs_created_at_idx" ON "data_operation_logs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;