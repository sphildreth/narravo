// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from "vitest";
import { GET as versionGet } from "@/app/api/version/route";

vi.mock("@/version", () => ({
  APP_VERSION: "1.2.3",
  GIT_SHA: "abcdef",
  BUILD_TIME: "2025-01-01T00:00:00Z",
}));

describe("/api/version", () => {
  it("exposes build metadata", async () => {
    const response = await versionGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      version: "1.2.3",
      git: "abcdef",
      buildTime: "2025-01-01T00:00:00Z",
    });
  });
});
