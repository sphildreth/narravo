// SPDX-License-Identifier: Apache-2.0
// Decode one layer only, including legacy numeric encodings from imported posts.
const entities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  "#39": "'", "#x27": "'", "#x2f": "/", "#10": "\n", "#13": "\r",
};
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27|#x2f|#10|#13);/gi,
    (entity, name: string) => entities[name.toLowerCase()] ?? entity);
}
