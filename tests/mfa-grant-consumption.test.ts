// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({ mockDb: { insert: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));
vi.mock("@/drizzle/schema", () => ({ mfaSessionGrant: {
  userId: Symbol("userId"), sessionId: Symbol("sessionId"), consumedAt: Symbol("consumedAt"), expiresAt: Symbol("expiresAt"), id: Symbol("id"),
} }));

import { consumeMfaSessionGrant, createMfaSessionGrant } from "@/lib/2fa/session-grant";

describe("MFA grant atomic consumption", () => {
  beforeEach(() => {
    mockDb.insert.mockReset();
    mockDb.update.mockReset();
  });

  it("upserts one pending grant per login session", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    mockDb.insert.mockReturnValue({ values });

    await createMfaSessionGrant({ userId: "user-1", sessionId: "session-a" });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      sessionId: "session-a",
      expiresAt: expect.any(Date),
    }));
    expect(onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      target: [expect.anything(), expect.anything()],
      set: expect.objectContaining({ consumedAt: null }),
    }));
  });

  it("rejects an expired or already-consumed grant when the conditional update returns no row", async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    });

    await expect(consumeMfaSessionGrant({ userId: "user-1", sessionId: "session-a" })).resolves.toBe(false);
  });

  it("allows only one successful consumer", async () => {
    const returning = vi.fn()
      .mockResolvedValueOnce([{ id: "grant-1" }])
      .mockResolvedValueOnce([]);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning }),
      }),
    });

    await expect(consumeMfaSessionGrant({ userId: "user-1", sessionId: "session-a" })).resolves.toBe(true);
    await expect(consumeMfaSessionGrant({ userId: "user-1", sessionId: "session-a" })).resolves.toBe(false);
    expect(returning).toHaveBeenCalledTimes(2);
  });
});
