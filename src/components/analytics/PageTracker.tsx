// SPDX-License-Identifier: Apache-2.0
"use client";

import { useEffect } from "react";
import { nanoid } from "nanoid";

interface PageTrackerProps {
  path: string;
  sessionWindowMinutes?: number;
}

interface SessionData {
  id: string;
  createdAt: number;
}

const SESSION_KEY = "va:session";

function getOrCreateSession(windowMinutes: number = 30): string {
  if (typeof window === "undefined") return "";

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const session: SessionData = JSON.parse(stored);
      const age = Date.now() - session.createdAt;
      const maxAge = windowMinutes * 60 * 1000;
      
      if (age < maxAge) {
        return session.id;
      }
    }
  } catch {
    // Ignore parsing errors
  }

  // Create new session
  const newSession: SessionData = {
    id: nanoid(32),
    createdAt: Date.now(),
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  } catch {
    // Ignore storage errors (private browsing, etc.)
  }

  return newSession.id;
}

function trackPageView(path: string, sessionId: string) {
  const payload = JSON.stringify({ 
    type: "page",
    path, 
    sessionId 
  });

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

export function PageTracker({ path, sessionWindowMinutes = 30 }: PageTrackerProps) {
  useEffect(() => {
    // Don't track in development if in Next.js preview mode
    if (process.env.NODE_ENV === "development" && window.location.search.includes("preview")) {
      return;
    }

    // Get or create session using configured window
    const sessionId = getOrCreateSession(sessionWindowMinutes);

    // Track the page view
    trackPageView(path, sessionId);
  }, [path, sessionWindowMinutes]);

  // This component renders nothing
  return null;
}