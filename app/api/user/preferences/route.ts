// SPDX-License-Identifier: Apache-2.0
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";

// Define which configuration keys users can modify themselves
const USER_CONFIGURABLE_KEYS = new Set([
  'THEME',
  'USER.LANGUAGE',
  'USER.TIMEZONE', 
  'USER.NOTIFICATIONS.EMAIL'
]);

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: { message: "Authentication required" } }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const configService = new ConfigServiceImpl({ db, allowUserOverrides: USER_CONFIGURABLE_KEYS });
    const userId = session.user.id;

    // Get all user-configurable preferences with their current effective values
    const preferences: Record<string, any> = {};
    for (const key of USER_CONFIGURABLE_KEYS) {
      preferences[key] = await configService.get(key, { userId });
    }

    return new Response(JSON.stringify({ 
      preferences,
      configurableKeys: Array.from(USER_CONFIGURABLE_KEYS)
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: { message } }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: { message: "Authentication required" } }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { key, value } = await req.json();
    if (!key) {
      return new Response(JSON.stringify({ error: { message: "Key is required" } }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const configService = new ConfigServiceImpl({ db, allowUserOverrides: USER_CONFIGURABLE_KEYS });
    const userId = session.user.id;

    // This will automatically validate that the key is in the allowlist
    await configService.setUserOverride(key, userId, value);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 403 : 400;
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: { message: "Authentication required" } }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const { key } = await req.json();
    if (!key) {
      return new Response(JSON.stringify({ error: { message: "Key is required" } }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const configService = new ConfigServiceImpl({ db, allowUserOverrides: USER_CONFIGURABLE_KEYS });
    const userId = session.user.id;

    // This will automatically validate that the key is in the allowlist
    await configService.deleteUserOverride(key, userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 403 : 400;
    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }
}