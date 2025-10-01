// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  
  return NextResponse.json({
    authenticated: !!session?.user,
    user: session?.user ? {
      email: session.user.email,
      twoFactorEnabled: (session.user as any).twoFactorEnabled,
      mfaPending: (session.user as any).mfaPending,
      mfa: (session.user as any).mfa,
    } : null,
  });
}
