DELETE FROM "mfa_session_grant"
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (
			PARTITION BY "user_id", "session_id"
			ORDER BY "created_at" DESC NULLS LAST, "id" DESC
		) AS "duplicate_number"
		FROM "mfa_session_grant"
	) AS "ranked_grants"
	WHERE "duplicate_number" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "mfa_session_grant_session_unique" ON "mfa_session_grant" USING btree ("user_id","session_id");
