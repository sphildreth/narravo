// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as bannerPost } from "@/app/api/uploads/banner/route";

const mockRequireAdmin = vi.fn();
const mockFs = {
  mkdir: vi.fn(),
  writeFile: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("node:fs", () => ({
  get promises() {
    return mockFs;
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "uuid-test",
}));

describe("/api/uploads/banner", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset();
    mockRequireAdmin.mockResolvedValue({ user: { id: "admin" } });
    mockFs.mkdir.mockReset();
    mockFs.writeFile.mockReset();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  const makeFormRequest = (form: FormData): NextRequest =>
    new Request("http://localhost/api/uploads/banner", {
      method: "POST",
      body: form,
    }) as unknown as NextRequest;

  it("saves banner images and returns a public path", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "header.png", { type: "image/png" });
    const form = new FormData();
    form.append("file", file);

    const response = await bannerPost(makeFormRequest(form));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.url).toMatch(/\/uploads\/banner\/uuid-test\./);
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
    mockRequireAdmin.mockRejectedValueOnce(new Error("Forbidden"));
    const file = new File([new Uint8Array([1])], "header.png", { type: "image/png" });
    const form = new FormData();
    form.append("file", file);

    const response = await bannerPost(makeFormRequest(form));
    expect(response.status).toBe(403);
  });
});
