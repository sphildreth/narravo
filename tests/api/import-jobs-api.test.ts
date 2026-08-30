// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as importJobsGet, POST as importJobsPost } from "@/app/api/import-jobs/route";

const mockRequireAdmin2FA = vi.fn();
const mockStartImportJob = vi.fn();
const mockDb = {
  select: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  requireAdmin2FA: (...args: unknown[]) => mockRequireAdmin2FA(...args),
}));

vi.mock("@/app/actions/import", () => ({
  startImportJob: (...args: unknown[]) => mockStartImportJob(...args),
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
    mockRequireAdmin2FA.mockReset();
    mockStartImportJob.mockReset();
    mockDb.select.mockReset();
  });

  it("requires admin access", async () => {
    mockRequireAdmin2FA.mockRejectedValueOnce(new Error("Unauthorized"));

    const response = await importJobsGet();
    expect(response.status).toBe(401);
  });

  it("returns recent import jobs for administrators", async () => {
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "admin", isAdmin: true } });

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

  it("rejects oversized import bodies before parsing them", async () => {
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "admin", isAdmin: true } });
    const request = new Request("http://localhost/api/import-jobs", {
      method: "POST",
      headers: { "content-length": String(52 * 1024 * 1024) },
    });

    const response = await importJobsPost(request as any);

    expect(response.status).toBe(413);
    expect(mockStartImportJob).not.toHaveBeenCalled();
  });

  it("starts an import through the authenticated route handler", async () => {
    mockRequireAdmin2FA.mockResolvedValue({ user: { id: "admin", isAdmin: true } });
    mockStartImportJob.mockResolvedValue({ job: { id: "job-2", status: "queued" } });
    const form = new FormData();
    form.set("file", new File(["<rss />"], "export.xml", { type: "text/xml" }));
    form.set("options", JSON.stringify({ dryRun: true }));
    const request = new Request("http://localhost/api/import-jobs", {
      method: "POST",
      body: form,
    });

    const response = await importJobsPost(request as any);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.job).toEqual({ id: "job-2", status: "queued" });
    expect(mockStartImportJob).toHaveBeenCalledWith(expect.any(FormData));
  });
});
