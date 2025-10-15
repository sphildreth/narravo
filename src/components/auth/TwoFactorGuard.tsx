// SPDX-License-Identifier: Apache-2.0
"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Client-side guard that redirects to 2FA verification if needed
 * This is necessary because NextAuth v5 uses encrypted JWE tokens
 * that cannot be decrypted in Edge Runtime middleware
 */
export function TwoFactorGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    console.log("[2FA GUARD] Effect triggered:", {
      pathname,
      status,
      hasSession: !!session,
      mfaPending: session?.mfaPending,
      mfa: session?.mfa,
    });

    // Skip check if loading or not authenticated
    if (status === "loading" || status === "unauthenticated") {
      console.log("[2FA GUARD] Skipping - status is loading or unauthenticated");
      return;
    }

    // Skip if no session (belt and suspenders)
    if (!session) {
      console.log("[2FA GUARD] Skipping - no session object");
      return;
    }

    // Skip if already on 2FA page
    if (pathname === "/login/2fa") {
      console.log("[2FA GUARD] Skipping - already on 2FA page");
      return;
    }

    // Skip for auth-related pages
    if (pathname.startsWith("/login") || pathname.startsWith("/api")) {
      console.log("[2FA GUARD] Skipping - auth/api page");
      return;
    }

    console.log("[2FA GUARD] Checking if redirect needed:", {
      pathname,
      status,
      mfaPending: session?.mfaPending,
      mfa: session?.mfa,
    });

    // Check if 2FA is required
    if (session?.mfaPending === true) {
      console.log("[2FA GUARD] Redirecting to /login/2fa");
      router.push("/login/2fa");
    }
  }, [session, status, pathname, router]);

  return <>{children}</>;
}
