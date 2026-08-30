// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({ mockDb: { insert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));
vi.mock("@/drizzle/schema", () => ({ webauthnChallenge: {
  userId: Symbol("userId"), sessionId: Symbol("sessionId"), ceremony: Symbol("ceremony"), challenge: Symbol("challenge"), consumedAt: Symbol("consumedAt"), expiresAt: Symbol("expiresAt"), id: Symbol("id"),
} }));

import { consumeWebAuthnChallenge, extractClientDataChallenge, persistWebAuthnChallenge } from "@/lib/2fa/webauthn-challenge";

describe("WebAuthn challenge lifecycle", () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
  });

  it("persists the user, session, ceremony, and expiration binding", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values });
    await persistWebAuthnChallenge("user-1", "session-a", "authentication", "server-challenge");
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1", sessionId: "session-a", ceremony: "authentication", challenge: "server-challenge",
      expiresAt: expect.any(Date),
    }));
  });

  it("atomically consumes only a matching, unconsumed challenge", async () => {
    const returning = vi.fn().mockResolvedValue([{ challenge: "server-challenge" }]);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning }),
      }),
    });
    await expect(consumeWebAuthnChallenge({
      userId: "user-1", sessionId: "session-a", ceremony: "registration", responseChallenge: "server-challenge",
    })).resolves.toEqual({ challenge: "server-challenge" });
  });

  it("returns no record for a consumed, expired, wrong-session, or wrong-ceremony challenge", async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    });
    await expect(consumeWebAuthnChallenge({
      userId: "user-1", sessionId: "session-b", ceremony: "authentication", responseChallenge: "registration-challenge",
    })).resolves.toBeNull();
  });

  it("parses the response challenge only as a database lookup selector", () => {
    const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: "client-value" }), "utf8").toString("base64url");
    expect(extractClientDataChallenge(clientData)).toBe("client-value");
    expect(extractClientDataChallenge("not-json")).toBeNull();
  });
});
