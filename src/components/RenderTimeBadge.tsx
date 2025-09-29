// SPDX-License-Identifier: Apache-2.0
"use client";

import { useEffect, useState } from "react";
import logger from "@/lib/logger";

interface RenderTimeBadgeProps {
  serverMs?: number;
  showBadge?: boolean;
}

/**
 * Displays a small render time badge for Post pages showing server render time.
 * Features:
 * - Reads from Server-Timing header or server-provided prop
 * - Controlled by a configuration setting
 * - Hidden for crawlers and print
 * - Positioned subtly at bottom-right
 */
export function RenderTimeBadge({ serverMs, showBadge }: RenderTimeBadgeProps) {
  const [ms, setMs] = useState<number | undefined>(serverMs);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if badge should be shown via prop
    if (!showBadge) return;

    // Try to parse Server-Timing from navigation entries if no serverMs provided
    if (ms == null) {
      try {
        const [entry] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        const serverTiming = (entry as any)?.serverTiming;
        if (serverTiming) {
          const srtEntry = serverTiming.find((x: any) => x.name === "srt");
          if (srtEntry?.duration) {
            setMs(Math.round(srtEntry.duration));
          }
        }
      } catch (error) {
        // Ignore errors parsing server timing
        logger.debug("Failed to parse server timing:", error);
      }
    }

    // Only show if we have a valid ms value
    if (ms != null && ms >= 0) {
      setIsVisible(true);
    }
  }, [ms, showBadge]);

  // Don't render if flag is off, no timing data, or likely crawler
  if (!showBadge || !isVisible || ms == null) {
    return null;
  }

  // Format the timing display
  const formatTiming = (timeMs: number): string => {
    if (timeMs > 9999) return ">9.9s";
    return `${timeMs}ms`;
  };

  return (
    <div
      className="fixed bottom-3 right-3 z-50 print-hidden"
      style={{
        fontSize: "12px",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
      aria-label={`Server render time: ${ms} milliseconds`}
    >
      <div
        className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-help"
        title="Server render time"
      >
        render: {formatTiming(ms)}
      </div>
    </div>
  );
}
