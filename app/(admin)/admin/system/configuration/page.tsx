import { db } from "@/lib/db";
import { configuration } from "@/drizzle/schema";
import { asc, isNull } from "drizzle-orm";
import ConfigManager from "@/components/admin/config/ConfigManager";

export default async function ConfigurationPage() {
  const rows = await db
    .select({ key: configuration.key, type: configuration.type, value: configuration.value, allowedValues: configuration.allowedValues, required: configuration.required })
    .from(configuration)
    .where(isNull(configuration.userId))
    .orderBy(asc(configuration.key));

  // Dedupe keys in case of duplicates (shouldn't happen with unique index)
  const seen = new Set<string>();
  const items = rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Configuration</h1>
      <p className="opacity-70">Manage typed configuration. Create new keys, edit values, and invalidate cache.</p>
      <ConfigManager initialItems={items as any} />
    </div>
  );
}

