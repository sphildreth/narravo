import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: DefaultSession["user"] & {
      id: string;
      isAdmin?: boolean;
    };
  }

  interface User {
    id: string;
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isAdmin?: boolean;
  }
}
