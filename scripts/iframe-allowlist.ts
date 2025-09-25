// iframe-allowlist.ts
// Drop-in utility to validate, protect, and restore <iframe> elements using a configurable provider allowlist.
// Usage:
//   import { validateAndProtectIframes, restoreProtectedIframes, defaultProviders, buildFrameSrcCSP } from "./iframe-allowlist";
//   const { html: protectedHtml, placeholders } = validateAndProtectIframes(rawHtml, myProviders);
//   const sanitized = sanitizeHtml(protectedHtml, { /* FORBID_TAGS: ["iframe"] */ });
//   const restored = restoreProtectedIframes(sanitized, placeholders);
//   // Configure your CSP using buildFrameSrcCSP(myProviders)

export type IframeProvider = {
  /** Human-friendly name */
  name: string;
  /** One or more host patterns (RegExp tested against URL.hostname). e.g., /(^|\.)youtube\.com$/ */
  hostPatterns: RegExp[];
  /** Optional path matcher to further constrain embeds (tested against URL.pathname) */
  pathPattern?: RegExp;
  /** Extra runtime validation hook; return false to reject the iframe */
  extraValidate?: (url: URL, attrs: Record<string, string>) => boolean;
  /** Allowed attributes to preserve for this provider */
  allowedAttrs?: string[];
  /** Whether to force https for this provider (recommended) */
  httpsOnly?: boolean;
};

export type ProtectedIframe = {
  token: string;
  original: string;   // original iframe HTML
  safeHtml: string;   // sanitized & normalized iframe HTML to restore
};

// Reasonable default attribute set; merge with provider.allowedAttrs
const DEFAULT_IFRAME_ATTRS = [
  "src", "width", "height", "allow", "allowfullscreen", "frameborder",
  "referrerpolicy", "loading", "title"
];

// Safe default providers; consumers can replace or extend this list.
// NOTE: Only YouTube is enabled by default to match a conservative posture.
// Add others as needed in your app config.
export const defaultProviders: IframeProvider[] = [
  {
    name: "YouTube",
    hostPatterns: [/^((www|m)\.)?youtube\.com$/, /^((www|m)\.)?youtube-nocookie\.com$/],
    pathPattern: /^\/embed\/[A-Za-z0-9_-]+$/,
    allowedAttrs: [...DEFAULT_IFRAME_ATTRS],
    httpsOnly: true,
    extraValidate: (url) => {
      // Require /embed/<id> and no query params that look suspicious
      // Allow modestbranding, rel, start, end, autoplay, controls, mute
      const okParams = new Set([
        "autoplay","controls","mute","start","end","rel","modestbranding","iv_load_policy","playsinline","loop","playlist"
      ]);
      for (const key of url.searchParams.keys()) {
        if (!okParams.has(key)) return false;
      }
      return true;
    }
  }
];

// ---- Internal helpers ----

function randomToken(): string {
  // simple token; not cryptographic
  return "IFR_TKN_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

// Very small HTML attribute parser for <iframe ...> tag; not a general-purpose HTML parser.
function parseTagAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  // remove leading <iframe and trailing >
  const inner = tag.replace(/^<iframe\b/i, "").replace(/>$/,"").trim();
  // match key="value" or key='value' or key=value or key
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  // Use matchAll for better type narrowing under strictNullChecks
  for (const m of inner.matchAll(re)) {
    const keyRaw = m[1];
    if (!keyRaw) continue;
    const key = keyRaw.toLowerCase();
    const val = (m[2] ?? m[3] ?? m[4] ?? "").toString();
    attrs[key] = val;
  }
  return attrs;
}

function escapeHtmlAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Normalize a safe iframe HTML string with only allowed attrs; enforce https if requested.
function buildSafeIframeHTML(url: URL, attrs: Record<string,string>, allowedAttrs: string[], httpsOnly: boolean | undefined): string {
  if (httpsOnly && url.protocol !== "https:") {
    url.protocol = "https:";
  }
  const safe: string[] = [`<iframe`];
  const finalAttrs: Record<string,string> = { ...attrs, src: url.toString() };

  // Drop any inline event handlers (on*)
  for (const k of Object.keys(finalAttrs)) {
    if (/^on/i.test(k)) delete finalAttrs[k];
  }

  for (const key of allowedAttrs) {
    if (finalAttrs[key] != null && finalAttrs[key] !== "") {
      safe.push(` ${key}="${escapeHtmlAttr(finalAttrs[key])}"`);
    }
  }
  safe.push(`></iframe>`);
  return safe.join("");
}

