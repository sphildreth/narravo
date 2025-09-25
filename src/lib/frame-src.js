// SPDX-License-Identifier: Apache-2.0
// Centralized list of allowed frame-src hosts for CSP and runtime iframe validation.
// Keep this DRY and import wherever needed (Next.js headers, iframe allowlist, etc.).

/** @type {string[]} */
export const FRAME_SRC_HOSTS = [
  "https://*.youtube.com",
  "https://*.youtube-nocookie.com",
];
