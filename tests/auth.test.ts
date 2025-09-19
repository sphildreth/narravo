import { describe, expect, it } from "vitest";
import { isEmailAdmin, parseAdminAllowlist } from "../lib/admin";

describe("parseAdminAllowlist", () => {
  it("splits comma separated values and trims whitespace", () => {
    const set = parseAdminAllowlist(" admin@example.com ,root@example.com, ");
    expect(set.has("admin@example.com")).toBe(true);
    expect(set.has("root@example.com")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("handles empty input", () => {
    const set = parseAdminAllowlist(undefined);
    expect(set.size).toBe(0);
  });
});

describe("isEmailAdmin", () => {
  it("returns true when email is allowlisted", () => {
    const raw = "admin@example.com";
    expect(isEmailAdmin("admin@example.com", raw)).toBe(true);
    expect(isEmailAdmin("ADMIN@example.com", raw)).toBe(true);
  });

  it("returns false when email is not allowlisted", () => {
    const raw = "admin@example.com";
    expect(isEmailAdmin("user@example.com", raw)).toBe(false);
    expect(isEmailAdmin(undefined, raw)).toBe(false);
  });
});
