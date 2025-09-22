"use client";
// SPDX-License-Identifier: Apache-2.0
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export type ArchiveMonth = {
  key: string; // YYYY-MM
  label: string;
  count: number;
};

export default function ArchiveList({ months }: { months: ArchiveMonth[] }) {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  return (
    <div className="space-y-1.5">
      <button
        className="flex items-center justify-between w-full text-sm font-semibold uppercase tracking-wide text-muted md:hidden"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <span>Archives</span>
        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      <ul className={`space-y-1.5 ${isCollapsed ? "hidden md:block" : "block"}`}>
        {months.map((m) => {
          const [year, month] = m.key.split("-");
          const archiveUrl = `/archives/${year}/${month}`;
          return (
            <li key={m.key} className="flex items-center justify-between text-sm">
              <Link href={archiveUrl} className="hover:underline text-fg">
                {m.label}
              </Link>
              <span className="text-muted">{m.count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

