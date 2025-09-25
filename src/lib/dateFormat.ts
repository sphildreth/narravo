// SPDX-License-Identifier: Apache-2.0

import { format as dfFormat } from "date-fns";

// Default format renders 2025-04-25 as "April 25, 2025"
export const DEFAULT_DATE_FORMAT = "MMMM d, yyyy";

/**
 * Formats a date using the provided format string.
 * - Accepts Date or ISO string.
 * - Returns empty string for invalid/empty inputs.
 * Server-safe: no React or client-only APIs.
 */
export function formatDateSafe(
  input: Date | string | null | undefined,
  fmt: string = DEFAULT_DATE_FORMAT
): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  try {
    return dfFormat(d, fmt);
  } catch {
    // Fallback to locale formatting if format fails
    return d.toLocaleDateString();
  }
}
