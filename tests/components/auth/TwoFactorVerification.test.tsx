// SPDX-License-Identifier: Apache-2.0
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { startAuthentication } from "@simplewebauthn/browser";
import TwoFactorVerification from "@/components/auth/TwoFactorVerification";

// Mock Next.js navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

// Mock next-auth session
const mockUpdate = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
    update: mockUpdate,
  }),
}));

// Mock WebAuthn browser client
vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
}));

describe("TwoFactorVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Mock console methods to reduce test noise
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Method Switching", () => {
    it("should render with TOTP method selected by default", () => {
      render(<TwoFactorVerification />);

      // TOTP form should be visible
      expect(screen.getByLabelText("Authenticator Code")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();

      // Method button should be highlighted
      const totpButton = screen.getByRole("button", { name: /Authenticator/i });
      expect(totpButton).toHaveClass("bg-primary");
    });

    it("should switch to WebAuthn method when clicked", () => {
      render(<TwoFactorVerification />);

      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      // WebAuthn UI should be visible
      expect(screen.getByText(/Use your passkey/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Authenticate with Passkey/i })).toBeInTheDocument();

      // WebAuthn button should be highlighted
      expect(webauthnButton).toHaveClass("bg-primary");
    });

    it("should switch to Recovery method when clicked", () => {
      render(<TwoFactorVerification />);

      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      // Recovery form should be visible
      expect(screen.getByLabelText("Recovery Code")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("xxxx-xxxx-xxxx")).toBeInTheDocument();

      // Recovery button should be highlighted
      expect(recoveryButton).toHaveClass("bg-primary");
    });

    it("should clear error when switching methods", async () => {
      // Mock failed response BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid code" }),
      });

      render(<TwoFactorVerification />);

      // Trigger error on TOTP
      const totpInput = screen.getByPlaceholderText("000000");
      fireEvent.change(totpInput, { target: { value: "123456" } });

      const verifyButton = screen.getByRole("button", { name: /Verify/i });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid code")).toBeInTheDocument();
      });

      // Switch to WebAuthn - error should clear
      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      await waitFor(() => {
        expect(screen.queryByText("Invalid code")).not.toBeInTheDocument();
      });
    });
  });

  describe("TOTP Code Input", () => {
    it("should format code input to numbers only", () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000") as HTMLInputElement;

      // Type mixed input
      fireEvent.change(input, { target: { value: "1a2b3c" } });

      // Should only keep numbers
      expect(input.value).toBe("123");
    });

    it("should limit code to 6 digits", () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000") as HTMLInputElement;

      // Type more than 6 digits
      fireEvent.change(input, { target: { value: "1234567890" } });

      // Should truncate to 6
      expect(input.value).toBe("123456");
    });

    it("should disable verify button when code is incomplete", () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Button should be disabled initially
      expect(verifyButton).toBeDisabled();

      // Type partial code
      fireEvent.change(input, { target: { value: "123" } });
      expect(verifyButton).toBeDisabled();

      // Type complete code
      fireEvent.change(input, { target: { value: "123456" } });
      expect(verifyButton).not.toBeDisabled();
    });
  });

  describe("TOTP Verification", () => {
    it("should successfully verify TOTP code", async () => {
      // Mock successful response BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Enter valid code
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/totp/verify",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              code: "123456",
              rememberDevice: false,
            }),
          })
        );
      });

      // Should update session
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith({});
      });

      // Should redirect after delay
      await waitFor(
        () => {
          expect(mockPush).toHaveBeenCalledWith("/");
          expect(mockRefresh).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });

    it("should display error for invalid TOTP code", async () => {
      // Mock error response BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid or expired code" }),
      });

      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Enter code
      fireEvent.change(input, { target: { value: "000000" } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid or expired code")).toBeInTheDocument();
      });

      // Should not redirect
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(verifyButton);

      // Mock network failure
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

      await waitFor(() => {
        expect(screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
      });
    });

    it("should include rememberDevice when checkbox is checked", async () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const checkbox = screen.getByLabelText(/Remember this device/i);
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Check remember device
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // Submit
      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(verifyButton);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/totp/verify",
          expect.objectContaining({
            body: JSON.stringify({
              code: "123456",
              rememberDevice: true,
            }),
          })
        );
      });
    });

    it("should disable button and show loading state while verifying", async () => {
      render(<TwoFactorVerification />);

      const input = screen.getByPlaceholderText("000000");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      fireEvent.change(input, { target: { value: "123456" } });
      fireEvent.click(verifyButton);

      // Mock slow response
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ success: true }),
                }),
              100
            )
          )
      );

      // Button should show loading state
      await waitFor(() => {
        const loadingButton = screen.getByRole("button", { name: /Verifying.../i });
        expect(loadingButton).toBeInTheDocument();
        expect(loadingButton).toBeDisabled();
      });
    });
  });

  describe("WebAuthn Verification", () => {
    it("should successfully authenticate with WebAuthn", async () => {
      // Set up all mocks BEFORE rendering
      const mockAuthResponse = { id: "credential-id", response: {} };
      
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ options: { challenge: "test-challenge" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ verified: true }),
        });

      (startAuthentication as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockAuthResponse);

      render(<TwoFactorVerification />);

      // Switch to WebAuthn
      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      const authenticateButton = screen.getByRole("button", { name: /Authenticate with Passkey/i });
      fireEvent.click(authenticateButton);

      // Should get options first
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/2fa/webauthn/authenticate/options", {
          method: "POST",
        });
      });

      // Should call startAuthentication
      await waitFor(() => {
        expect(startAuthentication).toHaveBeenCalledWith({ options: { challenge: "test-challenge" } });
      });

      // Should verify the response
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/webauthn/authenticate/verify",
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...mockAuthResponse,
              rememberDevice: false,
            }),
          })
        );
      });

      // Should update session and redirect
      await waitFor(
        () => {
          expect(mockUpdate).toHaveBeenCalledWith({});
          expect(mockPush).toHaveBeenCalledWith("/");
        },
        { timeout: 1000 }
      );
    });

    it("should handle WebAuthn authentication cancellation", async () => {
      // Set up mocks BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ options: { challenge: "test-challenge" } }),
      });

      const error = new Error("User cancelled authentication");
      error.name = "NotAllowedError";
      (startAuthentication as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      render(<TwoFactorVerification />);

      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      const authenticateButton = screen.getByRole("button", { name: /Authenticate with Passkey/i });
      fireEvent.click(authenticateButton);

      await waitFor(() => {
        expect(screen.getByText("Authentication was cancelled or timed out")).toBeInTheDocument();
      });
    });

    it("should handle WebAuthn verification failure", async () => {
      // Set up all mocks BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ options: { challenge: "test-challenge" } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Failed to verify authentication" }),
        });

      (startAuthentication as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "credential-id",
        response: {},
      });

      render(<TwoFactorVerification />);

      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      const authenticateButton = screen.getByRole("button", { name: /Authenticate with Passkey/i });
      fireEvent.click(authenticateButton);

      await waitFor(() => {
        expect(screen.getByText("Failed to verify authentication")).toBeInTheDocument();
      });
    });

    it("should include rememberDevice for WebAuthn", async () => {
      render(<TwoFactorVerification />);

      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);

      const checkbox = screen.getByLabelText(/Remember this device/i);
      fireEvent.click(checkbox);

      const authenticateButton = screen.getByRole("button", { name: /Authenticate with Passkey/i });

      // Mock successful flow
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ options: { challenge: "test-challenge" } }),
      });

      (startAuthentication as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "credential-id",
        response: {},
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

      fireEvent.click(authenticateButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/webauthn/authenticate/verify",
          expect.objectContaining({
            body: expect.stringContaining('"rememberDevice":true'),
          })
        );
      });
    });
  });

  describe("Recovery Code Verification", () => {
    it("should successfully verify recovery code", async () => {
      // Mock successful response BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(<TwoFactorVerification />);

      // Switch to recovery
      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const input = screen.getByPlaceholderText("xxxx-xxxx-xxxx");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Enter recovery code
      fireEvent.change(input, { target: { value: "  abc123-def456-ghi789  " } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/recovery/verify",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              code: "abc123-def456-ghi789", // Should be trimmed
              rememberDevice: false,
            }),
          })
        );
      });

      // Should update session and redirect
      await waitFor(
        () => {
          expect(mockUpdate).toHaveBeenCalledWith({});
          expect(mockPush).toHaveBeenCalledWith("/");
        },
        { timeout: 1000 }
      );
    });

    it("should display error for invalid recovery code", async () => {
      // Mock error response BEFORE rendering
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Invalid recovery code" }),
      });

      render(<TwoFactorVerification />);

      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const input = screen.getByPlaceholderText("xxxx-xxxx-xxxx");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      fireEvent.change(input, { target: { value: "invalid-code" } });
      fireEvent.click(verifyButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid recovery code")).toBeInTheDocument();
      });
    });

    it("should disable verify button when recovery code is empty", () => {
      render(<TwoFactorVerification />);

      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      // Should be disabled when empty
      expect(verifyButton).toBeDisabled();

      // Enable when code is entered
      const input = screen.getByPlaceholderText("xxxx-xxxx-xxxx");
      fireEvent.change(input, { target: { value: "abc123" } });
      expect(verifyButton).not.toBeDisabled();
    });

    it("should trim whitespace from recovery code", () => {
      render(<TwoFactorVerification />);

      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const input = screen.getByPlaceholderText("xxxx-xxxx-xxxx") as HTMLInputElement;

      // Type with whitespace
      fireEvent.change(input, { target: { value: "  test-code  " } });

      // Should be trimmed in the input
      expect(input.value).toBe("test-code");
    });

    it("should include rememberDevice for recovery code", async () => {
      render(<TwoFactorVerification />);

      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const checkbox = screen.getByLabelText(/Remember this device/i);
      fireEvent.click(checkbox);

      const input = screen.getByPlaceholderText("xxxx-xxxx-xxxx");
      const verifyButton = screen.getByRole("button", { name: /Verify/i });

      fireEvent.change(input, { target: { value: "test-code" } });
      fireEvent.click(verifyButton);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/2fa/recovery/verify",
          expect.objectContaining({
            body: JSON.stringify({
              code: "test-code",
              rememberDevice: true,
            }),
          })
        );
      });
    });
  });

  describe("UI and Accessibility", () => {
    it("should render help text for each method", () => {
      render(<TwoFactorVerification />);

      // TOTP help text
      expect(screen.getByText(/Enter the 6-digit code from your authenticator app/i)).toBeInTheDocument();

      // Switch to WebAuthn
      const webauthnButton = screen.getByRole("button", { name: /Passkey/i });
      fireEvent.click(webauthnButton);
      expect(screen.getByText(/Use your passkey \(biometrics or security key\)/i)).toBeInTheDocument();

      // Switch to Recovery
      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);
      expect(screen.getByText(/Enter one of your recovery codes/i)).toBeInTheDocument();
    });

    it("should render recovery hint message", () => {
      render(<TwoFactorVerification />);

      expect(
        screen.getByText(/Lost access to your authenticator\? Use a recovery code or passkey instead/i)
      ).toBeInTheDocument();
    });

    it("should have proper form labels and accessibility attributes", () => {
      render(<TwoFactorVerification />);

      // TOTP
      const totpInput = screen.getByLabelText("Authenticator Code");
      expect(totpInput).toHaveAttribute("id", "totp-code");
      expect(totpInput).toHaveAttribute("autoComplete", "off");
      expect(totpInput).toHaveAttribute("maxLength", "6");

      // Switch to Recovery
      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const recoveryInput = screen.getByLabelText("Recovery Code");
      expect(recoveryInput).toHaveAttribute("id", "recovery-code");
      expect(recoveryInput).toHaveAttribute("autoComplete", "off");
    });

    // Note: autofocus testing is skipped because jsdom doesn't reliably
    // render the autofocus attribute even when React's autoFocus prop is used.
    // The component has autoFocus={true} on inputs, which works in real browsers.
    it.skip("should autofocus the input field for each method", () => {
      render(<TwoFactorVerification />);

      // TOTP should autofocus
      const totpInput = screen.getByPlaceholderText("000000");
      expect(totpInput).toHaveAttribute("autofocus");

      // Switch to Recovery
      const recoveryButton = screen.getByRole("button", { name: /Recovery/i });
      fireEvent.click(recoveryButton);

      const recoveryInput = screen.getByPlaceholderText("xxxx-xxxx-xxxx");
      expect(recoveryInput).toHaveAttribute("autofocus");
    });
  });
});
