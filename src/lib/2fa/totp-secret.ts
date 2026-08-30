// SPDX-License-Identifier: Apache-2.0
import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const AAD = Buffer.from("narravo:totp:v1", "utf8");

function encryptionKey(): Buffer {
  const configured = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("TOTP encryption key is not configured");

  const candidates = [
    () => Buffer.from(configured, "base64url"),
    () => Buffer.from(configured, "base64"),
    () => /^[a-f\d]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.alloc(0),
  ];
  for (const decode of candidates) {
    const key = decode();
    if (key.length === 32) return key;
  }
  throw new Error("TOTP_ENCRYPTION_KEY must encode exactly 32 bytes");
}

export function isEncryptedTotpSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptTotpSecret(secret: string): string {
  if (!secret) throw new Error("TOTP secret is empty");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptTotpSecret(stored: string): string {
  // Backward-compatible read path for deployments upgrading from plaintext.
  // Successful confirmation/use rewrites the row through protectTotpSecret().
  if (!isEncryptedTotpSecret(stored)) return stored;
  const encoded = stored.slice(PREFIX.length);
  const [ivValue, tagValue, ciphertextValue] = encoded.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error("Stored TOTP secret is malformed");
  const iv = Buffer.from(ivValue, "base64url");
  const tag = Buffer.from(tagValue, "base64url");
  const ciphertext = Buffer.from(ciphertextValue, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Stored TOTP secret is malformed");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function protectTotpSecret(storedOrPlaintext: string): string {
  return isEncryptedTotpSecret(storedOrPlaintext)
    ? storedOrPlaintext
    : encryptTotpSecret(storedOrPlaintext);
}
