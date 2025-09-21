// SPDX-License-Identifier: Apache-2.0
import DOMPurify from "isomorphic-dompurify";
export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_ATTR: ["href","src","alt","title","target","rel","controls","poster"],
    ALLOWED_TAGS: ["p","a","strong","em","ul","ol","li","blockquote","code","pre","img","video","br","span"],
    FORBID_ATTR: ["onerror","onclick","style"],
  });
}
