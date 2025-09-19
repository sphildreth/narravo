import "dotenv/config";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import slugify from "slugify";

import { posts } from "../drizzle/schema";

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
  const monthsToGenerate = 11;
  const postsPerMonth = 5;
  const items: typeof posts.$inferInsert[] = [];

  for (let m = 0; m < monthsToGenerate; m++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1, 12, 0, 0));
    const monthName = monthNames[date.getUTCMonth()];
    const year = date.getUTCFullYear();

    for (let i = 0; i < postsPerMonth; i++) {
      const index = m * postsPerMonth + i + 1;
      const day = Math.min(2 + i * 5, 25);
      const publishedAt = new Date(Date.UTC(year, date.getUTCMonth(), day, 14, 30, 0));
      const title = `Narravo Monthly Roundup ${monthName} ${year} — Story ${i + 1}`;
      const slug = slugify(`${title}-${index}`, { lower: true, strict: true });
      const excerpt = `Highlights from the ${monthName} ${year} round of Narravo experiments (#${i + 1}).`;
      const html = [
        `<h2>What moved the needle in ${monthName} ${year}</h2>`,
        `<p>Story ${i + 1} captures community updates, product learnings, and a few editorial gems from Narravo.</p>`,
        `<p>We look back at what shipped, what resonated, and where we are headed next.</p>`,
      ].join("\n");

      items.push({
        slug,
        title,
        excerpt,
        html,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
      });
    }
  }

  return items;
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
    const postsData = buildPosts();
    const inserted = await db
      .insert(posts)
      .values(postsData)
      .onConflictDoNothing({ target: posts.slug })
      .returning({ id: posts.id });

    console.log(`Seeded ${inserted.length} posts (total staged: ${postsData.length}).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
