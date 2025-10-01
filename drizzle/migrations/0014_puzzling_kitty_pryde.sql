CREATE TABLE "page_daily_views" (
	"day" text NOT NULL,
	"path" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"uniques" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "page_daily_views_day_path_pk" PRIMARY KEY("day","path")
);
--> statement-breakpoint
CREATE TABLE "page_view_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
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
CREATE INDEX "page_daily_views_path_day_idx" ON "page_daily_views" USING btree ("path","day");--> statement-breakpoint
CREATE INDEX "page_view_events_path_ts_idx" ON "page_view_events" USING btree ("path","ts");--> statement-breakpoint
CREATE INDEX "page_view_events_ts_idx" ON "page_view_events" USING btree ("ts");