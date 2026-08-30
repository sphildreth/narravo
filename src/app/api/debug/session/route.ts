// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return NextResponse.json({
    authenticated: true,
    user: session.user ? {
      email: session.user.email,
      twoFactorEnabled: (session.user as any).twoFactorEnabled,
      mfaPending: (session.user as any).mfaPending,
      mfa: (session.user as any).mfa,
    } : null,
  });
}
