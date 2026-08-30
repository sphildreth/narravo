// SPDX-License-Identifier: Apache-2.0
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  bytes: new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]),
  createReadStream: vi.fn(),
}));
const mockHandle = {
  read: vi.fn(),
  close: vi.fn(),
};
vi.mock("node:fs/promises", () => ({
  open: (...args: unknown[]) => mockHandle,
  realpath: vi.fn(async (value: string) => value),
  stat: vi.fn(async () => ({ isFile: () => true })),
}));
vi.mock("node:fs", () => ({
  default: { createReadStream: state.createReadStream },
  createReadStream: state.createReadStream,
}));

import { GET } from "@/app/uploads/[...path]/route";

describe("upload serving safety", () => {
  beforeEach(() => {
    state.bytes = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x3e]);
    mockHandle.read.mockReset();
    mockHandle.close.mockReset();
    mockHandle.read.mockImplementation(async (buffer: Buffer) => {
      buffer.set(state.bytes);
      return { bytesRead: state.bytes.byteLength, buffer };
    });
    mockHandle.close.mockResolvedValue(undefined);
    state.createReadStream.mockReturnValue(Readable.from([Buffer.from(state.bytes)]));
  });

  it("serves unknown or legacy unsafe bytes as an attachment", async () => {
    const response = await GET(new Request("http://localhost/uploads/legacy.svg"), {
      params: Promise.resolve({ path: ["legacy.svg"] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("content-disposition")).toMatch(/attachment/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("uses detected content type for supported bytes, not the extension", async () => {
    state.bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const response = await GET(new Request("http://localhost/uploads/file.txt"), {
      params: Promise.resolve({ path: ["file.txt"] }),
    });
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});
