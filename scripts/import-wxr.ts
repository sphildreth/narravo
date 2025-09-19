import { parseStringPromise } from "xml2js";
import { db } from "../lib/db";
import { posts } from "../drizzle/schema";
import slugify from "slugify";
import fs from "node:fs/promises";

async function run() {
  const pathArg = process.argv.find(a => a.startsWith("path="))?.split("=")[1];
  if (!pathArg) throw new Error("Usage: pnpm wxr:import path=./export.xml");
  const xml = await fs.readFile(pathArg, "utf-8");
  const doc = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
  const items = doc.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];
  let count = 0;
  for (const it of arr) {
    const title = it.title ?? "Untitled";
    const slug = slugify(title, { lower: true, strict: true }) || `post-${Date.now()}`;
    const html = `<p>Imported from WXR: ${title}</p>`;
    await db.insert(posts).values({ slug, title, html }).onConflictDoNothing();
    count++;
  }
  console.log(`Imported ${count} items (stub).`);
}
run().catch(e => { console.error(e); process.exit(1); });
