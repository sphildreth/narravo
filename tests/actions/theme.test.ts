// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock next/headers before importing the module
vi.mock("next/headers", () => {
  const mockSet = vi.fn();
  const mockCookies = vi.fn(() => ({
    set: mockSet,
  }));
  
  return {
    cookies: mockCookies,
  };
});

import { setTheme } from "@/app/actions/theme";
import { cookies } from "next/headers";

const mockCookies = cookies as ReturnType<typeof vi.fn>;
const mockSet = (mockCookies as any)().set as ReturnType<typeof vi.fn>;

describe("theme.ts - setTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("theme value handling", () => {
    it('should set theme cookie to "light"', async () => {
      // Arrange & Act
      await setTheme("light");

      // Assert
      expect(mockCookies).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "light",
        expect.objectContaining({
          path: "/",
        })
      );
    });

    it('should set theme cookie to "dark"', async () => {
      // Arrange & Act
      await setTheme("dark");

      // Assert
      expect(mockCookies).toHaveBeenCalledTimes(1);
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "dark",
        expect.objectContaining({
          path: "/",
        })
      );
    });
  });

  describe("cookie attributes", () => {
    it("should set cookie with correct path", async () => {
      // Arrange & Act
      await setTheme("light");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "light",
        expect.objectContaining({
          path: "/",
        })
      );
    });

    it("should set cookie with correct maxAge (1 year)", async () => {
      // Arrange
      const oneYearInSeconds = 60 * 60 * 24 * 365;

      // Act
      await setTheme("dark");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "dark",
        expect.objectContaining({
          maxAge: oneYearInSeconds,
        })
      );
    });

    it('should set cookie with sameSite "lax"', async () => {
      // Arrange & Act
      await setTheme("light");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "light",
        expect.objectContaining({
          sameSite: "lax",
        })
      );
    });

    it("should set secure flag to true in production", async () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "production");

      // Act
      await setTheme("dark");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "dark",
        expect.objectContaining({
          secure: true,
        })
      );
    });

    it("should set secure flag to false in development", async () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "development");

      // Act
      await setTheme("light");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "light",
        expect.objectContaining({
          secure: false,
        })
      );
    });

    it("should set secure flag to false in test environment", async () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "test");

      // Act
      await setTheme("dark");

      // Assert
      expect(mockSet).toHaveBeenCalledWith(
        "theme",
        "dark",
        expect.objectContaining({
          secure: false,
        })
      );
    });
  });

  describe("cookie configuration completeness", () => {
    it("should set all required cookie attributes", async () => {
      // Arrange
      vi.stubEnv("NODE_ENV", "production");

      // Act
      await setTheme("light");

      // Assert
      expect(mockSet).toHaveBeenCalledWith("theme", "light", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: true,
      });
    });

    it("should call cookies() function once per theme change", async () => {
      // Arrange & Act
      await setTheme("dark");

      // Assert
      expect(mockCookies).toHaveBeenCalledTimes(1);
    });

    it("should call set() method once per theme change", async () => {
      // Arrange & Act
      await setTheme("light");

      // Assert
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple theme changes", () => {
    it("should handle multiple sequential theme changes", async () => {
      // Arrange & Act
      await setTheme("light");
      await setTheme("dark");
      await setTheme("light");

      // Assert
      expect(mockCookies).toHaveBeenCalledTimes(3);
      expect(mockSet).toHaveBeenCalledTimes(3);

      // Verify final call
      expect(mockSet).toHaveBeenLastCalledWith(
        "theme",
        "light",
        expect.objectContaining({
          path: "/",
        })
      );
    });

    it("should handle setting the same theme multiple times", async () => {
      // Arrange & Act
      await setTheme("dark");
      await setTheme("dark");

      // Assert
      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(
        1,
        "theme",
        "dark",
        expect.any(Object)
      );
      expect(mockSet).toHaveBeenNthCalledWith(
        2,
        "theme",
        "dark",
        expect.any(Object)
      );
    });
  });
});
