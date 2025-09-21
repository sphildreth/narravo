"use client";
// SPDX-License-Identifier: Apache-2.0
import * as React from "react";
import type { ConfigItem } from "./types";
import { ConfigTabs } from "./ConfigTabs";
import { Modal } from "./Modal";
import { CreateConfigForm } from "./CreateConfigForm";

export default function ConfigManager({ initialItems }: { initialItems: ConfigItem[] }) {
  const [items, setItems] = React.useState<ConfigItem[]>(initialItems);
  const [isCreateModalOpen, setCreateModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleCreate = (newItem: ConfigItem) => {
    setItems((prev) => [...prev, newItem]);
    setCreateModalOpen(false);
  };

  const handleUpdate = (updatedItem: ConfigItem) => {
    setItems((prev) => prev.map((item) => (item.key === updatedItem.key ? updatedItem : item)));
  };

  const handleDelete = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const filteredItems = items.filter((item) =>
    item.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <input
          type="text"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm w-64"
        />
        <button
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center h-9 rounded-lg border border-transparent bg-brand px-4 text-sm font-semibold text-brand-contrast"
        >
          Create New
        </button>
      </div>

      {isCreateModalOpen && (
        <Modal onClose={() => setCreateModalOpen(false)}>
          <CreateConfigForm onCreate={handleCreate} />
        </Modal>
      )}

      <ConfigTabs items={filteredItems} onUpdate={handleUpdate} onDelete={handleDelete} />
    </div>
  );
}

