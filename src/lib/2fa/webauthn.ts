// SPDX-License-Identifier: Apache-2.0
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

const RP_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Narravo";
const RP_ID = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : "localhost";
const ORIGIN = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * Generate WebAuthn registration options for enrolling a new credential
 */
export async function generateWebAuthnRegistrationOptions(
  userId: string,
  userEmail: string,
  userName: string,
  existingCredentials: Array<{ credentialId: string; transports?: string[] }>
): Promise<ReturnType<typeof generateRegistrationOptions>> {
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userEmail,
    userDisplayName: userName,
    userID: new Uint8Array(Buffer.from(userId)),
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: (cred.transports ?? []) as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  };

  return generateRegistrationOptions(opts);
}

/**
 * Verify WebAuthn registration response
 */
export async function verifyWebAuthnRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<ReturnType<typeof verifyRegistrationResponse>> {
  const opts: VerifyRegistrationResponseOpts = {
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  };

  return verifyRegistrationResponse(opts);
}

/**
 * Generate WebAuthn authentication options for login
 */
export async function generateWebAuthnAuthenticationOptions(
  allowedCredentials: Array<{ credentialId: string; transports?: string[] }>
): Promise<ReturnType<typeof generateAuthenticationOptions>> {
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: RP_ID,
    allowCredentials: allowedCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: (cred.transports ?? []) as AuthenticatorTransport[],
    })),
    userVerification: "preferred",
  };

  return generateAuthenticationOptions(opts);
}

/**
 * Verify WebAuthn authentication response
 */
export async function verifyWebAuthnAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  credentialPublicKey: string,
  credentialCounter: number
): Promise<ReturnType<typeof verifyAuthenticationResponse>> {
  const opts: VerifyAuthenticationResponseOpts = {
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: response.id,
      publicKey: Buffer.from(credentialPublicKey, "base64"),
      counter: credentialCounter,
    },
  };

  return verifyAuthenticationResponse(opts);
}
