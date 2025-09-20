import "dotenv/config";
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import slugify from "slugify";
import { randomUUID } from "crypto";

import { posts, users, comments } from "../drizzle/schema";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildPosts() {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const now = new Date();
  const monthsToGenerate = 12;
  const items: typeof posts.$inferInsert[] = [];

  const postKinds = [
    "Monthly Roundup",
    "Product Update",
    "Engineering Deep Dive",
    "How-To Guide",
    "Case Study",
    "Interview",
    "Opinion",
    "Release Notes",
  ] as const;

  for (let m = 0; m < monthsToGenerate; m++) {
    const baseDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1, 12, 0, 0));
    const monthName = monthNames[baseDate.getUTCMonth()];
    const year = baseDate.getUTCFullYear();

    const postsThisMonth = 3 + Math.floor(Math.random() * 5); // 3..7

    for (let i = 0; i < postsThisMonth; i++) {
      const kind = pick([...postKinds]);
      const day = Math.min(2 + i * 4 + Math.floor(Math.random() * 3), 27);
      const publishedAt = new Date(Date.UTC(year, baseDate.getUTCMonth(), day, 12 + (i % 5), 15, 0));

      const title = `Narravo ${kind}: ${monthName} ${year}${kind === "Interview" ? " with a creator" : ""}`;
      const slug = slugify(`${title}-${m}-${i}`, { lower: true, strict: true });

      const excerptParts = {
        "Monthly Roundup": `Highlights from ${monthName} ${year} — shipped features, community stories, and experiments.`,
        "Product Update": `What changed in Narravo this ${monthName}: UX polish, performance, and a few surprises.`,
        "Engineering Deep Dive": `Under the hood: decisions, tradeoffs, and benchmarks from a recent change.`,
        "How-To Guide": `Step-by-step walkthrough to get more out of Narravo in ${monthName} ${year}.`,
        "Case Study": `A real team using Narravo: goals, setup, results, and lessons learned.`,
        "Interview": `A conversation with a builder using Narravo in the wild.`,
        "Opinion": `An editorial take on the state of collaborative creation and where it's headed.`,
        "Release Notes": `Bug fixes, quality-of-life updates, and smaller enhancements shipped this cycle.`,
      } as const;

      const sections = [
        `<h2>${kind} — ${monthName} ${year}</h2>`,
        `<p>${excerptParts[kind]}</p>`,
        `<blockquote>“We build for clarity first. Everything else compounds from there.”</blockquote>`,
        `<ul>
<li>What shipped</li>
<li>What we learned</li>
<li>What comes next</li>
</ul>`,
        `<pre><code>curl -X POST https://api.narravo.dev/v1/ingest \
  -H "Authorization: Bearer &lt;token&gt;" \
  -d '{"event":"example"}'
</code></pre>`,
        `<p><em>PS:</em> If you have feedback, reply to this post — we read every comment.</p>`,
      ];

      const html = sections.slice(0, 3 + Math.floor(Math.random() * sections.length)).join("\n");

      items.push({
        slug,
        title,
        excerpt: excerptParts[kind],
        html,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      });
    }
  }

  return items;
}

function buildUsers() {
  const people: typeof users.$inferInsert[] = [
    { email: "ava@narravo.dev", name: "Ava Chen", image: "https://i.pravatar.cc/100?img=1" },
    { email: "leo@narravo.dev", name: "Leo Martins", image: "https://i.pravatar.cc/100?img=2" },
    { email: "maya@narravo.dev", name: "Maya Patel", image: "https://i.pravatar.cc/100?img=3" },
    { email: "sam@narravo.dev", name: "Sam Rodriguez", image: "https://i.pravatar.cc/100?img=4" },
    { email: "noa@narravo.dev", name: "Noa Friedman", image: "https://i.pravatar.cc/100?img=5" },
  ];
  return people;
}

type PostRow = { id: string; slug: string; publishedAt: Date | null };

function randomStatus() {
  const roll = Math.random();
  if (roll < 0.75) return "approved"; // majority approved
  if (roll < 0.9) return "pending";
  return "hidden"; // a few hidden/moderated
}

