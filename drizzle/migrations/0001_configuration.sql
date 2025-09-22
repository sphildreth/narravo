-- Create enum type if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'config_value_type') THEN
    CREATE TYPE config_value_type AS ENUM ('string','integer','number','boolean','date','datetime','json');
  END IF;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS "configuration" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "user_id" uuid NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "type" config_value_type NOT NULL,
  "value" jsonb NOT NULL,
  "allowed_values" jsonb NULL,
  "required" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "configuration_key_user_uniq" UNIQUE ("key","user_id")
);

-- Partial unique index to enforce one global row per key
CREATE UNIQUE INDEX IF NOT EXISTS configuration_global_key_uniq
  ON configuration ("key")
  WHERE user_id IS NULL;

-- Secondary index for lookup
CREATE INDEX IF NOT EXISTS configuration_key_user_idx ON configuration ("key","user_id");

-- Checks
ALTER TABLE configuration
  ADD CONSTRAINT configuration_allowed_values_array_chk
  CHECK (allowed_values IS NULL OR jsonb_typeof(allowed_values) = 'array');

ALTER TABLE configuration
  ADD CONSTRAINT configuration_required_global_chk
  CHECK (required = false OR user_id IS NULL);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION set_configuration_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS configuration_set_updated_at ON configuration;
CREATE TRIGGER configuration_set_updated_at
BEFORE UPDATE ON configuration
FOR EACH ROW EXECUTE FUNCTION set_configuration_updated_at();

