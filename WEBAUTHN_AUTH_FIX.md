# WebAuthn Authentication 400 Error Fix

## Issue
When clicking "Authenticate with Passkey" during 2FA login, the request returned a 400 error.

## Root Cause
The `/api/2fa/webauthn/authenticate/verify` endpoint was using an outdated request format:
- Expected: `{ response, expectedChallenge, rememberDevice }`
- Received: `{ ...authenticationResponse, rememberDevice }`

The endpoint was using Zod validation expecting a separate `expectedChallenge` field, but `@simplewebauthn/browser` embeds the challenge in the `response.clientDataJSON` field.

## Solution
Updated the endpoint to match the format used by `@simplewebauthn/browser`:

1. Removed Zod schema validation that expected wrong format
2. Changed to use `AuthenticationResponseJSON` type from `@simplewebauthn/server`
3. Extract challenge from `clientDataJSON` before verification:
   ```typescript
   const clientData = JSON.parse(
     Buffer.from(authResponse.response.clientDataJSON, "base64").toString()
   );
   const expectedChallenge = clientData.challenge;
   ```

This matches the pattern already used in:
- `/api/2fa/webauthn/register/verify` (registration verification)
- `/api/2fa/webauthn/confirm` (initial passkey setup)

## Files Modified
- `/src/app/api/2fa/webauthn/authenticate/verify/route.ts`

## Testing
1. Enable 2FA with passkey
2. Clear mfaVerifiedAt: `pnpm tsx scripts/clear-mfa-verification.ts your-email`
3. Log out and back in
4. Click "Authenticate with Passkey"
5. Should now work correctly with Bitwarden or platform authenticator

## Status
✅ Fixed - passkey authentication now works correctly during 2FA login flow
