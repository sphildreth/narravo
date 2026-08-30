// SPDX-License-Identifier: Apache-2.0
import withBundleAnalyzer from '@next/bundle-analyzer'

// Get S3 hostname for CSP
const s3Endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || "";
const s3Hostname = (() => {
  try {
    return s3Endpoint ? new URL(s3Endpoint).hostname : "";
  } catch {
    return "";
  }
})();
const awsS3Hostname = !s3Endpoint && process.env.S3_BUCKET && process.env.S3_REGION
  ? `${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com`
  : "";

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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
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
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'stackoverflow.com' },
      ...(s3Hostname ? [{ protocol: 'https', hostname: s3Hostname }] : []),
      ...(awsS3Hostname ? [{ protocol: 'https', hostname: awsS3Hostname }] : []),
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
