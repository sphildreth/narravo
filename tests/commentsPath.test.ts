// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from "vitest";
import { makeChildPath } from "@/lib/commentsPath";
describe("makeChildPath", () => {
  it("roots with padded segment", () => {
    expect(makeChildPath(null, 3)).toBe("0003");
  });
  it("nests paths", () => {
    expect(makeChildPath("0003", 12)).toBe("0003.0012");
  });
});
