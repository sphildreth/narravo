// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExecute = vi.fn();

vi.mock("@/lib/db", () => ({
  get db() {
    return { execute: mockExecute };
  },
}));

import { peekSharedRateLimit } from "@/lib/shared-rate-limit";

describe("peekSharedRateLimit", () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("rejects invalid maxAttempts values", async () => {
    await expect(peekSharedRateLimit("bucket", 0)).rejects.toThrow("Invalid rate-limit configuration");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