function buildCommentsForPost(post: PostRow, userIds: string[]) {
  const commentsData: typeof comments.$inferInsert[] = [];
  const rootCount = Math.floor(Math.random() * 4); // 0..3 root comments

  for (let r = 0; r < rootCount; r++) {
    const rootId = randomUUID();
    const createdAt = post.publishedAt
      ? new Date(post.publishedAt.getTime() + (r + 1) * 60 * 60 * 1000)
      : new Date();

    commentsData.push({
      id: rootId,
      postId: post.id,
      userId: pick(userIds),
      parentId: null as any, // will be stored as null
      path: rootId,
      depth: 0,
      bodyHtml: `<p>${pick([
        "Love this update — the benchmarks are impressive!",
        "Curious about the tradeoffs you mentioned around caching.",
        "The step-by-step guide is clear and actionable, thanks!",
        "This solved a problem we had last week. Great timing.",
      ])}</p>`,
      bodyMd: pick([
        "Love this update — the benchmarks are impressive!",
        "Curious about the tradeoffs you mentioned around caching.",
        "The step-by-step guide is clear and actionable, thanks!",
        "This solved a problem we had last week. Great timing.",
      ]),
      status: randomStatus(),
      createdAt,
    });

    // replies level 1
    const replies = Math.floor(Math.random() * 3); // 0..2
    for (let a = 0; a < replies; a++) {
      const reply1Id = randomUUID();
      const createdAt1 = new Date(createdAt.getTime() + (a + 1) * 30 * 60 * 1000);
      const path1 = `${rootId}/${reply1Id}`;
      commentsData.push({
        id: reply1Id,
        postId: post.id,
        userId: pick(userIds),
        parentId: rootId,
        path: path1,
        depth: 1,
        bodyHtml: `<p>${pick([
          "Agreed — would love to see more details on the rollout plan.",
          "Replying to this: we hit similar perf issues and landed on a comparable approach.",
          "Could the API support partial updates here?",
        ])}</p>`,
        bodyMd: pick([
          "Agreed — would love to see more details on the rollout plan.",
          "Replying to this: we hit similar perf issues and landed on a comparable approach.",
          "Could the API support partial updates here?",
        ]),
        status: randomStatus(),
        createdAt: createdAt1,
      });

      // replies level 2
      const replies2 = Math.random() < 0.5 ? 1 : 0; // sometimes a deep thread
      for (let b = 0; b < replies2; b++) {
        const reply2Id = randomUUID();
        const createdAt2 = new Date(createdAt1.getTime() + (b + 1) * 15 * 60 * 1000);
        const path2 = `${rootId}/${reply1Id}/${reply2Id}`;
        commentsData.push({
          id: reply2Id,
          postId: post.id,
          userId: pick(userIds),
          parentId: reply1Id,
          path: path2,
          depth: 2,
          bodyHtml: `<p>${pick([
            "+1 to partial updates — would simplify our client a lot.",
            "We prototyped this and saw ~20% latency savings.",
            "This is where optimistic UI gets interesting.",
          ])}</p>`,
          bodyMd: pick([
            "+1 to partial updates — would simplify our client a lot.",
            "We prototyped this and saw ~20% latency savings.",
            "This is where optimistic UI gets interesting.",
          ]),
          status: randomStatus(),
          createdAt: createdAt2,
        });
      }
    }
  }

  return commentsData;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the seed script");
  }

  const client = new Client({ connectionString });
  await client.connect();
  const db = drizzle(client);

  try {
    // Users
    const userData = buildUsers();
    const userRows = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: { name: sql`excluded.name`, image: sql`excluded.image` },
      })
      .returning({ id: users.id, email: users.email! });

    const userIds = userRows.map((u) => u.id);

    // Posts
    const postsData = buildPosts();
    const insertedPosts = await db
      .insert(posts)
      .values(postsData)
      .onConflictDoUpdate({
        target: posts.slug,
        set: {
          title: sql`excluded.title`,
          html: sql`excluded.html`,
          excerpt: sql`excluded.excerpt`,
          publishedAt: sql`excluded.published_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: posts.id, slug: posts.slug, publishedAt: posts.publishedAt });

    console.log(`Upserted ${insertedPosts.length} posts (total staged: ${postsData.length}).`);

    // Comments
    const allComments = insertedPosts.flatMap((p) => buildCommentsForPost(p, userIds));
    if (allComments.length) {
      // Insert in chunks to avoid very large queries
      const chunkSize = 200;
      for (let i = 0; i < allComments.length; i += chunkSize) {
        const chunk = allComments.slice(i, i + chunkSize);
        await db.insert(comments).values(chunk);
      }
      console.log(`Inserted ${allComments.length} comments across ${insertedPosts.length} posts.`);
    } else {
      console.log("No comments generated for this run.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
