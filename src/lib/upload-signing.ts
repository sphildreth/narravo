// SPDX-License-Identifier: Apache-2.0
import crypto from "node:crypto";
import { getSafeUploadTypeByMime } from "./upload-validation";

export type UploadSigningClaims = {
  key: string;
  kind: "image" | "video";
  mimeType: string;
  size: number;
  maxBytes: number;
  userId: string;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("Upload signing secret is not configured");
  return value;
}

function mac(value: string): Buffer {
  return crypto.createHmac("sha256", secret()).update(value).digest();
}

export function createUploadToken(claims: UploadSigningClaims): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${mac(payload).toString("base64url")}`;
}

export function verifyUploadToken(token: string): UploadSigningClaims | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = mac(payload);
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadSigningClaims;
    if (!claims || typeof claims !== "object" || typeof claims.key !== "string" ||
      (claims.kind !== "image" && claims.kind !== "video") || typeof claims.mimeType !== "string" ||
      !Number.isSafeInteger(claims.size) || claims.size <= 0 || !Number.isSafeInteger(claims.maxBytes) ||
      claims.maxBytes <= 0 || claims.size > claims.maxBytes ||
      getSafeUploadTypeByMime(claims.mimeType)?.kind !== claims.kind ||
      typeof claims.userId !== "string" || !Number.isSafeInteger(claims.expiresAt) ||
      claims.expiresAt <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}
