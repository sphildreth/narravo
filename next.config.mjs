// SPDX-License-Identifier: Apache-2.0
import withBundleAnalyzer from '@next/bundle-analyzer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  "https:",  // Allow all HTTPS images for admin flexibility
  s3Hostname,
  "avatars.githubusercontent.com",
  "images.unsplash.com", 
  "lh3.googleusercontent.com",
  "i.pravatar.cc",
  "stackoverflow.com",
].filter(Boolean).join(" ");

const mediaSrc = [
  "'self'",
  "https:",  // Allow all HTTPS media sources for admin flexibility
  s3Hostname,
].filter(Boolean).join(" ");

// Domains allowed to be embedded in iframes (e.g., YouTube)
import { FRAME_SRC_HOSTS } from "./src/lib/frame-src.mjs";
const frameSrc = ["'self'", ...FRAME_SRC_HOSTS].join(" ");

const connectSrc = [
  "'self'",
  s3Hostname,
  "https:",
  "data:",
  "blob:",
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
      `frame-src ${frameSrc};` +
      `connect-src ${connectSrc};` +
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
      // Allow all HTTPS images for admin flexibility
      { protocol: 'https', hostname: '**' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'stackoverflow.com' },
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

// Enable bundle analyzer when ANALYZE=true
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default bundleAnalyzer(nextConfig);
