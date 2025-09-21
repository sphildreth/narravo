// SPDX-License-Identifier: Apache-2.0
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
  },
};
export default nextConfig;
