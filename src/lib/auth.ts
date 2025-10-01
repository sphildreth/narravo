// SPDX-License-Identifier: Apache-2.0
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "./db";
import { users } from "@/drizzle/schema";
import { isEmailAdmin } from "./admin";
import { eq } from "drizzle-orm";

type DbUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  twoFactorEnabled: boolean;
  mfaVerifiedAt: Date | null;
};

const ensureUser = async (profile: { email: string; name?: string | null | undefined; image?: string | null | undefined }) => {
  const values = {
    email: profile.email,
    name: profile.name ?? null,
    image: profile.image ?? null,
  };

  const [upserted] = await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.email,
      set: { name: values.name, image: values.image },
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      twoFactorEnabled: users.twoFactorEnabled,
      mfaVerifiedAt: users.mfaVerifiedAt,
    });

  if (!upserted) throw new Error("Failed to persist user");

  return upserted as DbUser;
};

// Build providers only if configured in env
const configuredProviders: any[] = [];
const enabledProvidersMeta: { id: string; label: string }[] = [];

const githubId = process.env.GITHUB_ID?.trim();
const githubSecret = process.env.GITHUB_SECRET?.trim();
if (githubId && githubSecret) {
  configuredProviders.push(GitHub({ clientId: githubId, clientSecret: githubSecret }));
  enabledProvidersMeta.push({ id: "github", label: "GitHub" });
}

const googleId = process.env.GOOGLE_ID?.trim();
const googleSecret = process.env.GOOGLE_SECRET?.trim();
if (googleId && googleSecret) {
  configuredProviders.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  enabledProvidersMeta.push({ id: "google", label: "Google" });
}

export const authEnabledProviders = enabledProvidersMeta;

const config: NextAuthConfig = {
  providers: configuredProviders,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user?.email);
    },
    async jwt({ token, user, trigger }) {
      if (user?.email) {
        const dbUser = await ensureUser({ email: user.email, name: user.name, image: user.image });
        Object.assign(user, { id: dbUser.id });
        token.sub = dbUser.id;
        token.userId = dbUser.id;
        token.email = dbUser.email;
        token.isAdmin = isEmailAdmin(dbUser.email);
        token.name = dbUser.name ?? user.name ?? null;
        token.image = dbUser.image ?? user.image ?? null;
        token.twoFactorEnabled = dbUser.twoFactorEnabled;
        
        console.log(`[AUTH] User login: ${dbUser.email}, 2FA enabled: ${dbUser.twoFactorEnabled}, mfaVerifiedAt: ${dbUser.mfaVerifiedAt}`);
        
        // Check if 2FA is enabled and recently verified (within 8 hours)
        if (dbUser.twoFactorEnabled) {
          const isRecentlyVerified = dbUser.mfaVerifiedAt && 
            (Date.now() - new Date(dbUser.mfaVerifiedAt).getTime() < 8 * 60 * 60 * 1000);
          
          console.log(`[AUTH] 2FA check: isRecentlyVerified=${isRecentlyVerified}`);
          
          if (isRecentlyVerified) {
            token.mfaPending = false;
            token.mfa = true;
          } else {
            token.mfaPending = true;
            token.mfa = false;
          }
        } else {
          token.mfaPending = false;
          token.mfa = true;
        }
        
        console.log(`[AUTH] Token state: mfaPending=${token.mfaPending}, mfa=${token.mfa}`);
      } else if (token?.email) {
        token.isAdmin = isEmailAdmin(token.email);
        
        // Re-check 2FA status on token refresh
        if (trigger === "update" && token.userId) {
          console.log(`[AUTH] Token update triggered for user ${token.userId}`);
          const [dbUser] = await db
            .select({ 
              twoFactorEnabled: users.twoFactorEnabled,
              mfaVerifiedAt: users.mfaVerifiedAt
            })
            .from(users)
            .where(eq(users.id, token.userId as string))
            .limit(1);
          
          if (dbUser) {
            token.twoFactorEnabled = dbUser.twoFactorEnabled;
            
            // Check if recently verified
            const isRecentlyVerified = dbUser.mfaVerifiedAt && 
              (Date.now() - new Date(dbUser.mfaVerifiedAt).getTime() < 8 * 60 * 60 * 1000);
            
            console.log(`[AUTH] Update: mfaVerifiedAt=${dbUser.mfaVerifiedAt}, isRecentlyVerified=${isRecentlyVerified}`);
            
            if (dbUser.twoFactorEnabled) {
              if (isRecentlyVerified) {
                token.mfaPending = false;
                token.mfa = true;
              } else {
                token.mfaPending = true;
                token.mfa = false;
              }
            } else {
              token.mfaPending = false;
              token.mfa = true;
            }
            
            console.log(`[AUTH] Updated token state: mfaPending=${token.mfaPending}, mfa=${token.mfa}`);
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId ?? token.sub ?? "";
        (session.user as any).isAdmin = Boolean(token.isAdmin);
        session.user.name = (token as any).name ?? session.user.name;
        (session.user as any).image = (token as any).image ?? (session.user as any).image ?? null;
        (session.user as any).twoFactorEnabled = Boolean(token.twoFactorEnabled);
        (session.user as any).mfaPending = Boolean(token.mfaPending);
        (session.user as any).mfa = Boolean(token.mfa);
      }
      
      // Also set these flags on the session itself for easy access
      session.mfaPending = Boolean(token.mfaPending);
      session.mfa = Boolean(token.mfa);
      
      console.log(`[AUTH] Session callback: mfaPending=${session.mfaPending}, mfa=${session.mfa}`);

      return session;
    },
  },
};

export const authOptions = config;

const {
  auth,
  handlers: { GET: authGet, POST: authPost },
} = NextAuth(config);

export { auth, authGet, authPost };

export const getSession = () => auth();

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session.user?.isAdmin) throw new Error("Forbidden");
  return session;
}

export async function require2FA() {
  const session = await requireSession();
  if ((session.user as any).mfaPending) {
    throw new Error("2FA verification required");
  }
  return session;
}

export async function requireAdmin2FA() {
  const session = await require2FA();
  if (!session.user?.isAdmin) throw new Error("Forbidden");
  return session;
}
