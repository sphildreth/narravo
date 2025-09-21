// SPDX-License-Identifier: Apache-2.0

// Get S3 hostname for CSP
const s3Endpoint = process.env.S3_ENDPOINT || process.env.R2_ENDPOINT;
// We just need the hostname.
const s3Hostname = s3Endpoint ? new URL(s3Endpoint).hostname : "";

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
      `img-src 'self' data: ${s3Hostname};` +
      `media-src 'self' ${s3Hostname};` +
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
