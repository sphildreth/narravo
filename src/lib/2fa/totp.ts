// SPDX-License-Identifier: Apache-2.0
import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Generate a new TOTP secret (Base32 encoded)
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate otpauth:// URI for QR code
 */
export function generateTotpUri(secret: string, email: string, issuer: string = "Narravo"): string {
  return authenticator.keyuri(email, issuer, secret);
}

/**
 * Generate QR code data URL from otpauth:// URI
 */
export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

/**
 * Verify a TOTP code with ±1 step window
 * Returns the step if valid, null otherwise
 */
export function verifyTotpCode(secret: string, code: string): number | null {
  // Configure authenticator with 30s window and ±1 step
  const isValid = authenticator.verify({
    token: code,
    secret,
  });

  if (isValid) {
    // Calculate current step for replay protection
    const now = Math.floor(Date.now() / 1000);
    const step = Math.floor(now / 30);
    return step;
  }

  return null;
}

/**
 * Check if a TOTP code is valid within a ±1 step window
 */
export function isTotpCodeValid(secret: string, code: string, window: number = 1): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

/**
 * Generate recovery codes (10 random codes)
 */
export function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  return codes;
}

/**
 * Hash a recovery code for storage
 */
export function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Verify a recovery code against a hash
 */
export function verifyRecoveryCode(code: string, hash: string): boolean {
  const codeHash = hashRecoveryCode(code);
  return crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(hash));
}

/**
 * Generate a secure random token for trusted device
 */
export function generateTrustedDeviceToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a trusted device token for storage
 */
export function hashTrustedDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Hash an IP address for privacy-preserving storage
 */
export function hashIpAddress(ip: string): string {
  // Use first 8 bytes of hash for partial privacy
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Calculate expiration timestamp for trusted device (30 days from now)
 */
export function getTrustedDeviceExpiration(days: number = 30): Date {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now;
}
