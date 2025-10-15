// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/db");
vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
  auth: vi.fn(),
  authGet: vi.fn(),
  authPost: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("node:fs/promises");
vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
  },
}));

// Mock the import-wxr script
const importWxrMock = vi.fn();
vi.mock("../../../scripts/import-wxr", () => ({
  importWxr: importWxrMock,
}));

import { startImportJob, cancelImportJob, retryImportJob, deleteImportJob } from "@/app/actions/import";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import logger from "@/lib/logger";

const authMock = auth as Mock;
const revalidatePathMock = revalidatePath as Mock;
const fsMock = fs as any;
const loggerErrorMock = logger.error as Mock;

function makeFormData(data: Record<string, string | File>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }
  return formData;
}

function createMockFile(name: string, content: string): File {
  return new File([content], name, { type: "text/xml" });
}

describe("import.ts - startImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user-1", isAdmin: true },
    });

    // Default filesystem mocks
    fsMock.mkdir = vi.fn().mockResolvedValue(undefined);
    fsMock.writeFile = vi.fn().mockResolvedValue(undefined);
    fsMock.unlink = vi.fn().mockResolvedValue(undefined);
    fsMock.access = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authorization", () => {
    it("should require authenticated user", async () => {
      // Arrange
      authMock.mockResolvedValueOnce(null);
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("Unauthorized");
      expect(result.job).toBeUndefined();
    });

    it("should require admin user", async () => {
      // Arrange
      authMock.mockResolvedValueOnce({
        user: { id: "user-1", isAdmin: false },
      });
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("Unauthorized");
    });

    it("should allow admin users", async () => {
      // Arrange
      authMock.mockResolvedValueOnce({
        user: { id: "admin-1", isAdmin: true },
      });

      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: "job-1", status: "queued", fileName: "test.xml" },
          ]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([
            { id: "job-1", status: "completed" },
          ]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 1,
          postsImported: 1,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.job).toBeDefined();
    });
  });

  describe("file validation", () => {
    it("should return error when no file provided", async () => {
      // Arrange
      const formData = new FormData();
      formData.append("options", JSON.stringify({ dryRun: true }));

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("No file provided");
    });

    it("should validate .xml file extension", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.txt", "content"),
        options: JSON.stringify({ dryRun: true }),
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("File must be a .xml file");
    });

    it("should accept valid .xml files", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("valid-export.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.job).toBeDefined();
    });
  });

  describe("options parsing", () => {
    it("should return error for invalid JSON options", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: "not valid json",
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("Invalid options format");
    });

    it("should parse valid JSON options", async () => {
      // Arrange
      const options = {
        dryRun: true,
        skipExisting: true,
        author: "admin",
      };

      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify(options),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn((values: any) => {
          // Verify options are parsed correctly
          expect(values.options).toEqual(options);
          return {
            returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
          };
        }),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert - verified in mock callback
    });
  });

  describe("temporary file handling", () => {
    it("should create temporary directory", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(fsMock.mkdir).toHaveBeenCalledWith("/tmp/narravo-imports", {
        recursive: true,
      });
    });

    it("should write uploaded file to temporary location", async () => {
      // Arrange
      const fileContent = "<wordpress-export>test</wordpress-export>";
      const formData = makeFormData({
        file: createMockFile("export.xml", fileContent),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(fsMock.writeFile).toHaveBeenCalled();
      const writeCall = fsMock.writeFile.mock.calls[0];
      expect(writeCall[0]).toMatch(/\/tmp\/narravo-imports\/.+-export\.xml/);
    });

    it("should clean up temporary file after dry run", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: "job-1", filePath: "/tmp/test.xml" },
          ]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(fsMock.unlink).toHaveBeenCalled();
    });
  });

  describe("job creation", () => {
    it("should create job record in database", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      const insertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
      }));
      const insertMock = vi.fn(() => ({ values: insertValues }));

      (db as any).insert = insertMock;
      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(insertMock).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "test.xml",
          userId: "user-1",
          status: "queued",
        })
      );
    });

    it("should return error if job creation fails", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]), // Empty array = no job created
        })),
      }));

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("Failed to create job record");
    });

    it("should revalidate import page path", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 0,
          postsImported: 0,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(revalidatePathMock).toHaveBeenCalledWith("/admin/system/import");
    });
  });

  describe("dry run execution", () => {

    it("should update job status to completed on successful dry run", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      (db as any).select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: "job-1" }]),
        })),
      }));

      const updateSet = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));

      (db as any).update = vi.fn(() => ({ set: updateSet }));

      importWxrMock.mockResolvedValueOnce({
        summary: {
          totalItems: 1,
          postsImported: 1,
          attachmentsProcessed: 0,
          redirectsCreated: 0,
          skipped: 0,
        },
      });

      // Act
      await startImportJob(formData);

      // Assert
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });
  });

  describe("error handling", () => {
    it("should log errors", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      const testError = new Error("Test error");
      (db as any).insert = vi.fn(() => {
        throw testError;
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(loggerErrorMock).toHaveBeenCalledWith("Start import job error:", testError);
      expect(result.error).toBe("Test error");
    });

    it("should return generic error message for non-Error objects", async () => {
      // Arrange
      const formData = makeFormData({
        file: createMockFile("test.xml", "<xml/>"),
        options: JSON.stringify({ dryRun: true }),
      });

      (db as any).insert = vi.fn(() => {
        throw "String error";
      });

      // Act
      const result = await startImportJob(formData);

      // Assert
      expect(result.error).toBe("Failed to start import job");
    });
  });
});

