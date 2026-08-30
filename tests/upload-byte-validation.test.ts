// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "vitest";
import { detectSafeUploadType, getSafeUploadTypeByMime, validateFileType } from "@/lib/upload-validation";

const bytes = {
  jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  gif: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  webp: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
  mp4: new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]),
  webm: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93]),
};

describe("byte-based upload validation", () => {
  it("accepts only the configured safe raster and video signatures", () => {
    expect(detectSafeUploadType(bytes.jpeg)?.mimeType).toBe("image/jpeg");
    expect(detectSafeUploadType(bytes.png)?.mimeType).toBe("image/png");
    expect(detectSafeUploadType(bytes.gif)?.mimeType).toBe("image/gif");
    expect(detectSafeUploadType(bytes.webp)?.mimeType).toBe("image/webp");
    expect(detectSafeUploadType(bytes.mp4)?.mimeType).toBe("video/mp4");
    expect(detectSafeUploadType(bytes.webm)?.mimeType).toBe("video/webm");
  });

  it("rejects active content and MIME/extension claims that do not match bytes", () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(detectSafeUploadType(svg)).toBeNull();
    expect(detectSafeUploadType(html)).toBeNull();
    expect(validateFileType(bytes.png, "image/jpeg")).toBe(false);
    expect(getSafeUploadTypeByMime("image/svg+xml")).toBeNull();
  });
});
