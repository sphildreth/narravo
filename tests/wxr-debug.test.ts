// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFixture } from "./helpers/fixtures";
import { importWxr } from "@/scripts/import-wxr";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({}),
    }),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    transaction: vi.fn().mockImplementation(async (fn) => fn({
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "test-id" }]),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      }),
    })),
  },
}));

vi.mock("@/lib/s3", () => ({
  getS3Config: vi.fn(() => null),
  S3Service: vi.fn(),
}));

vi.mock("@/lib/local-storage", () => ({
  localStorageService: {
    uploadFile: vi.fn().mockResolvedValue("mock-upload-path"),
  },
}));

// Mock fs to load fixtures
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";

describe("WXR Import Debug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should debug minimal fixture loading", async () => {
    console.log("=== DEBUG: Loading minimal fixture ===");
    console.log("Process cwd:", process.cwd());
    console.log("FIXTURE_DIR env var:", process.env.FIXTURE_DIR);
    
    let xml;
    try {
      xml = await loadFixture("wxr_minimal.xml");
      console.log("Fixture loaded successfully");
      console.log("Fixture length:", xml?.length);
      if (xml) {
        console.log("First 200 chars:", xml.substring(0, 200));
        console.log("Contains <item>:", xml.includes("<item>"));
        console.log("Contains wp:post_type:", xml.includes("wp:post_type"));
        console.log("Contains wp:status:", xml.includes("wp:status"));
      } else {
        console.log("ERROR: xml is undefined/null");
      }
    } catch (error) {
      console.log("ERROR loading fixture:", error);
      throw error;
    }
    
    vi.mocked(readFile).mockResolvedValue(xml);
    console.log("=== Mock setup complete ===");

    const result = await importWxr("test.xml", { dryRun: true, verbose: true });
    
    console.log("=== Import Result ===");
    console.log("Summary:", JSON.stringify(result.summary, null, 2));
    console.log("Errors:", result.errors.length > 0 ? result.errors : "No errors");

    expect(result.summary.totalItems).toBeGreaterThan(0);
  });
});