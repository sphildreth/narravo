// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as bannerPost } from "@/app/api/uploads/banner/route";

const mockRequireAdmin2FA = vi.fn();
const mockFs = {
  mkdir: vi.fn(),
  writeFile: vi.fn(),
};
const mockDb = { insert: vi.fn() };

vi.mock("@/lib/auth", () => ({
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
  getSessionUserId: vi.fn().mockResolvedValue(null),
}));

vi.mock("node:fs", () => ({
  get promises() {
    return mockFs;
  },
}));
vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));

let mockUuidCounter = 0;
vi.mock("node:crypto", () => ({
  randomUUID: () => `uuid-test-${Date.now()}-${++mockUuidCounter}`,
}));

describe("/api/uploads/banner", () => {
  beforeEach(() => {
    mockRequireAdmin2FA.mockReset();
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "admin" } });
    mockFs.mkdir.mockReset();
    mockFs.writeFile.mockReset();
    mockDb.insert.mockReset();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  });

  const makeFormRequest = (form: FormData): NextRequest =>
    new Request("http://localhost/api/uploads/banner", {
      method: "POST",
      body: form,
    }) as unknown as NextRequest;

  it("saves banner images and returns a public path", async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "header.png", { type: "image/png" });
    const form = new FormData();
    form.append("file", file);

    const response = await bannerPost(makeFormRequest(form));
    const payload = await response.json();

    if (response.status !== 200) console.log("BANNER ERROR:", payload);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.url).toMatch(/\/uploads\/banner\/uuid-test-\d+-\d+\./);
    expect(mockFs.mkdir).toHaveBeenCalled();
    expect(mockFs.writeFile).toHaveBeenCalled();
  });

  it("rejects non-image uploads", async () => {
    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    const form = new FormData();
    form.append("file", file);

    const response = await bannerPost(makeFormRequest(form));
    expect(response.status).toBe(400);
  });

  it("propagates authorization errors", async () => {
    mockRequireAdmin2FA.mockRejectedValueOnce(new Error("Forbidden"));
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "header.png", { type: "image/png" });
    const form = new FormData();
    form.append("file", file);

    const response = await bannerPost(makeFormRequest(form));
    expect(response.status).toBe(403);
  });
});
