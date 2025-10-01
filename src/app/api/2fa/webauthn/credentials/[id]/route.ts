// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { db } from "@/lib/db";
import { ownerWebAuthnCredential } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logSecurityActivity } from "@/lib/2fa/security-activity";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin2FA();
    const { id } = await params;
    const credentialId = id;

    // Delete the credential (only if it belongs to this user)
    const result = await db
      .delete(ownerWebAuthnCredential)
      .where(
        and(
          eq(ownerWebAuthnCredential.id, credentialId),
          eq(ownerWebAuthnCredential.userId, session.user!.id)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // Log the deletion
    await logSecurityActivity(session.user!.id, "passkey_removed", {
      credentialId: result[0]!.credentialId,
      nickname: result[0]!.nickname,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting WebAuthn credential:", error);
    return NextResponse.json(
      { error: "Failed to delete credential" },
      { status: 500 }
    );
  }
}
