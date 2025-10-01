CREATE TABLE "owner_recovery_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "owner_totp" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_base32" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"activated_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_used_step" integer
);
--> statement-breakpoint
CREATE TABLE "owner_webauthn_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" jsonb,
	"aaguid" text,
	"nickname" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone,
	CONSTRAINT "owner_webauthn_credential_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "security_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trusted_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_seen_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "trusted_device_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enforced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "owner_recovery_code" ADD CONSTRAINT "owner_recovery_code_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_totp" ADD CONSTRAINT "owner_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_webauthn_credential" ADD CONSTRAINT "owner_webauthn_credential_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_activity" ADD CONSTRAINT "security_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_device" ADD CONSTRAINT "trusted_device_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "owner_recovery_code_user_id_idx" ON "owner_recovery_code" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "owner_webauthn_credential_user_id_idx" ON "owner_webauthn_credential" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_activity_user_id_idx" ON "security_activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "security_activity_timestamp_idx" ON "security_activity" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "trusted_device_user_id_idx" ON "trusted_device" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trusted_device_token_hash_idx" ON "trusted_device" USING btree ("token_hash");