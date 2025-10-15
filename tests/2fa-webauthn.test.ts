// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  generateWebAuthnAuthenticationOptions,
  verifyWebAuthnAuthentication,
} from "@/lib/2fa/webauthn";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";

// Mock the @simplewebauthn/server module
vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

describe("2FA WebAuthn", () => {
  const testUserId = "test-user-id-123";
  const testUserEmail = "test@example.com";
  const testUserName = "Test User";
  const testChallenge = "test-challenge-abc123";
  const testCredentialId = "credential-id-123";
  const testPublicKey = Buffer.from("test-public-key").toString("base64");
  const testCounter = 0;

  // Import mocked functions
  let mockGenerateRegistrationOptions: ReturnType<typeof vi.fn>;
  let mockVerifyRegistrationResponse: ReturnType<typeof vi.fn>;
  let mockGenerateAuthenticationOptions: ReturnType<typeof vi.fn>;
  let mockVerifyAuthenticationResponse: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked functions
    const simpleWebAuthn = await import("@simplewebauthn/server");
    mockGenerateRegistrationOptions = vi.mocked(
      simpleWebAuthn.generateRegistrationOptions
    );
    mockVerifyRegistrationResponse = vi.mocked(
      simpleWebAuthn.verifyRegistrationResponse
    );
    mockGenerateAuthenticationOptions = vi.mocked(
      simpleWebAuthn.generateAuthenticationOptions
    );
    mockVerifyAuthenticationResponse = vi.mocked(
      simpleWebAuthn.verifyAuthenticationResponse
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateWebAuthnRegistrationOptions", () => {
    it("should generate registration options with all parameters", async () => {
      const mockOptions = {
        challenge: testChallenge,
        rp: { name: "Narravo", id: "localhost" },
        user: {
          id: testUserId,
          name: testUserEmail,
          displayName: testUserName,
        },
        timeout: 60000,
      };

      mockGenerateRegistrationOptions.mockReturnValue(mockOptions);

      const existingCredentials = [
        { credentialId: "cred-1", transports: ["usb", "nfc"] },
        { credentialId: "cred-2", transports: ["internal"] },
      ];

      const options = await generateWebAuthnRegistrationOptions(
        testUserId,
        testUserEmail,
        testUserName,
        existingCredentials
      );

      expect(options).toEqual(mockOptions);
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpName: expect.any(String),
          rpID: expect.any(String),
          userName: testUserEmail,
          userDisplayName: testUserName,
          userID: expect.any(Uint8Array),
          attestationType: "none",
          excludeCredentials: expect.arrayContaining([
            expect.objectContaining({ id: "cred-1" }),
            expect.objectContaining({ id: "cred-2" }),
          ]),
          authenticatorSelection: expect.objectContaining({
            residentKey: "preferred",
            userVerification: "preferred",
          }),
        })
      );
    });

    it("should handle empty existing credentials", async () => {
      const mockOptions = {
        challenge: testChallenge,
        rp: { name: "Narravo", id: "localhost" },
        user: {
          id: testUserId,
          name: testUserEmail,
          displayName: testUserName,
        },
        timeout: 60000,
      };

      mockGenerateRegistrationOptions.mockReturnValue(mockOptions);

      const options = await generateWebAuthnRegistrationOptions(
        testUserId,
        testUserEmail,
        testUserName,
        []
      );

      expect(options).toEqual(mockOptions);
      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeCredentials: [],
        })
      );
    });

    it("should convert userId to Uint8Array", async () => {
      const mockOptions = {
        challenge: testChallenge,
        rp: { name: "Narravo", id: "localhost" },
        user: {
          id: testUserId,
          name: testUserEmail,
          displayName: testUserName,
        },
        timeout: 60000,
      };

      mockGenerateRegistrationOptions.mockReturnValue(mockOptions);

      await generateWebAuthnRegistrationOptions(
        testUserId,
        testUserEmail,
        testUserName,
        []
      );

      const callArgs = mockGenerateRegistrationOptions.mock.calls[0]?.[0];
      expect(callArgs?.userID).toBeInstanceOf(Uint8Array);
    });

    it("should set attestationType to none", async () => {
      const mockOptions = {
        challenge: testChallenge,
        rp: { name: "Narravo", id: "localhost" },
      };

      mockGenerateRegistrationOptions.mockReturnValue(mockOptions);

      await generateWebAuthnRegistrationOptions(
        testUserId,
        testUserEmail,
        testUserName,
        []
      );

      expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          attestationType: "none",
        })
      );
    });

    it("should exclude existing credentials", async () => {
      const mockOptions = { challenge: testChallenge };
      mockGenerateRegistrationOptions.mockReturnValue(mockOptions);

      const existingCredentials = [
        { credentialId: "cred-1", transports: ["usb"] },
        { credentialId: "cred-2", transports: [] },
      ];

      await generateWebAuthnRegistrationOptions(
        testUserId,
        testUserEmail,
        testUserName,
        existingCredentials
      );

      const callArgs = mockGenerateRegistrationOptions.mock.calls[0]?.[0];
      expect(callArgs?.excludeCredentials).toHaveLength(2);
      expect(callArgs?.excludeCredentials[0]).toMatchObject({
        id: "cred-1",
        transports: ["usb"],
      });
    });
  });

  describe("verifyWebAuthnRegistration", () => {
    it("should verify registration response successfully", async () => {
      const mockResponse: RegistrationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          attestationObject: "mock-attestation",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      const mockVerificationResult = {
        verified: true,
        registrationInfo: {
          credentialID: new Uint8Array(Buffer.from(testCredentialId)),
          credentialPublicKey: new Uint8Array(Buffer.from(testPublicKey)),
          counter: 0,
        },
      };

      mockVerifyRegistrationResponse.mockResolvedValue(mockVerificationResult);

      const result = await verifyWebAuthnRegistration(mockResponse, testChallenge);

      expect(result).toEqual(mockVerificationResult);
      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response: mockResponse,
          expectedChallenge: testChallenge,
          expectedOrigin: expect.any(String),
          expectedRPID: expect.any(String),
        })
      );
    });

    it("should pass correct expectedOrigin", async () => {
      const mockResponse: RegistrationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          attestationObject: "mock-attestation",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: undefined,
      });

      await verifyWebAuthnRegistration(mockResponse, testChallenge);

      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedOrigin: expect.stringMatching(/^http/),
        })
      );
    });

    it("should pass correct expectedRPID", async () => {
      const mockResponse: RegistrationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          attestationObject: "mock-attestation",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: undefined,
      });

      await verifyWebAuthnRegistration(mockResponse, testChallenge);

      expect(mockVerifyRegistrationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedRPID: expect.any(String),
        })
      );
    });

    it("should handle verification failure", async () => {
      const mockResponse: RegistrationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          attestationObject: "mock-attestation",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      const mockVerificationResult = {
        verified: false,
        registrationInfo: undefined,
      };

      mockVerifyRegistrationResponse.mockResolvedValue(mockVerificationResult);

      const result = await verifyWebAuthnRegistration(mockResponse, testChallenge);

      expect(result.verified).toBe(false);
    });
  });

  describe("generateWebAuthnAuthenticationOptions", () => {
    it("should generate authentication options with allowed credentials", async () => {
      const mockOptions = {
        challenge: testChallenge,
        timeout: 60000,
        allowCredentials: [
          { id: "cred-1", transports: ["usb"] },
          { id: "cred-2", transports: ["internal"] },
        ],
      };

      mockGenerateAuthenticationOptions.mockReturnValue(mockOptions);

      const allowedCredentials = [
        { credentialId: "cred-1", transports: ["usb"] },
        { credentialId: "cred-2", transports: ["internal"] },
      ];

      const options = await generateWebAuthnAuthenticationOptions(allowedCredentials);

      expect(options).toEqual(mockOptions);
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          rpID: expect.any(String),
          allowCredentials: expect.arrayContaining([
            expect.objectContaining({ id: "cred-1" }),
            expect.objectContaining({ id: "cred-2" }),
          ]),
          userVerification: "preferred",
        })
      );
    });

    it("should handle empty allowed credentials", async () => {
      const mockOptions = {
        challenge: testChallenge,
        timeout: 60000,
        allowCredentials: [],
      };

      mockGenerateAuthenticationOptions.mockReturnValue(mockOptions);

      const options = await generateWebAuthnAuthenticationOptions([]);

      expect(options).toEqual(mockOptions);
      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          allowCredentials: [],
        })
      );
    });

    it("should set userVerification to preferred", async () => {
      const mockOptions = { challenge: testChallenge };
      mockGenerateAuthenticationOptions.mockReturnValue(mockOptions);

      await generateWebAuthnAuthenticationOptions([]);

      expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          userVerification: "preferred",
        })
      );
    });

    it("should handle credentials with empty transports", async () => {
      const mockOptions = { challenge: testChallenge };
      mockGenerateAuthenticationOptions.mockReturnValue(mockOptions);

      const allowedCredentials = [
        { credentialId: "cred-1", transports: [] },
        { credentialId: "cred-2" }, // Missing transports
      ];

      await generateWebAuthnAuthenticationOptions(allowedCredentials);

      const callArgs = mockGenerateAuthenticationOptions.mock.calls[0]?.[0];
      expect(callArgs?.allowCredentials).toHaveLength(2);
    });
  });

  describe("verifyWebAuthnAuthentication", () => {
    it("should verify authentication response successfully", async () => {
      const mockResponse: AuthenticationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          authenticatorData: "mock-authenticator-data",
          signature: "mock-signature",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      const mockVerificationResult = {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          credentialID: new Uint8Array(Buffer.from(testCredentialId)),
        },
      };

      mockVerifyAuthenticationResponse.mockResolvedValue(mockVerificationResult);

      const result = await verifyWebAuthnAuthentication(
        mockResponse,
        testChallenge,
        testPublicKey,
        testCounter
      );

      expect(result).toEqual(mockVerificationResult);
      expect(mockVerifyAuthenticationResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          response: mockResponse,
          expectedChallenge: testChallenge,
          expectedOrigin: expect.any(String),
          expectedRPID: expect.any(String),
          credential: expect.objectContaining({
            id: testCredentialId,
            publicKey: expect.any(Buffer),
            counter: testCounter,
          }),
        })
      );
    });

    it("should decode base64 public key", async () => {
      const mockResponse: AuthenticationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          authenticatorData: "mock-authenticator-data",
          signature: "mock-signature",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          credentialID: new Uint8Array(),
        },
      });

      await verifyWebAuthnAuthentication(
        mockResponse,
        testChallenge,
        testPublicKey,
        testCounter
      );

      const callArgs = mockVerifyAuthenticationResponse.mock.calls[0]?.[0];
      expect(callArgs?.credential.publicKey).toBeInstanceOf(Buffer);
    });

    it("should pass credential counter", async () => {
      const mockResponse: AuthenticationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          authenticatorData: "mock-authenticator-data",
          signature: "mock-signature",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      mockVerifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 6,
          credentialID: new Uint8Array(),
        },
      });

      const initialCounter = 5;
      await verifyWebAuthnAuthentication(
        mockResponse,
        testChallenge,
        testPublicKey,
        initialCounter
      );

      const callArgs = mockVerifyAuthenticationResponse.mock.calls[0]?.[0];
      expect(callArgs?.credential.counter).toBe(initialCounter);
    });

    it("should handle verification failure", async () => {
      const mockResponse: AuthenticationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          authenticatorData: "mock-authenticator-data",
          signature: "mock-signature",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      const mockVerificationResult = {
        verified: false,
        authenticationInfo: {
          newCounter: testCounter,
          credentialID: new Uint8Array(),
        },
      };

      mockVerifyAuthenticationResponse.mockResolvedValue(mockVerificationResult);

      const result = await verifyWebAuthnAuthentication(
        mockResponse,
        testChallenge,
        testPublicKey,
        testCounter
      );

      expect(result.verified).toBe(false);
    });

    it("should validate counter increment", async () => {
      const mockResponse: AuthenticationResponseJSON = {
        id: testCredentialId,
        rawId: testCredentialId,
        response: {
          clientDataJSON: "mock-client-data",
          authenticatorData: "mock-authenticator-data",
          signature: "mock-signature",
        },
        type: "public-key",
        clientExtensionResults: {},
      };

      const mockVerificationResult = {
        verified: true,
        authenticationInfo: {
          newCounter: 11,
          credentialID: new Uint8Array(),
        },
      };

      mockVerifyAuthenticationResponse.mockResolvedValue(mockVerificationResult);

      const result = await verifyWebAuthnAuthentication(
        mockResponse,
        testChallenge,
        testPublicKey,
        10
      );

      expect(result.verified).toBe(true);
      expect(result.authenticationInfo.newCounter).toBe(11);
    });
  });
});
