DELETE FROM "webauthn_challenge"
WHERE "id" IN (
	SELECT "id" FROM (
		SELECT "id", row_number() OVER (
			PARTITION BY "user_id", "session_id", "ceremony"
			ORDER BY "created_at" DESC NULLS LAST, "id" DESC
		) AS "duplicate_number"
		FROM "webauthn_challenge"
	) AS "ranked_challenges"
	WHERE "duplicate_number" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "webauthn_challenge_session_ceremony_unique" ON "webauthn_challenge" USING btree ("user_id","session_id","ceremony");
