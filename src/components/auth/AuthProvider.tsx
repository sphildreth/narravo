// SPDX-License-Identifier: Apache-2.0
"use client";

import { SessionProvider } from "next-auth/react";
import { TwoFactorGuard } from "./TwoFactorGuard";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TwoFactorGuard>{children}</TwoFactorGuard>
    </SessionProvider>
  );
}
