// SPDX-License-Identifier: Apache-2.0
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { TwoFactorGuard } from "@/components/auth/TwoFactorGuard";

// Mock router functions
const mockPush = vi.fn();
const mockPathname = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

// Mock session data
let mockSessionData: ReturnType<typeof vi.fn> | null = null;
let mockSessionStatus: "loading" | "authenticated" | "unauthenticated" = "loading";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: mockSessionData?.(),
    status: mockSessionStatus,
  }),
}));

describe("TwoFactorGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStatus = "loading";
    mockSessionData = null;
    mockPathname.mockReturnValue("/");

    // Mock console to reduce test noise
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("Guard Bypass Conditions", () => {
    it("should render children when status is loading", () => {
      mockSessionStatus = "loading";

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should render children when status is unauthenticated", () => {
      mockSessionStatus = "unauthenticated";

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should render children when session is null", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue(null);

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should bypass guard when already on /login/2fa page", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/login/2fa");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should bypass guard for /login/* paths", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/login");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should bypass guard for /api/* paths", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/api/2fa/totp/verify");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should bypass guard when mfaPending is false", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
        mfa: { verified: true },
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should bypass guard when mfaPending is undefined", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        // mfaPending not set (undefined)
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Guard Activation", () => {
    it("should redirect to /login/2fa when mfaPending is true", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      // Children should still render (guard doesn't prevent rendering)
      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();

      // Should redirect
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });

    it("should redirect from any protected path when mfaPending is true", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/profile/settings");

      render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });

    it("should handle case where mfaPending is explicitly true boolean", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true as boolean, // Explicitly typed
      });
      mockPathname.mockReturnValue("/dashboard");

      render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });
  });

  describe("Session State Changes", () => {
    it("should react to session updates", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
      });
      mockPathname.mockReturnValue("/admin");

      const { rerender } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(mockPush).not.toHaveBeenCalled();

      // Update session to have mfaPending
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });

      rerender(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });

    it("should react to pathname changes", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/login/2fa");

      const { rerender } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      // Should not redirect when on /login/2fa
      expect(mockPush).not.toHaveBeenCalled();

      // Navigate to different page
      mockPathname.mockReturnValue("/admin");

      rerender(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      // Should now redirect
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });
  });

  describe("Children Rendering", () => {
    it("should always render children (guard does not block rendering)", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="content-1">Content 1</div>
          <div data-testid="content-2">Content 2</div>
        </TwoFactorGuard>
      );

      // Children should render even when redirect is triggered
      expect(container.querySelector('[data-testid="content-1"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="content-2"]')).toBeInTheDocument();
    });

    it("should render complex children structure", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
      });
      mockPathname.mockReturnValue("/");

      const ComplexChild = () => (
        <div>
          <header data-testid="header">Header</header>
          <main data-testid="main">Main Content</main>
          <footer data-testid="footer">Footer</footer>
        </div>
      );

      const { container } = render(
        <TwoFactorGuard>
          <ComplexChild />
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="header"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="main"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="footer"]')).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined mfa property gracefully", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        // No mfa or mfaPending properties
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should handle mfaPending as false explicitly", () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
        mfa: { verified: true },
      });
      mockPathname.mockReturnValue("/admin");

      const { container } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(container.querySelector('[data-testid="protected-content"]')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should only redirect once per guard activation", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      mockPathname.mockReturnValue("/admin");

      render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });

      // Should only be called once
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid session changes", async () => {
      mockSessionStatus = "authenticated";
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
      });
      mockPathname.mockReturnValue("/admin");

      const { rerender } = render(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      expect(mockPush).not.toHaveBeenCalled();

      // Toggle mfaPending rapidly
      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: true,
      });
      rerender(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      mockSessionData = vi.fn().mockReturnValue({
        user: { email: "test@example.com" },
        mfaPending: false,
      });
      rerender(
        <TwoFactorGuard>
          <div data-testid="protected-content">Protected Content</div>
        </TwoFactorGuard>
      );

      // Should have been called when mfaPending was true
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/login/2fa");
      });
    });
  });
});
