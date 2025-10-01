// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin2FA } from "@/lib/auth";
import { getTrustedDevices, revokeTrustedDevice, revokeAllTrustedDevices } from "@/lib/2fa/trusted-device";
import { logSecurityActivity } from "@/lib/2fa/security-activity";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    const devices = await getTrustedDevices(userId);

    return NextResponse.json({
      devices: devices.map((d: any) => ({
        id: d.id,
        userAgent: d.userAgent,
        createdAt: d.createdAt,
        lastSeenAt: d.lastSeenAt,
        expiresAt: d.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching trusted devices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch trusted devices" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin2FA();
    const userId = (session.user as any).id;

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("id");

    if (deviceId) {
      // Revoke specific device
      await revokeTrustedDevice(deviceId);
      await logSecurityActivity(userId, "trusted_device_revoked", {
        deviceId,
      });
    } else {
      // Revoke all devices
      await revokeAllTrustedDevices(userId);
      await logSecurityActivity(userId, "all_trusted_devices_revoked");
    }

    return NextResponse.json({
      success: true,
      message: deviceId ? "Device revoked" : "All devices revoked",
    });
  } catch (error: any) {
    console.error("Error revoking trusted device:", error);
    return NextResponse.json(
      { error: error.message || "Failed to revoke trusted device" },
      { status: 500 }
    );
  }
}
