// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as importJobsGet } from "@/app/api/import-jobs/route";

const mockAuth = vi.fn();
const mockDb = {
  select: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/db", () => ({
  get db() {
    return mockDb;
  },
}));

vi.mock("@/drizzle/schema", () => ({
  importJobs: Symbol("importJobs"),
}));

vi.mock("drizzle-orm", () => ({
  desc: (value: unknown) => ({ desc: value }),
}));

describe("/api/import-jobs", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockDb.select.mockReset();
  });

  it("requires admin access", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isAdmin: false } });

    const response = await importJobsGet();
    expect(response.status).toBe(401);
  });

  it("returns recent import jobs for administrators", async () => {
    mockAuth.mockResolvedValue({ user: { id: "admin", isAdmin: true } });

    mockDb.select.mockReturnValue({
      from: () => ({
        orderBy: () => ({
          limit: vi.fn().mockResolvedValue([
            { id: "job-1", status: "completed" },
          ]),
        }),
      }),
    });

    const response = await importJobsGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.jobs).toEqual([{ id: "job-1", status: "completed" }]);
  });
});
