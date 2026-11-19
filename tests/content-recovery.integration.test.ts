// SPDX-License-Identifier: Apache-2.0
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const scope = vi.hoisted(() => ({ db: undefined as any, storage: undefined as any }));
vi.mock("@/lib/db", () => ({ get db() { return scope.db; } }));
vi.mock("@/lib/local-storage", async (load) => ({
  ...await load<typeof import("@/lib/local-storage")>(), get localStorageService() { return scope.storage; },
}));
vi.mock("@/lib/s3", () => ({ getStorageService: () => null, getS3Config: () => null }));

import { LocalStorageService } from "@/lib/local-storage";
import { createBackup } from "../scripts/backup";
import { restoreBackup } from "../scripts/restore";
import { importWxr } from "../scripts/import-wxr";
import { getPostBySlug, listPosts } from "@/lib/posts";
import { countApprovedComments, getCommentTreeForPost, getRecentComments } from "@/lib/comments";
import { searchPosts } from "@/lib/search";

const url = process.env.DATABASE_URL;
type TestPool = InstanceType<typeof Pool>;
const pools: TestPool[] = [];
const databases: string[] = [];
let admin: TestPool;
let dir: string;
beforeAll(async () => {
  if (!url) return;
  dir = await mkdtemp(path.join(os.tmpdir(), "narravo-roundtrip-"));
  admin = new Pool({ connectionString: url });
  for (const suffix of ["source", "target"]) {
    const name = "narravo_test_" + randomUUID().replaceAll("-", "") + "_" + suffix;
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
    const isolated = new URL(url);
    isolated.pathname = "/" + name;
    const pool = new Pool({ connectionString: isolated.href });
    pools.push(pool);
    await migrate(drizzle(pool), { migrationsFolder: "drizzle/migrations" });
  }
});
afterAll(async () => {
  if (!url) return;
  await Promise.all(pools.map(pool => pool.end()));
  for (const name of databases) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
  await rm(dir, { recursive: true, force: true });
});

