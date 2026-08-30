CREATE TYPE "public"."webauthn_ceremony" AS ENUM('registration', 'authentication');--> statement-breakpoint
CREATE TABLE "mfa_session_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webauthn_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge" text NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"ceremony" "webauthn_ceremony" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "mfa_session_grant" ADD CONSTRAINT "mfa_session_grant_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_challenge" ADD CONSTRAINT "webauthn_challenge_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mfa_session_grant_lookup_idx" ON "mfa_session_grant" USING btree ("user_id","session_id","expires_at");--> statement-breakpoint
CREATE INDEX "webauthn_challenge_lookup_idx" ON "webauthn_challenge" USING btree ("user_id","session_id","ceremony","challenge");--> statement-breakpoint
CREATE INDEX "webauthn_challenge_expiry_idx" ON "webauthn_challenge" USING btree ("expires_at");