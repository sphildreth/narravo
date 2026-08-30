// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));
vi.mock("@/drizzle/schema", () => ({ webauthnChallenge: {
  userId: Symbol("userId"), sessionId: Symbol("sessionId"), ceremony: Symbol("ceremony"), challenge: Symbol("challenge"), consumedAt: Symbol("consumedAt"), expiresAt: Symbol("expiresAt"), id: Symbol("id"),
} }));

import {
  consumePendingWebAuthnChallenge,
  extractClientDataChallenge,
  getPendingWebAuthnChallenge,
  persistWebAuthnChallenge,
} from "@/lib/2fa/webauthn-challenge";

describe("WebAuthn challenge lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the session ceremony with a server-bound expiring challenge", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    mockDb.insert.mockReturnValue({ values });

    await persistWebAuthnChallenge("user-1", "session-a", "authentication", "server-challenge");

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1", sessionId: "session-a", ceremony: "authentication", challenge: "server-challenge",
      expiresAt: expect.any(Date),
    }));
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it("loads without consuming, then atomically consumes only after verification", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ id: "challenge-id", challenge: "server-challenge" }]);
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: selectLimit }) }),
    });
    const pending = await getPendingWebAuthnChallenge({
      userId: "user-1", sessionId: "session-a", ceremony: "registration", responseChallenge: "server-challenge",
    });
    expect(pending).toEqual({ id: "challenge-id", challenge: "server-challenge" });
    expect(mockDb.update).not.toHaveBeenCalled();

    const returning = vi.fn().mockResolvedValue([{ id: "challenge-id" }]);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }),
    });
    await expect(consumePendingWebAuthnChallenge({
      userId: "user-1", sessionId: "session-a", ceremony: "registration",
    }, pending!)).resolves.toBe(true);
  });

  it("rejects a missing, expired, consumed, or incorrectly-bound challenge", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });
    await expect(getPendingWebAuthnChallenge({
      userId: "user-1", sessionId: "session-b", ceremony: "authentication", responseChallenge: "other",
    })).resolves.toBeNull();
  });

  it("parses the response challenge only as a database lookup selector", () => {
    const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: "client-value" }), "utf8").toString("base64url");
    expect(extractClientDataChallenge(clientData)).toBe("client-value");
    expect(extractClientDataChallenge("not-json")).toBeNull();
  });
});
