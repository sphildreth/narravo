import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const logger = { info: vi.fn(), error: vi.fn() };
vi.mock("@/lib/logger", () => ({ default: logger }));

describe("scripts/add-spdx", () => {
  let tmpDir: string;
  
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "spdx-test-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("adds SPDX headers while preserving directives", async () => {
    const tsFile = path.join(tmpDir, "component.ts");
    const existingFile = path.join(tmpDir, "existing.ts");
    const pyFile = path.join(tmpDir, "script.py");

    await fs.writeFile(tsFile, "'use client';\n\nconsole.log('hello');\n", "utf8");
    await fs.writeFile(existingFile, "// SPDX-License-Identifier: Apache-2.0\nconsole.log('existing');\n", "utf8");
    await fs.writeFile(pyFile, "#!/usr/bin/env python3\n# coding: utf-8\nprint('hi')\n", "utf8");

    const { addSpdxHeaders } = await import("@/scripts/add-spdx");
    const result = await addSpdxHeaders(tmpDir);

    const tsContent = await fs.readFile(tsFile, "utf8");
    expect(tsContent.startsWith("'use client';\n// SPDX-License-Identifier: Apache-2.0\n")).toBe(true);

    const existingContent = await fs.readFile(existingFile, "utf8");
    expect(existingContent).toBe("// SPDX-License-Identifier: Apache-2.0\nconsole.log('existing');\n");

    const pyContent = await fs.readFile(pyFile, "utf8");
    expect(pyContent.split("\n").slice(0, 3)).toEqual([
      "#!/usr/bin/env python3",
      "# coding: utf-8",
      "# SPDX-License-Identifier: Apache-2.0",
    ]);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info.mock.calls[0]?.[0]).toMatch(/added header/);
    expect(result).toEqual({ scanned: 3, changed: 2 });
  });
});
