// SPDX-License-Identifier: Apache-2.0

export type SafeUploadKind = "image" | "video";

export type DetectedUploadType = {
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "video/mp4" | "video/webm";
  extension: "jpg" | "png" | "gif" | "webp" | "mp4" | "webm";
  kind: SafeUploadKind;
};

export const SAFE_UPLOAD_TYPES: readonly DetectedUploadType[] = [
  { mimeType: "image/jpeg", extension: "jpg", kind: "image" },
  { mimeType: "image/png", extension: "png", kind: "image" },
  { mimeType: "image/gif", extension: "gif", kind: "image" },
  { mimeType: "image/webp", extension: "webp", kind: "image" },
  { mimeType: "video/mp4", extension: "mp4", kind: "video" },
  { mimeType: "video/webm", extension: "webm", kind: "video" },
];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((value, index) => bytes[offset + index] === value);

/** Detect only the explicitly supported, non-active formats from their bytes. */
export function detectSafeUploadType(body: Uint8Array): DetectedUploadType | null {
  if (startsWith(body, [0xff, 0xd8, 0xff])) return SAFE_UPLOAD_TYPES[0]!;
  if (startsWith(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return SAFE_UPLOAD_TYPES[1]!;
  if (startsWith(body, [0x47, 0x49, 0x46, 0x38]) && (body[4] === 0x37 || body[4] === 0x39) && body[5] === 0x61) {
    return SAFE_UPLOAD_TYPES[2]!;
  }
  if (startsWith(body, [0x52, 0x49, 0x46, 0x46]) && startsWith(body, [0x57, 0x45, 0x42, 0x50], 8)) {
    return SAFE_UPLOAD_TYPES[3]!;
  }
  // ISO base media files place the ftyp box at byte offset 4. The exact
  // compatible brand is intentionally not trusted; the container signature
  // is sufficient for the supported video transport here.
  if (startsWith(body, [0x66, 0x74, 0x79, 0x70], 4)) return SAFE_UPLOAD_TYPES[4]!;
  // WebM is an EBML document with this fixed header. SVG, HTML, PDF, office
  // documents, and other active/unsupported formats do not match any branch.
  if (startsWith(body, [0x1a, 0x45, 0xdf, 0xa3])) return SAFE_UPLOAD_TYPES[5]!;
  return null;
}

export function getSafeUploadTypeByMime(mimeType: string): DetectedUploadType | null {
  return SAFE_UPLOAD_TYPES.find((type) => type.mimeType === mimeType.toLowerCase()) ?? null;
}

export function isConfiguredSafeType(detected: DetectedUploadType, allowedMimeTypes: string[]): boolean {
  return allowedMimeTypes.map((mime) => mime.toLowerCase()).includes(detected.mimeType);
}

export function validateFileType(body: Uint8Array | ArrayBuffer, expectedMime: string): boolean {
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  return detectSafeUploadType(bytes)?.mimeType === expectedMime.toLowerCase();
}
