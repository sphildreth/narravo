// SPDX-License-Identifier: Apache-2.0

// Get S3 hostname for CSP
const s3Endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || "";
const s3Hostname = (() => {
  try {
    return s3Endpoint ? new URL(s3Endpoint).hostname : "";
  } catch {
    return "";
  }
})();

const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  s3Hostname,
  "avatars.githubusercontent.com",
  "images.unsplash.com",
  "lh3.googleusercontent.com",
].filter(Boolean).join(" ");

const mediaSrc = [
  "'self'",
  s3Hostname,
].filter(Boolean).join(" ");

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value:
      `default-src 'self';` +
      `script-src 'self' 'unsafe-eval' 'unsafe-inline';` + // Next.js needs unsafe-eval/inline for dev/HMR
      `style-src 'self' 'unsafe-inline';` +
      `img-src ${imgSrc};` +
      `media-src ${mediaSrc};` +
      `font-src 'self';` +
      `object-src 'none';` +
      `base-uri 'self';` +
      `form-action 'self';` +
      `frame-ancestors 'none';` +
      `block-all-mixed-content;` +
      `upgrade-insecure-requests;`,
  },
];


/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      ...(s3Hostname ? [{ protocol: 'https', hostname: s3Hostname }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
export default nextConfig;
