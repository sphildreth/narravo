// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState, useCallback } from "react";
import ArticleCard, { type ArticleCardPost } from "./ArticleCard";
import logger from '@/lib/logger';

type LoadMoreProps = {
  initialPosts: ArticleCardPost[];
  initialCursor: { publishedAt: string; id: string } | null;
  limit?: number;
};

type ApiResponse = {
  items: ArticleCardPost[];
  nextCursor: { publishedAt: string; id: string } | null;
  error?: { code: string; message: string };
};

export default function LoadMore({ 
  initialPosts, 
  initialCursor, 
  limit = 10 
}: LoadMoreProps) {
  const [posts, setPosts] = useState<ArticleCardPost[]>(initialPosts);
  const [cursor, setCursor] = useState<{ publishedAt: string; id: string } | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        'cursor.publishedAt': cursor.publishedAt,
        'cursor.id': cursor.id,
      });

      const response = await fetch(`/api/posts/list?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load posts: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      setPosts(prevPosts => [...prevPosts, ...data.items]);
      setCursor(data.nextCursor);

      // Announce to screen readers
      const newCount = data.items.length;
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = `Loaded ${newCount} more posts`;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (err) {
      logger.error('Error loading more posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more posts');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, limit]);

  return (
    <div className="grid gap-6">
      {posts.map((post) => (
        <ArticleCard key={post.id} post={post} />
      ))}
      
      {cursor && (
        <div className="text-center py-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-border rounded-lg bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={loading ? "Loading more posts..." : "Load more posts"}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-fg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </>
            ) : (
              "Load More Posts"
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="text-center py-4">
          <p className="text-red-600 mb-2">{error}</p>
          <button
            onClick={loadMore}
            className="text-primary hover:underline"
          >
            Try Again
          </button>
        </div>
      )}

      {!cursor && !loading && (
        <div className="text-center py-6 text-muted">
          <p>No more posts to load</p>
        </div>
      )}
    </div>
  );
}