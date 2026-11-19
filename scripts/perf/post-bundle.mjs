// SPDX-License-Identifier: Apache-2.0
import { gzipSync } from "node:zlib";
import { load } from "cheerio";

const base = new URL(process.env.PERF_BASE_URL ?? "http://localhost:3000");
async function scripts(route, expectedStatus) {
  const response = await fetch(new URL(route, base));
  if (response.status !== expectedStatus) throw new Error(`${route} returned ${response.status}`);
  const $ = load(await response.text());
  return new Set($("script[src]").toArray()
    .map(element => new URL($(element).attr("src"), base))
    .filter(url => url.origin === base.origin && url.pathname.startsWith("/_next/static/"))
    .map(url => url.href));
}

// The generic 404 also loads the root layout, React and the framework runtime.
const shared = await scripts("/__narravo_missing_perf_fixture__", 404);
const post = await scripts("/sample-post", 200);
if (!post.size || !shared.size) throw new Error("No application scripts found");
let total = 0;
let specific = 0;
for (const url of post) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read script ${new URL(url).pathname}`);
  const size = gzipSync(new Uint8Array(await response.arrayBuffer())).length;
  total += size;
  if (!shared.has(url)) specific += size;
}
console.log(`Initial post JavaScript (gzip): ${specific} post-specific bytes, ${total} total bytes`);
if (specific > 90 * 1024) throw new Error("The post-specific JavaScript budget is 90 KiB gzipped");
