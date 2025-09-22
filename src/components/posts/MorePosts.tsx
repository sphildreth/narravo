"use client";
// SPDX-License-Identifier: Apache-2.0
import { useState, useTransition } from "react";
import { fetchMorePosts } from "./actions";
import PostCard from "./PostCard";
export default function MorePosts({ initialCursor, pageSize = 10 }: { initialCursor: any, pageSize?: number }) {
  const [cursor, setCursor] = useState(initialCursor);
  const [items, setItems] = useState<any[]>([]);
  const [pending, start] = useTransition();
  if (!cursor) return null;
  const onClick = () => {
    start(async () => {
      const res = await fetchMorePosts({ cursor, limit: pageSize });
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    });
  };
  return (
    <div className="flex flex-col items-center gap-3">
      {items.map((p:any) => <PostCard key={p.id} post={p} />)}
      {cursor && (
        <button className="text-sm text-brand" onClick={onClick} disabled={pending}>
          {pending ? "Loading…" : "Load more posts"}
        </button>
      )}
    </div>
  );
}
