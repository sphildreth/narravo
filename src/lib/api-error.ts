// SPDX-License-Identifier: Apache-2.0

const AUTH_ERRORS = new Map<string, number>([
  ["Unauthorized", 401],
  ["Forbidden", 403],
  ["2FA verification required", 403],
  ["Session refresh required", 401],
  ["Recent sign-in required", 401],
]);

/** Map internal exceptions to a deliberately small public error surface. */
export function safeApiError(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
): { message: string; status: number } {
  const internalMessage = error instanceof Error ? error.message : "";
  const authStatus = AUTH_ERRORS.get(internalMessage);
  if (authStatus) return { message: internalMessage, status: authStatus };
  return { message: fallbackMessage, status: fallbackStatus };
}
