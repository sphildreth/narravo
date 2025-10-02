// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    process.env = originalEnv;
  });

  describe("log level filtering", () => {
    it("should not log debug messages when LOG_LEVEL is not debug", async () => {
      // Set env before import
      process.env.LOG_LEVEL = "info";
      
      // Dynamic import to get fresh logger with new env
      const { default: logger } = await import("@/lib/logger");
      
      logger.debug("test debug message");
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should always log info messages regardless of LOG_LEVEL", async () => {
      process.env.LOG_LEVEL = "info";
      
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("test info message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should always log warn messages", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.warn("test warn message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should always log error messages", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.error("test error message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("log formatting", () => {
    it("should include timestamp in log output", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("test message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0]?.[0] as string | undefined;
      expect(logCall).toBeDefined();
      // Check for ISO timestamp format [YYYY-MM-DDTHH:MM:SS.sssZ]
      expect(logCall!).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it("should include uppercase log level", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("test message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0]?.[0] as string | undefined;
      expect(logCall).toBeDefined();
      expect(logCall!).toMatch(/\[INFO\]/);
    });

    it("should include the message", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("test message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0]?.[0] as string | undefined;
      expect(logCall).toBeDefined();
      expect(logCall!).toContain("test message");
    });

    it("should format log as [timestamp] [LEVEL] message", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.warn("warning message");
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0]?.[0] as string | undefined;
      expect(logCall).toBeDefined();
      expect(logCall!).toMatch(/^\[.+\] \[WARN\] warning message$/);
    });
  });

  describe("log levels", () => {
    it("should log info messages", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("info message");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] info message")
      );
    });

    it("should log warn messages", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.warn("warn message");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN] warn message")
      );
    });

    it("should log error messages", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.error("error message");
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] error message")
      );
    });
  });

  describe("context inclusion", () => {
    it("should include additional arguments in log output", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      const context = { userId: 123, action: "login" };
      logger.info("user action", context);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] user action"),
        context
      );
    });

    it("should handle multiple context arguments", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("complex log", { data: "test" }, "extra", 123);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] complex log"),
        { data: "test" },
        "extra",
        123
      );
    });

    it("should handle null and undefined context", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      logger.info("log with null", null, undefined);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[INFO] log with null"),
        null,
        undefined
      );
    });
  });

  describe("error logging", () => {
    it("should log Error objects with context", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      const error = new Error("Test error");
      logger.error("Error occurred", error);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] Error occurred"),
        error
      );
    });

    it("should handle error with additional context", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      const error = new Error("Test error");
      const context = { operation: "database query", table: "users" };
      logger.error("Database error", error, context);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] Database error"),
        error,
        context
      );
    });

    it("should log error stack trace when available", async () => {
      const { default: logger } = await import("@/lib/logger");
      
      const error = new Error("Test error with stack");
      error.stack = "Error: Test error with stack\n    at test.ts:1:1";
      logger.error("Stack trace test", error);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] Stack trace test"),
        error
      );
    });
  });
});
