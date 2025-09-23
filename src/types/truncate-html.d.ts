// SPDX-License-Identifier: Apache-2.0
declare module "truncate-html" {
  interface TruncateOptions {
    length?: number;
    ellipsis?: string;
    reserveLastWord?: boolean;
    /**
     * Some forks may support allowTags. We don't rely on it; we pre-clean.
     */
    allowTags?: string[];
  }
  function truncateHtml(input: string, options?: TruncateOptions): string;
  export default truncateHtml;
}

