// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as globalPost } from "@/app/api/admin/config/global/route";
import { POST as userPost, DELETE as userDelete } from "@/app/api/admin/config/user/route";
import { POST as deletePost } from "@/app/api/admin/config/delete/route";
import { POST as invalidatePost } from "@/app/api/admin/config/invalidate/route";
import type { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
const mockRevalidateAppearance = vi.fn();

let mockConfigInstance: {
  setGlobal: ReturnType<typeof vi.fn>;
  invalidate: ReturnType<typeof vi.fn>;
  setUserOverride: ReturnType<typeof vi.fn>;
  deleteUserOverride: ReturnType<typeof vi.fn>;
  deleteGlobal: ReturnType<typeof vi.fn>;
};

const ConfigServiceImpl = vi.fn(() => mockConfigInstance);

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/lib/config", () => ({
  get ConfigServiceImpl() {
    return ConfigServiceImpl;
  },
}));

vi.mock("@/lib/revalidation", () => ({
  revalidateAppearance: (...args: unknown[]) => mockRevalidateAppearance(...args),
}));

describe("admin config routes", () => {
  beforeEach(() => {
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin-1", email: "admin@example.com" } });
    mockRevalidateAppearance.mockClear();

    mockConfigInstance = {
      setGlobal: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn().mockResolvedValue(undefined),
      setUserOverride: vi.fn().mockResolvedValue(undefined),
      deleteUserOverride: vi.fn().mockResolvedValue(undefined),
      deleteGlobal: vi.fn().mockResolvedValue(undefined),
    };

    ConfigServiceImpl.mockClear();
    ConfigServiceImpl.mockImplementation(() => mockConfigInstance);
  });

  const makeJsonRequest = (body: unknown, init: RequestInit = {}): NextRequest => {
    const request = new Request("http://localhost/api", {
      method: init.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      body: JSON.stringify(body),
    });
    return request as unknown as NextRequest;
  };

  describe("/api/admin/config/global", () => {
    it("updates global config and invalidates cache", async () => {
      const request = makeJsonRequest({
        key: "APPEARANCE.BANNER.ENABLED",
        value: true,
        type: "boolean",
        allowedValues: [true, false],
        required: true,
      });

      const response = await globalPost(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ ok: true });
      expect(ConfigServiceImpl).toHaveBeenCalledWith({ db: expect.anything() });
      expect(mockConfigInstance.setGlobal).toHaveBeenCalledWith(
        "APPEARANCE.BANNER.ENABLED",
        true,
        expect.objectContaining({
          allowedValues: [true, false],
          required: true,
          type: "boolean",
        })
      );
      expect(mockConfigInstance.invalidate).toHaveBeenCalledWith("APPEARANCE.BANNER.ENABLED");
      expect(mockRevalidateAppearance).toHaveBeenCalledTimes(1);
    });

    it("rejects missing key", async () => {
      const request = makeJsonRequest({ value: true });

      const response = await globalPost(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.ok).toBe(false);
      expect(mockConfigInstance.setGlobal).not.toHaveBeenCalled();
    });

    it("maps admin auth errors to 403", async () => {
      mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
      const request = makeJsonRequest({ key: "test", value: "x" });

      const response = await globalPost(request);
      const payload = await response.json();

      expect(response.status).toBe(403);
      expect(payload.ok).toBe(false);
      expect(mockConfigInstance.setGlobal).not.toHaveBeenCalled();
    });
  });

  describe("/api/admin/config/user", () => {
    it("creates user override", async () => {
      const request = makeJsonRequest({ key: "editor.theme", userId: "user-1", value: "dark" });

      const response = await userPost(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ ok: true });
      expect(mockConfigInstance.setUserOverride).toHaveBeenCalledWith("editor.theme", "user-1", "dark");
    });

    it("requires key and userId for user override", async () => {
      const request = makeJsonRequest({ key: "" });

      const response = await userPost(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.ok).toBe(false);
      expect(mockConfigInstance.setUserOverride).not.toHaveBeenCalled();
    });

    it("deletes user override", async () => {
      const request = makeJsonRequest({ key: "editor.theme", userId: "user-2" }, { method: "DELETE" });

      const response = await userDelete(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ ok: true });
      expect(mockConfigInstance.deleteUserOverride).toHaveBeenCalledWith("editor.theme", "user-2");
    });
  });

  describe("/api/admin/config/delete", () => {
    it("removes global key", async () => {
      const request = makeJsonRequest({ key: "appearance.banner.enabled" });

      const response = await deletePost(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ ok: true });
      expect(mockConfigInstance.deleteGlobal).toHaveBeenCalledWith("appearance.banner.enabled");
    });

    it("validates key is present", async () => {
      const request = makeJsonRequest({});

      const response = await deletePost(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.ok).toBe(false);
      expect(mockConfigInstance.deleteGlobal).not.toHaveBeenCalled();
    });
  });

  describe("/api/admin/config/invalidate", () => {
    it("invalidates global cache", async () => {
      const request = makeJsonRequest({ key: "appearance.banner.enabled" });

      const response = await invalidatePost(request);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({ ok: true });
      expect(mockConfigInstance.invalidate).toHaveBeenCalledWith("appearance.banner.enabled", undefined);
    });

    it("invalidates user-specific cache", async () => {
      const request = makeJsonRequest({ key: "appearance.banner.enabled", userId: "user-3" });

      const response = await invalidatePost(request);
      await response.json();

      expect(mockConfigInstance.invalidate).toHaveBeenCalledWith("appearance.banner.enabled", "user-3");
    });

    it("returns 400 when key missing", async () => {
      const request = makeJsonRequest({});

      const response = await invalidatePost(request);
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.ok).toBe(false);
      expect(mockConfigInstance.invalidate).not.toHaveBeenCalled();
    });
  });
});
