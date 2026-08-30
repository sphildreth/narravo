// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { POST as uploadsLocalPost } from "@/app/api/uploads/local/route";

const mockConfigInstance = {
  getNumber: vi.fn(),
  getJSON: vi.fn(),
};
const ConfigServiceImpl = vi.fn(function() { return mockConfigInstance; });

const mockLocalStorage = {
  putObject: vi.fn(),
  getPublicUrl: vi.fn(),
  deleteObject: vi.fn(),
};
const mockConsumeSharedRateLimit = vi.fn();
const mockDb = { insert: vi.fn() };

vi.mock("@/lib/config", () => ({
  get ConfigServiceImpl() {
    return ConfigServiceImpl;
  },
}));

vi.mock("@/lib/local-storage", () => ({
  get localStorageService() {
    return mockLocalStorage;
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/db", () => ({ get db() { return mockDb; } }));

vi.mock("@/lib/shared-rate-limit", () => ({
  consumeSharedRateLimit: (...args: unknown[]) => mockConsumeSharedRateLimit(...args),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: (...args: any[]) => console.error("LOGGER ERROR:", ...args),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("/api/uploads/local", () => {
  beforeEach(() => {
    ConfigServiceImpl.mockClear();
    mockConfigInstance.getNumber.mockReset();
    mockConfigInstance.getJSON.mockReset();
    mockLocalStorage.putObject.mockReset();
    mockLocalStorage.getPublicUrl.mockReset();
    mockLocalStorage.deleteObject.mockReset();
    mockDb.insert.mockReset();
    mockConsumeSharedRateLimit.mockReset();

    mockConfigInstance.getNumber.mockImplementation((key: string) => {
      if (key === "UPLOADS.IMAGE-MAX-BYTES") return Promise.resolve(5 * 1024 * 1024);
      if (key === "UPLOADS.VIDEO-MAX-BYTES") return Promise.resolve(50 * 1024 * 1024);
      return Promise.resolve(null);
    });

    mockConfigInstance.getJSON.mockImplementation((key: string) => {
      if (key === "UPLOADS.ALLOWED-MIME-IMAGE") return Promise.resolve(["image/png", "image/jpeg"]);
      if (key === "UPLOADS.ALLOWED-MIME-VIDEO") return Promise.resolve(["video/mp4"]);
      return Promise.resolve(null);
    });

    mockLocalStorage.putObject.mockResolvedValue(undefined);
    mockLocalStorage.deleteObject.mockResolvedValue(undefined);
    mockLocalStorage.getPublicUrl.mockImplementation((key: string) => `/local/${key}`);
    mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockConsumeSharedRateLimit.mockResolvedValue({ limited: false, remaining: 29, resetAt: new Date() });
  });

  const makeFormRequest = (form: FormData): NextRequest =>
    new Request("http://localhost/api/uploads/local", {
      method: "POST",
      body: form,
    }) as unknown as NextRequest;

  it("stores uploaded images and returns public url", async () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([buffer], "banner.png", { type: "image/png" });

    const form = new FormData();
    form.append("file", file);
    form.append("key", "images/caller-selected.png");

    const response = await uploadsLocalPost(makeFormRequest(form));
    const payload = await response.json();

    if (response.status !== 200) console.log(payload);

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.key).toMatch(/^images\/[0-9a-f-]+\.png$/);
    expect(payload.url).toBe(`/local/${payload.key}`);
    expect(mockLocalStorage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^images\/[0-9a-f-]+\.png$/),
      expect.any(Uint8Array),
      "image/png",
    );
  });

  it("ignores caller-selected SVG and traversal-like keys", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "note.svg", { type: "image/jpeg" }));
    form.append("key", "../../secret.svg");

    const response = await uploadsLocalPost(makeFormRequest(form));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.key).toMatch(/^images\/[0-9a-f-]+\.png$/);
    expect(payload.key).not.toContain("svg");
  });

  it("rejects SVG bytes even when they claim to be JPEG", async () => {
    const form = new FormData();
    form.append("file", new File(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"], "image.jpg", { type: "image/jpeg" }));

    const response = await uploadsLocalPost(makeFormRequest(form));
    expect(response.status).toBe(400);
  });

  it("enforces size limits", async () => {
    const large = new Uint8Array(6 * 1024 * 1024);
    large.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file = new File([large], "huge.png", { type: "image/png" });

    const form = new FormData();
    form.append("file", file);
    form.append("key", "images/huge.png");

    const response = await uploadsLocalPost(makeFormRequest(form));
    expect(response.status).toBe(400);
  });

  it("rejects oversized declared bodies before multipart parsing", async () => {
    const request = new Request("http://localhost/api/uploads/local", {
      method: "POST",
      headers: { "content-length": String(102 * 1024 * 1024) },
      body: "x",
    }) as unknown as NextRequest;

    const response = await uploadsLocalPost(request);
    expect(response.status).toBe(413);
  });
});
