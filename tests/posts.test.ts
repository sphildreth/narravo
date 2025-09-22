// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

const {
  __testables__: { normalizePagination },
} = await import("@/lib/posts");

describe("normalizePagination", () => {
  it("returns defaults when params are missing", () => {
    const result = normalizePagination();
    expect(result).toEqual({ page: 1, pageSize: 10, limit: 10, offset: 0 });
  });

  it("clamps the page to at least 1", () => {
    expect(normalizePagination({ page: -5, pageSize: 10 }).page).toBe(1);
    expect(normalizePagination({ page: 0, pageSize: 10 }).page).toBe(1);
  });

  it("clamps the page size between 1 and 50", () => {
    expect(normalizePagination({ page: 1, pageSize: 0 }).pageSize).toBe(1);
    expect(normalizePagination({ page: 1, pageSize: 999 }).pageSize).toBe(50);
  });

  it("calculates limit and offset based on the sanitized inputs", () => {
    const result = normalizePagination({ page: 3, pageSize: 20 });
    expect(result).toEqual({ page: 3, pageSize: 20, limit: 20, offset: 40 });
  });
});