// Check provider allowlist
function isAllowedByProvider(url: URL, attrs: Record<string,string>, provider: IframeProvider): boolean {
  const hostOk = provider.hostPatterns.some((re) => re.test(url.hostname));
  if (!hostOk) return false;
  if (provider.httpsOnly && url.protocol !== "https:") return false;
  if (provider.pathPattern && !provider.pathPattern.test(url.pathname)) return false;
  if (provider.extraValidate && !provider.extraValidate(url, attrs)) return false;
  return true;
}

// ---- Public API ----

/**
 * Validate and protect allowed iframes by replacing them with opaque tokens.
 * Disallowed iframes remain as-is and should be removed by your sanitizer later.
 */
export function validateAndProtectIframes(
  html: string,
  providers: IframeProvider[] = defaultProviders
): { html: string; placeholders: ProtectedIframe[] } {
  const placeholders: ProtectedIframe[] = [];
  if (!html || !html.includes("<iframe")) return { html, placeholders };

  const iframeRe = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi;
  const out = html.replace(iframeRe, (tag) => {
    // Extract src
    const attrs = parseTagAttrs(tag);
    const rawSrc = attrs["src"];
    if (!rawSrc) return tag; // no src -> ignore; sanitizer should drop

    let url: URL;
    try {
      url = new URL(rawSrc);
    } catch {
      // If relative or invalid URL, leave as-is (later sanitizer will drop)
      return tag;
    }

    // Find first matching provider
    const match = providers.find((p) => isAllowedByProvider(url, attrs, p));
    if (!match) {
      return tag; // not allowed -> let sanitizer handle it
    }

    const allowedAttrs = Array.from(new Set([...(match.allowedAttrs ?? []), ...DEFAULT_IFRAME_ATTRS]));
    const safeHtml = buildSafeIframeHTML(url, attrs, allowedAttrs, match.httpsOnly);
    const token = randomToken();
    placeholders.push({ token, original: tag, safeHtml });
    return token;
  });

  return { html: out, placeholders };
}

/**
 * Restore previously protected iframes back into the HTML after sanitization.
 * Any tokens that survive sanitization will be replaced with the validated safe HTML.
 */
export function restoreProtectedIframes(html: string, placeholders: ProtectedIframe[]): string {
  if (!placeholders.length) return html;
  let out = html;
  for (const ph of placeholders) {
    const tokenRe = new RegExp(ph.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(tokenRe, ph.safeHtml);
  }
  return out;
}

/**
 * Build a CSP frame-src directive from provider hostnames.
 * Example output: "frame-src https://www.youtube.com https://youtube-nocookie.com;"
 */
export function buildFrameSrcCSP(providers: IframeProvider[] = defaultProviders): string {
  const hosts = new Set<string>();
  for (const p of providers) {
    for (const re of p.hostPatterns) {
      // Derive a canonical host token for docs. If regex starts with ^ and ends with $, strip anchors and replace groups:
      const text = re.toString().slice(1, -1); // drop leading/trailing /
      // A naive conversion: drop (^|\.) and groupings; keep the suffix.
      const host = text.replace(/^\^\(\?\:\^\|\\\.\)\??/,"").replace(/^\(\?:\^\\\.\)\?/,"").replace(/^\^(\(\?\:\^\|\\\.\))?/,"").replace(/\$$/,"").replace(/\(\?:\.\*\)/g,"*");
      // Fall back to wildcard form if we can't parse nicely:
      const token = host.includes("youtube") ? "https://*.youtube.com" :
                    host.includes("youtube-nocookie") ? "https://*.youtube-nocookie.com" :
                    host.startsWith("\\.") ? "https://*." + host.replace(/^\\\./,"") :
                    "https://" + host.replace(/\\/g,"");
      hosts.add(token);
    }
  }
  return "frame-src " + Array.from(hosts).join(" ") + ";";
}
