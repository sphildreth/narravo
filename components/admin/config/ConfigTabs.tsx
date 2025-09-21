"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import { ConfigCard } from "./ConfigCard";
import type { ConfigItem } from "./types";

const CATEGORIES = ["Site", "Appearance", "Security", "Posts", "Advanced"] as const;

function getCategory(key: string): string {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes("site")) return "Site";
  if (lowerKey.includes("theme") || lowerKey.includes("logo")) return "Appearance";
  if (lowerKey.includes("auth") || lowerKey.includes("rate")) return "Security";
  if (lowerKey.includes("post") || lowerKey.includes("comment")) return "Posts";
  return "Advanced";
}

export function ConfigTabs({ items, onUpdate, onDelete }: { items: ConfigItem[], onUpdate: (item: ConfigItem) => void, onDelete: (key: string) => void }) {
  const [activeTab, setActiveTab] = React.useState<string>(CATEGORIES[0]);

  const categorizedItems = React.useMemo(() => {
    const result: Record<string, ConfigItem[]> = {};
    for (const item of items) {
      const category = getCategory(item.key);
      if (!result[category]) {
        result[category] = [];
      }
      result[category].push(item);
    }
    return result;
  }, [items]);

  return (
    <div>
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveTab(category)}
              className={`${
                activeTab === category
                  ? 'border-brand text-brand'
                  : 'border-transparent text-muted hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              {category}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {categorizedItems[activeTab] && categorizedItems[activeTab].length > 0 ? (
          <div className="grid gap-4">
            {categorizedItems[activeTab]!.map((item) => (
              <ConfigCard key={item.key} item={item} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <p>No settings in this category.</p>
        )}
      </div>
    </div>
  );
}
