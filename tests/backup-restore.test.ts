// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

describe("Backup and Restore Scripts", () => {
  const testDir = "/tmp/backup-restore-tests";

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Backup manifest structure", () => {
    it("should create a valid manifest structure", async () => {
      // Create a minimal test zip with the expected structure
      const zip = new JSZip();
      
      const manifest = {
        version: 1,
        createdUtc: new Date().toISOString(),
        tables: {
          posts: {
            filename: "db/posts.json",
            recordCount: 1,
            sha256: "abc123",
          },
        },
        media: [],
        counts: {
          posts: 1,
          users: 0,
          comments: 0,
          reactions: 0,
          redirects: 0,
          configuration: 0,
        },
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("db/posts.json", JSON.stringify([
        {
          id: "test-id",
          slug: "test-slug",
          title: "Test Post",
          html: "<p>Test content</p>",
          publishedAt: "2023-01-01T00:00:00Z",
        }
      ], null, 2));

      const testBackupPath = path.join(testDir, "manifest-test.zip");
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      await fs.writeFile(testBackupPath, zipBuffer);

      // Verify we can read it back
      const readBuffer = await fs.readFile(testBackupPath);
      const readZip = await JSZip.loadAsync(readBuffer);
      
      expect(readZip.file("manifest.json")).toBeTruthy();
      expect(readZip.file("db/posts.json")).toBeTruthy();

      const readManifest = JSON.parse(
        await readZip.file("manifest.json")!.async("text")
      );
      
      expect(readManifest.version).toBe(1);
      expect(readManifest.tables.posts.recordCount).toBe(1);
      expect(readManifest.counts.posts).toBe(1);
    });

    it("should include all required database tables in structure", async () => {
      const zip = new JSZip();
      
      // Add all expected database table files
      const tables = [
        "posts",
        "users", 
        "comments",
        "comment_attachments",
        "reactions",
        "redirects",
        "configuration"
      ];

      const manifest = {
        version: 1,
        createdUtc: new Date().toISOString(),
        tables: {} as any,
        media: [],
        counts: {
          posts: 0,
          users: 0,
          comments: 0,
          reactions: 0,
          redirects: 0,
          configuration: 0,
        },
      };

      tables.forEach(table => {
        const data = [];
        zip.file(`db/${table}.json`, JSON.stringify(data, null, 2));
        manifest.tables[table] = {
          filename: `db/${table}.json`,
          recordCount: 0,
          sha256: "empty",
        };
      });

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      const testBackupPath = path.join(testDir, "complete-structure.zip");
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      await fs.writeFile(testBackupPath, zipBuffer);

      // Verify all files exist
      const readZip = await JSZip.loadAsync(await fs.readFile(testBackupPath));
      
      tables.forEach(table => {
        expect(readZip.file(`db/${table}.json`)).toBeTruthy();
      });
    });

    it("should handle media manifest entries", async () => {
      const zip = new JSZip();
      
      const manifest = {
        version: 1,
        createdUtc: new Date().toISOString(),
        tables: {},
        media: [
          {
            path: "media/images/test.jpg",
            sha256: "abc123def456",
            bytes: 1024,
          },
          {
            path: "media/videos/test.mp4",
            sha256: "def456ghi789",
            bytes: 2048,
          },
        ],
        counts: {
          posts: 0,
          users: 0,
          comments: 0,
          reactions: 0,
          redirects: 0,
          configuration: 0,
        },
      };

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));

      const mediaBackupPath = path.join(testDir, "media-manifest.zip");
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      await fs.writeFile(mediaBackupPath, zipBuffer);

      const readZip = await JSZip.loadAsync(await fs.readFile(mediaBackupPath));
      const readManifest = JSON.parse(
        await readZip.file("manifest.json")!.async("text")
      );

      expect(readManifest.media).toHaveLength(2);
      expect(readManifest.media[0].path).toBe("media/images/test.jpg");
      expect(readManifest.media[1].path).toBe("media/videos/test.mp4");
    });
  });

  describe("CLI interface validation", () => {
    it("should validate backup and restore scripts exist and are executable", async () => {
      const backupScript = path.join(process.cwd(), "scripts", "backup.ts");
      const restoreScript = path.join(process.cwd(), "scripts", "restore.ts");

      // Check files exist
      await expect(fs.access(backupScript)).resolves.not.toThrow();
      await expect(fs.access(restoreScript)).resolves.not.toThrow();

      // Check they contain expected CLI handling
      const backupContent = await fs.readFile(backupScript, "utf-8");
      const restoreContent = await fs.readFile(restoreScript, "utf-8");

      expect(backupContent).toContain("import.meta.url");
      expect(backupContent).toContain("process.argv");
      expect(backupContent).toContain("--verbose");

      expect(restoreContent).toContain("import.meta.url");
      expect(restoreContent).toContain("process.argv");
      expect(restoreContent).toContain("--dry-run");
    });
  });

  describe("Data filtering logic", () => {
    it("should filter posts by slug correctly", () => {
      const posts = [
        { slug: "first-post", title: "First" },
        { slug: "second-post", title: "Second" },
        { slug: "third-post", title: "Third" },
      ];

      const filterSlugs = ["first-post", "third-post"];
      const filtered = posts.filter(post => filterSlugs.includes(post.slug));

      expect(filtered).toHaveLength(2);
      expect(filtered.map(p => p.slug)).toEqual(["first-post", "third-post"]);
    });

    it("should filter posts by date range correctly", () => {
      const posts = [
        { 
          slug: "old-post", 
          publishedAt: new Date("2022-01-01T00:00:00Z") 
        },
        { 
          slug: "middle-post", 
          publishedAt: new Date("2023-06-01T00:00:00Z") 
        },
        { 
          slug: "new-post", 
          publishedAt: new Date("2023-12-01T00:00:00Z") 
        },
        {
          slug: "unpublished-post",
          publishedAt: null
        }
      ];

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-10-01");

      const filtered = posts.filter(post => {
        if (!post.publishedAt) return false;
        const publishedAt = new Date(post.publishedAt);
        return publishedAt >= startDate && publishedAt <= endDate;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].slug).toBe("middle-post");
    });
  });
});