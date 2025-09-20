declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    NEXTAUTH_SECRET?: string;
    [key: `NEXT_PUBLIC_${string}`]: string | undefined;
  }
}