describe("import.ts - cancelImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user-1", isAdmin: true },
    });
  });

  it("should require admin authorization", async () => {
    // Arrange
    authMock.mockResolvedValueOnce(null);

    // Act
    const result = await cancelImportJob("job-1");

    // Assert
    expect(result.error).toBe("Unauthorized");
  });

  it("should update job status to cancelling", async () => {
    // Arrange
    const updateReturning = vi.fn().mockResolvedValue([{ id: "job-1", status: "cancelling" }]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    (db as any).update = vi.fn(() => ({ set: updateSet }));

    // Act
    const result = await cancelImportJob("job-1");

    // Assert
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelling",
      })
    );
    expect(result.job).toBeDefined();
  });

  it("should return error if job not found", async () => {
    // Arrange
    const updateReturning = vi.fn().mockResolvedValue([]); // Empty array = not found
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    (db as any).update = vi.fn(() => ({ set: updateSet }));

    // Act
    const result = await cancelImportJob("non-existent");

    // Assert
    expect(result.error).toBe("Job not found");
  });
});

describe("import.ts - retryImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user-1", isAdmin: true },
    });
    fsMock.access = vi.fn().mockResolvedValue(undefined);
  });

  it("should require admin authorization", async () => {
    // Arrange
    authMock.mockResolvedValueOnce(null);

    // Act
    const result = await retryImportJob("job-1");

    // Assert
    expect(result.error).toBe("Unauthorized");
  });

  it("should return error if job not found", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]), // Empty array
      })),
    }));

    // Act
    const result = await retryImportJob("non-existent");

    // Assert
    expect(result.error).toBe("Job not found");
  });

  it("should return error if original file no longer exists", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            filePath: "/tmp/missing.xml",
            options: { dryRun: false },
          },
        ]),
      })),
    }));

    fsMock.access = vi.fn().mockRejectedValue(new Error("File not found"));

    // Act
    const result = await retryImportJob("job-1");

    // Assert
    expect(result.error).toBe("Original file no longer available. Please upload the file again.");
  });

  it("should reset job status to queued", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            filePath: "/tmp/test.xml",
            options: { dryRun: false },
          },
        ]),
      })),
    }));

    const updateWhere = vi.fn().mockResolvedValue([{ id: "job-1" }]);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    (db as any).update = vi.fn(() => ({ set: updateSet }));

    (db as any).delete = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));

    // Act
    await retryImportJob("job-1");

    // Assert
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
        startedAt: null,
        finishedAt: null,
      })
    );
  });
});

describe("import.ts - deleteImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      user: { id: "user-1", isAdmin: true },
    });
    fsMock.unlink = vi.fn().mockResolvedValue(undefined);
  });

  it("should require admin authorization", async () => {
    // Arrange
    authMock.mockResolvedValueOnce(null);

    // Act
    const result = await deleteImportJob("job-1");

    // Assert
    expect(result.error).toBe("Unauthorized");
  });

  it("should return error if job not found", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    }));

    // Act
    const result = await deleteImportJob("non-existent");

    // Assert
    expect(result.error).toBe("Job not found");
  });

  it("should clean up temporary file", async () => {
    // Arrange
    const filePath = "/tmp/narravo-imports/test.xml";
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            filePath,
            fileName: "test.xml",
          },
        ]),
      })),
    }));

    (db as any).delete = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));

    // Act
    await deleteImportJob("job-1");

    // Assert
    expect(fsMock.unlink).toHaveBeenCalledWith(filePath);
  });

  it("should delete job record from database", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            filePath: "/tmp/test.xml",
          },
        ]),
      })),
    }));

    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const deleteMock = vi.fn(() => ({ where: deleteWhere }));
    (db as any).delete = deleteMock;

    // Act
    await deleteImportJob("job-1");

    // Assert
    expect(deleteMock).toHaveBeenCalled();
    expect(deleteWhere).toHaveBeenCalled();
  });

  it("should handle file cleanup errors gracefully", async () => {
    // Arrange
    (db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            filePath: "/tmp/test.xml",
          },
        ]),
      })),
    }));

    (db as any).delete = vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));

    fsMock.unlink = vi.fn().mockRejectedValue(new Error("File not found"));

    // Act
    const result = await deleteImportJob("job-1");

    // Assert - Should still succeed even if file cleanup fails
    expect(result.error).toBeUndefined();
    expect(result.job).toBeDefined();
  });
});
