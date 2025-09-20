CREATE TYPE "public"."config_value_type" AS ENUM('string', 'integer', 'number', 'boolean', 'date', 'datetime', 'json');--> statement-breakpoint
CREATE TABLE "configuration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"user_id" uuid,
	"type" "config_value_type" NOT NULL,
	"value" jsonb NOT NULL,
	"allowed_values" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_parent_id_comments_id_fk";
--> statement-breakpoint
ALTER TABLE "configuration" ADD CONSTRAINT "configuration_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "configuration_key_user_idx" ON "configuration" USING btree ("key","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configuration_key_user_uniq" ON "configuration" USING btree ("key","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configuration_global_key_uniq" ON "configuration" USING btree ("key") WHERE "user_id" is null;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;