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
};

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
  requireAdmin: vi.fn().mockResolvedValue({ user: { id: "admin" } }),
  getSessionUserId: vi.fn().mockResolvedValue(null),
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
    mockLocalStorage.getPublicUrl.mockImplementation((key: string) => `/local/${key}`);
  });

  const makeFormRequest = (form: FormData): NextRequest =>
    new Request("http://localhost/api/uploads/local", {
      method: "POST",
      body: form,
    }) as unknown as NextRequest;

  it("stores uploaded images and returns public url", async () => {
    const buffer = new Uint8Array([1, 2, 3]);
    const file = new File([buffer], "banner.png", { type: "image/png" });

    const uniqueKey = `images/banner-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    const form = new FormData();
    form.append("file", file);
    form.append("key", uniqueKey);

    const response = await uploadsLocalPost(makeFormRequest(form));
    const payload = await response.json();

    if (response.status !== 200) console.log(payload);

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, url: `/local/${uniqueKey}`, key: uniqueKey });
    expect(mockLocalStorage.putObject).toHaveBeenCalledWith(
      uniqueKey,
      expect.any(Uint8Array),
      "image/png"
    );
  });

  it("rejects unsafe keys", async () => {
    const form = new FormData();
    form.append("file", new File(["data"], "note.txt", { type: "text/plain" }));
    form.append("key", "../secret.txt");

    const response = await uploadsLocalPost(makeFormRequest(form));
    expect(response.status).toBe(400);
  });

  it("enforces size limits", async () => {
    const large = new Uint8Array(6 * 1024 * 1024);
    const file = new File([large], "huge.png", { type: "image/png" });

    const form = new FormData();
    form.append("file", file);
    form.append("key", "images/huge.png");

    const response = await uploadsLocalPost(makeFormRequest(form));
    expect(response.status).toBe(400);
  });
});
