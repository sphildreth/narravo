// SPDX-License-Identifier: Apache-2.0
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
  response: {
    statusCode: 200,
    headers: {} as Record<string, string>,
    chunks: [] as Uint8Array[],
  },
  lastOptions: null as any,
  pinnedAddress: null as string | null,
}));

vi.mock("node:dns/promises", () => ({ default: { lookup: state.lookup }, lookup: state.lookup }));
vi.mock("node:http", () => ({ default: { request: state.request }, request: state.request }));
vi.mock("node:https", () => ({ default: { request: state.request }, request: state.request }));

import {
  downloadRemoteBytes,
  isUnsafeRemoteAddress,
  normalizeAllowedHosts,
  resolveAndValidateRemoteUrl,
} from "@/lib/safe-remote-fetch";

function installResponse() {
  state.request.mockImplementation((options: any, callback: (response: any) => void) => {
    state.lastOptions = options;
    const request = new EventEmitter() as any;
    request.setTimeout = vi.fn();
    request.destroy = vi.fn();
    request.end = vi.fn(() => {
      options.lookup(options.hostname, {}, (error: Error | null, address?: string) => {
        state.pinnedAddress = error ? null : address ?? null;
      });
      const response = new EventEmitter() as any;
      response.statusCode = state.response.statusCode;
      response.headers = state.response.headers;
      response.destroy = vi.fn();
      response.resume = vi.fn();
      callback(response);
      queueMicrotask(() => {
        for (const chunk of state.response.chunks) response.emit("data", chunk);
        response.emit("end");
      });
    });
    return request;
  });
}

describe("safe remote media fetching", () => {
  beforeEach(() => {
    state.lookup.mockReset();
    state.request.mockReset();
    state.lastOptions = null;
    state.pinnedAddress = null;
    state.response = { statusCode: 200, headers: {}, chunks: [] };
    installResponse();
  });

  it("requires a non-empty allowlist and safe ports", async () => {
    await expect(resolveAndValidateRemoteUrl("https://public.example/file", [])).rejects.toThrow(/non-empty/);
    expect(() => normalizeAllowedHosts([])).not.toThrow();
    expect(() => normalizeAllowedHosts(["http://localhost"])).toThrow(/unsafe/i);
    await expect(resolveAndValidateRemoteUrl("http://localhost/file", ["localhost"]))
      .rejects.toThrow(/localhost|unsafe/i);
    await expect(resolveAndValidateRemoteUrl("http://public.example:8080/file", ["public.example"])).rejects.toThrow(/port/);
  });

  it("rejects loopback, private, link-local, metadata, and unsafe IPv6 ranges", () => {
    for (const address of [
      "127.0.0.1", "10.0.0.1", "192.168.1.1", "169.254.169.254", "::1", "fe80::1", "fc00::1",
    ]) {
      expect(isUnsafeRemoteAddress(address), address).toBe(true);
    }
  });

  it("rejects a hostname that resolves to a private address", async () => {
    state.lookup.mockResolvedValue([{ address: "192.168.1.10", family: 4 }]);
    await expect(resolveAndValidateRemoteUrl("https://allowed.example/file", ["allowed.example"]))
      .rejects.toThrow(/unsafe address/);
  });

  it("pins the actual request lookup to the validated address", async () => {
    state.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    state.response.chunks = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];

    const bytes = await downloadRemoteBytes("http://allowed.example/media", ["allowed.example"], 1024);

    expect(bytes.byteLength).toBe(8);
    expect(state.lookup).toHaveBeenCalledTimes(1);
    expect(state.lastOptions.lookup).toEqual(expect.any(Function));
    expect(state.pinnedAddress).toBe("93.184.216.34");
  });

  it("does not follow a redirect to another host", async () => {
    state.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    state.response.statusCode = 302;
    state.response.headers = { location: "http://127.0.0.1/private" };

    await expect(downloadRemoteBytes("http://allowed.example/media", ["allowed.example"], 1024))
      .rejects.toThrow(/redirect/i);
    expect(state.request).toHaveBeenCalledTimes(1);
  });

  it("enforces declared and streaming byte limits, including chunked responses", async () => {
    state.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    state.response.headers = { "content-length": "2048" };
    await expect(downloadRemoteBytes("http://allowed.example/media", ["allowed.example"], 1024))
      .rejects.toThrow(/size limit/);

    state.response.headers = {};
    state.response.chunks = [new Uint8Array(600), new Uint8Array(500)];
    await expect(downloadRemoteBytes("http://allowed.example/media", ["allowed.example"], 1024))
      .rejects.toThrow(/size limit/);
  });
});
