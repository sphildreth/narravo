import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { db } from "./db";
import { users } from "../drizzle/schema";
import { isEmailAdmin } from "./admin";

type DbUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
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
    });

  if (!upserted) throw new Error("Failed to persist user");

  return upserted as DbUser;
};

const config: NextAuthConfig = {
  providers: [
    GitHub({ clientId: process.env.GITHUB_ID!, clientSecret: process.env.GITHUB_SECRET! }),
    Google({ clientId: process.env.GOOGLE_ID!, clientSecret: process.env.GOOGLE_SECRET! }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user?.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await ensureUser({ email: user.email, name: user.name, image: user.image });
        Object.assign(user, { id: dbUser.id });
        token.sub = dbUser.id;
        token.userId = dbUser.id;
        token.email = dbUser.email;
        token.isAdmin = isEmailAdmin(dbUser.email);
      } else if (token?.email) {
        token.isAdmin = isEmailAdmin(token.email);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId ?? token.sub ?? "";
        (session.user as any).isAdmin = Boolean(token.isAdmin);
      }

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
