CREATE TABLE "post_daily_views" (
	"day" text NOT NULL,
	"post_id" uuid NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"uniques" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "post_daily_views_pkey" PRIMARY KEY("day","post_id")
);
--> statement-breakpoint
CREATE TABLE "post_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"ts" timestamp with time zone DEFAULT now(),
	"session_id" text,
	"ip_hash" text,
	"user_agent" text,
	"referrer_host" text,
	"referrer_path" text,
	"user_lang" text,
	"bot" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "views_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_daily_views" ADD CONSTRAINT "post_daily_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_view_events" ADD CONSTRAINT "post_view_events_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_daily_views_post_id_day_idx" ON "post_daily_views" USING btree ("post_id","day");--> statement-breakpoint
CREATE INDEX "post_view_events_post_id_ts_idx" ON "post_view_events" USING btree ("post_id","ts");