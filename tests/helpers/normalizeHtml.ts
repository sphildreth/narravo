import cheerio from "cheerio";
import DOMPurify from "isomorphic-dompurify";

// Based on Appendix B of TEST_REQUIREMENTS_WXR_IMPORT.md
const ALLOWED_TAGS = [
  "p", "span", "strong", "em", "b", "i", "ul", "ol", "li", "blockquote",
  "pre", "code", "img", "a", "figure", "figcaption", "table", "thead",
  "tbody", "tfoot", "tr", "th", "td", "video", "audio", "source",
];

const ALLOWED_ATTR = {
  "*": ["class", "style", "dir"], // Allow basic attributes globally
  a: ["href", "title", "target", "rel"],
  img: ["src", "srcset", "sizes", "alt", "title", "width", "height", "data-*"],
  iframe: ["src", "width", "height", "allow", "allowfullscreen"],
  th: ["scope"],
  td: ["colspan", "rowspan"],
  video: ["src", "controls", "type"],
  audio: ["src", "controls", "type"],
  source: ["src", "type"],
  code: ["class", "data-lang"],
  blockquote: ["cite"],
};

// Sanitize and normalize HTML for consistent snapshot testing
export function normalizeHtml(html: string): string {
  // 1. Sanitize with DOMPurify based on the defined policy
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Allow iframes from trusted sources, example: YouTube, Vimeo
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"],
    FORBID_TAGS: ["script", "style", "object", "embed"],
  });

  // 2. Load into Cheerio for DOM manipulation
  const $ = cheerio.load(sanitizedHtml, {
    xmlMode: false, // Use HTML parsing
    decodeEntities: false, // Entities are already handled by DOMPurify
  });

  // 3. Normalize attributes for all elements
  $("*").each((i, el) => {
    const elem = $(el);
    const attrs = elem.attr();
    if (attrs) {
      // Remove all attributes
      Object.keys(attrs).forEach(attr => elem.removeAttr(attr));
      // Add them back sorted alphabetically
      Object.keys(attrs).sort().forEach(attr => {
        elem.attr(attr, attrs[attr]);
      });
    }

    // Special handling for anchor tags as per Appendix B
    if (elem.is("a") && elem.attr("target") === "_blank") {
      const rel = (elem.attr("rel") || "").split(" ").filter(Boolean);
      if (!rel.includes("noopener")) {
        rel.push("noopener");
      }
      if (!rel.includes("noreferrer")) {
        rel.push("noreferrer");
      }
      elem.attr("rel", rel.sort().join(" "));
    }
  });

  // 4. Return the processed, normalized HTML string
  // Using html() gives the inner content of the body
  return $("body").html() || "";
}
