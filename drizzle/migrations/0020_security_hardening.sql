CREATE TABLE "rate_limit_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_bucket_expiry_idx" ON "rate_limit_bucket" USING btree ("expires_at");