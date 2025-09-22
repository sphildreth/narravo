// SPDX-License-Identifier: Apache-2.0
"use client";

import { useEffect } from "react";
import { nanoid } from "nanoid";

interface ViewTrackerProps {
  postId: string;
  sessionWindowMinutes?: number;
}

interface SessionData {
  id: string;
  expiresAt: number;
}

const SESSION_KEY = "va:session";

function getOrCreateSession(windowMinutes: number = 30): string {
  if (typeof window === "undefined") return nanoid();

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    const now = Date.now();

    if (stored) {
      const session: SessionData = JSON.parse(stored);
      if (now < session.expiresAt) {
        return session.id;
      }
    }

    // Create new session
    const newSession: SessionData = {
      id: nanoid(),
      expiresAt: now + windowMinutes * 60 * 1000,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession.id;
  } catch {
    // If localStorage is unavailable, return ephemeral session
    return nanoid();
  }
}

function trackView(postId: string, sessionId: string) {
  const payload = JSON.stringify({ postId, sessionId });

  // Try sendBeacon first (preferred for page unload scenarios)
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    const success = navigator.sendBeacon("/api/metrics/view", blob);
    
    if (success) {
      return;
    }
  }

  // Fallback to fetch
  fetch("/api/metrics/view", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Silently fail - don't impact user experience
  });
}

export function ViewTracker({ postId, sessionWindowMinutes = 30 }: ViewTrackerProps) {
  useEffect(() => {
    // Don't track in development if in Next.js preview mode
    if (process.env.NODE_ENV === "development" && window.location.search.includes("preview")) {
      return;
    }

  // Get or create session using configured window
  const sessionId = getOrCreateSession(sessionWindowMinutes);

    // Track the view
    trackView(postId, sessionId);
  }, [postId, sessionWindowMinutes]);

  // This component renders nothing
  return null;
}