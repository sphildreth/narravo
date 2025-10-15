// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { GET as trustedGet, DELETE as trustedDelete } from "@/app/api/2fa/trusted-devices/route";

const mockRequireAdmin2FA = vi.fn();
const mockTrustedLib = {
  getTrustedDevices: vi.fn(),
  revokeTrustedDevice: vi.fn(),
  revokeAllTrustedDevices: vi.fn(),
};
const mockSecurityActivity = {
  logSecurityActivity: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
}));

vi.mock("@/lib/2fa/trusted-device", () => ({
  getTrustedDevices: (...args: unknown[]) => mockTrustedLib.getTrustedDevices(...args),
  revokeTrustedDevice: (...args: unknown[]) => mockTrustedLib.revokeTrustedDevice(...args),
  revokeAllTrustedDevices: (...args: unknown[]) => mockTrustedLib.revokeAllTrustedDevices(...args),
}));

vi.mock("@/lib/2fa/security-activity", () => ({
  logSecurityActivity: (...args: unknown[]) => mockSecurityActivity.logSecurityActivity(...args),
}));

describe("2FA trusted devices", () => {
  beforeEach(() => {
    mockRequireAdmin2FA.mockReset();
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "user-1" } });

    mockTrustedLib.getTrustedDevices.mockReset();
    mockTrustedLib.revokeTrustedDevice.mockReset();
    mockTrustedLib.revokeAllTrustedDevices.mockReset();
    mockSecurityActivity.logSecurityActivity.mockReset();
  });

  const makeRequest = (url: string, init?: RequestInit): NextRequest =>
    new Request(url, init) as unknown as NextRequest;

  it("lists trusted devices", async () => {
    const now = new Date();
    mockTrustedLib.getTrustedDevices.mockResolvedValue([
      { id: "td-1", userAgent: "Chrome", createdAt: now, lastSeenAt: now, expiresAt: now },
    ]);

    const response = await trustedGet(makeRequest("http://localhost/api/2fa/trusted-devices"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.devices).toEqual([
      {
        id: "td-1",
        userAgent: "Chrome",
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        expiresAt: now.toISOString(),
      },
    ]);
  });

  it("revokes a single trusted device", async () => {
    const response = await trustedDelete(
      makeRequest("http://localhost/api/2fa/trusted-devices?id=td-1", { method: "DELETE" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe("Device revoked");
    expect(mockTrustedLib.revokeTrustedDevice).toHaveBeenCalledWith("td-1");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "trusted_device_revoked",
      { deviceId: "td-1" }
    );
  });

  it("revokes all devices when none specified", async () => {
    const response = await trustedDelete(
      makeRequest("http://localhost/api/2fa/trusted-devices", { method: "DELETE" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe("All devices revoked");
    expect(mockTrustedLib.revokeAllTrustedDevices).toHaveBeenCalledWith("user-1");
    expect(mockSecurityActivity.logSecurityActivity).toHaveBeenCalledWith(
      "user-1",
      "all_trusted_devices_revoked"
    );
  });
});
