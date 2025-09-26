// SPDX-License-Identifier: Apache-2.0
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  NEXTAUTH_URL?: string;
    NEXTAUTH_SECRET?: string;
  ADMIN_EMAILS?: string; // comma-separated
    // S3/R2 configuration
    S3_REGION?: string;
    S3_ENDPOINT?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    S3_BUCKET?: string;
    R2_REGION?: string;
    R2_ENDPOINT?: string;
    R2_ACCESS_KEY_ID?: string;
    R2_SECRET_ACCESS_KEY?: string;
    R2_BUCKET?: string;
    // Analytics
    ANALYTICS_IP_SALT?: string;
    // Excerpt configuration
    EXCERPT_MAX_CHARS?: string; // number as string
    EXCERPT_ELLIPSIS?: string;  // default "…"
    EXCERPT_INCLUDE_BLOCK_CODE?: string; // "true" to keep <pre>
    [key: `NEXT_PUBLIC_${string}`]: string | undefined;
  }
}