it.skipIf(!url)("loads recent dashboard comments even when a post or author is missing", async () => {
  const client = await pools[0]!.connect();
  try {
    await client.query("BEGIN");
    scope.db = drizzle(client);
    await client.query(`
      WITH post AS (
        INSERT INTO posts(slug,title,html) VALUES ('dashboard-draft','Draft','Body') RETURNING id
      ), author AS (
        INSERT INTO users(email,name) VALUES ('writer@example.test','Writer') RETURNING id
      )
      INSERT INTO comments(post_id,user_id,path,body_html,created_at)
      SELECT post.id,author.id,'0001','On a draft',now() FROM post,author
      UNION ALL SELECT NULL,NULL,'0002','Without a post',now() + interval '1 second'
    `);
    expect(await getRecentComments(2)).toMatchObject([
      { bodyHtml: "Without a post", postSlug: null, author: { name: null } },
      { bodyHtml: "On a draft", postSlug: "dashboard-draft", author: { name: "Writer" } },
    ]);
    expect(await getRecentComments(1)).toHaveLength(1);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

it.skipIf(!url)("round-trips content, taxonomy, discussions and media through a clean database", async () => {
  const [source, target] = pools as [TestPool, TestPool];
  scope.db = drizzle(source);
  scope.storage = new LocalStorageService(path.join(dir, "source"));
  await source.query(`
    INSERT INTO categories(name,slug) VALUES ('Travel','travel');
    INSERT INTO tags(name,slug) VALUES ('Train','train');
    INSERT INTO posts(slug,title,html,category_id,published_at) SELECT 'trip','Trip','<p>Train</p>',id,now() FROM categories;
    INSERT INTO users(email,name) VALUES ('local@example.test','Reader');
    INSERT INTO comments(post_id,path,body_html) SELECT id,'0001','A reply' FROM posts;
    INSERT INTO comments(post_id,parent_id,path,depth,body_html) SELECT post_id,id,'0001.0001',1,'A nested reply' FROM comments;
    INSERT INTO post_tags SELECT posts.id,tags.id FROM posts,tags;
    INSERT INTO comment_tags SELECT comments.id,tags.id FROM comments,tags;
    INSERT INTO comment_attachments(comment_id,kind,url) SELECT id,'image','/uploads/images/trip.png' FROM comments LIMIT 1;
    INSERT INTO reactions(target_type,target_id,user_id,kind) SELECT 'post',posts.id,users.id,'like' FROM posts,users;
    INSERT INTO redirects(from_path,to_path) VALUES ('/old-trip','/trip');
    INSERT INTO posts(slug,title,html) VALUES ('draft','Draft','Draft');
  `);
  const png = Uint8Array.of(137,80,78,71,13,10,26,10);
  await scope.storage.putObject("images/trip.png", png, "image/png");
  const zip = await createBackup({ outputPath: path.join(dir, "blog.zip") });
  scope.db = drizzle(target);
  scope.storage = new LocalStorageService(path.join(dir, "target"));
  const preview = await restoreBackup({ backupPath: zip, filterSlugs: ["trip"], dryRun: true });
  expect(preview.tables.comments?.toInsert).toBe(2);
  expect((await target.query("select id from posts")).rowCount).toBe(0);
  expect(await scope.storage.exists("images/trip.png")).toBe(false);
  const actual = await restoreBackup({ backupPath: zip, filterSlugs: ["trip"] });
  expect(actual).toEqual(preview);
  expect(Buffer.from(await scope.storage.getObjectBytes("images/trip.png", 100))).toEqual(Buffer.from(png));
  await restoreBackup({ backupPath: zip });
  await restoreBackup({ backupPath: zip });
  for (const table of ["posts", "users", "categories", "tags", "post_tags", "comment_tags", "comments", "comment_attachments", "reactions", "redirects"]) {
    const query = `SELECT * FROM ${table} ORDER BY 1,2`;
    expect((await target.query(query)).rows).toEqual((await source.query(query)).rows);
  }
});

it.skipIf(!url)("requires enrolled accounts to exist before their content can be migrated", async () => {
  const [source, target] = pools as [TestPool, TestPool];
  scope.db = drizzle(source);
  await source.query("INSERT INTO users(email,two_factor_enabled) VALUES ('enrolled@example.test', true)");
  const zip = await createBackup({ outputPath: path.join(dir, "enrolled.zip"), includeMedia: false });
  scope.db = drizzle(target);
  await expect(restoreBackup({ backupPath: zip })).rejects.toThrow("second factor");
  expect((await target.query("SELECT id FROM users WHERE email='enrolled@example.test'")).rowCount).toBe(0);
  await target.query("INSERT INTO users(email,two_factor_enabled) VALUES ('enrolled@example.test', true)");
  await restoreBackup({ backupPath: zip });
  expect((await target.query("SELECT two_factor_enabled FROM users WHERE email='enrolled@example.test'")).rows[0].two_factor_enabled).toBe(true);
});

it.skipIf(!url)("holds scheduled and deleted posts out of public reads", async () => {
  const source = pools[0]!;
  scope.db = drizzle(source);
  await source.query("insert into posts(slug,title,html,published_at) values ('embargo','Embargo','Body',now()+interval '1 day')");
  const { rows: [embargo] } = await source.query("select id from posts where slug='embargo'");
  await source.query("insert into comments(post_id,path,body_html,status) values ($1,'0001','Comment','approved')", [embargo.id]);
  expect(await countApprovedComments(embargo.id)).toBe(0);
  expect((await getCommentTreeForPost(embargo.id)).top).toEqual([]);
  expect(await getPostBySlug("embargo")).toBeNull();
  expect((await listPosts()).items.map(p => p.slug)).not.toContain("embargo");
  await source.query("update posts set published_at=now()-interval '1 second' where slug='embargo'");
  expect(await getPostBySlug("embargo")).toMatchObject({ slug: "embargo" });
  await source.query("update posts set deleted_at=now() where slug='embargo'");
  expect((await searchPosts({ q: "Embargo" })).items).toHaveLength(0);
});

it.skipIf(!url)("keeps the existing blog on replacement failure and imports restricted WordPress posts as drafts", async () => {
  const source = pools[0]!;
  scope.db = drizzle(source);
  const file = path.join(dir, "replace.xml");
  const before = (await source.query("select id from posts order by id")).rows;
  const options = { purgeBeforeImport: true, skipMedia: true, allowedStatuses: ["publish", "private"] };
  const post = (slug: string, status: string, date: string, password = "") => `<item><title>${slug}</title><guid>${slug}</guid><wp:post_type>post</wp:post_type><wp:post_name>${slug}</wp:post_name><wp:status>${status}</wp:status><wp:post_date_gmt>${date}</wp:post_date_gmt><wp:post_password>${password}</wp:post_password></item>`;
  const xml = (items: string) => `<rss xmlns:wp="http://wordpress.org/export/1.2/"><channel>${items}</channel></rss>`;
  for (const invalid of ["<broken", xml(""), xml(post("valid","publish","2024-01-01") + post("bad","publish","invalid"))]) {
    await writeFile(file, invalid);
    expect((await importWxr(file, options)).errors.length).toBeGreaterThan(0);
    expect((await source.query("select id from posts order by id")).rows).toEqual(before);
  }
  await writeFile(file, xml(post("members","private","2024-01-01") + post("protected","publish","2024-01-01","yes") + post("news","publish","2024-01-01")));
  const preview = await importWxr(file, { ...options, dryRun: true });
  expect(preview.restrictedPosts).toEqual(["members", "protected"]);
  const result = await importWxr(file, options);
  expect(result.errors).toEqual([]);
  expect((await listPosts()).items.map(p => p.slug)).toEqual(["news"]);
});
