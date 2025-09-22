CREATE TYPE "public"."import_job_status" AS ENUM('queued', 'running', 'cancelling', 'cancelled', 'failed', 'completed');--> statement-breakpoint
CREATE TABLE "import_job_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"item_identifier" text NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"item_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "import_job_status" DEFAULT 'queued' NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"options" jsonb NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"posts_imported" integer DEFAULT 0 NOT NULL,
	"attachments_processed" integer DEFAULT 0 NOT NULL,
	"redirects_created" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login" text;--> statement-breakpoint
ALTER TABLE "import_job_errors" ADD CONSTRAINT "import_job_errors_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_job_errors_job_id_idx" ON "import_job_errors" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "import_job_errors_type_idx" ON "import_job_errors" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_unique" UNIQUE("login");