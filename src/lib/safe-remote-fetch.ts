// SPDX-License-Identifier: Apache-2.0
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const SAFE_PORTS = new Set([80, 443]);

function ipv4ToNumber(value: string): number | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => part < 0 || part > 255)) return null;
  return (((numbers[0]! * 256 + numbers[1]!) * 256 + numbers[2]!) * 256 + numbers[3]!) >>> 0;
}

function ipv6ToBigInt(value: string): bigint | null {
  let address = value.toLowerCase().replace(/^\[|\]$/g, "");
  const zoneIndex = address.indexOf("%");
  if (zoneIndex >= 0) address = address.slice(0, zoneIndex);
  if (address.includes(".")) {
    const lastColon = address.lastIndexOf(":");
    const v4 = ipv4ToNumber(address.slice(lastColon + 1));
    if (v4 === null) return null;
    address = `${address.slice(0, lastColon)}:${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
    : left;
  if (groups.length !== 8) return null;
  return groups.reduce((result, group) => (result << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function inIpv4Range(value: number, start: string, prefix: number): boolean {
  const base = ipv4ToNumber(start);
  if (base === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function inIpv6Range(value: bigint, start: string, prefix: number): boolean {
  const base = ipv6ToBigInt(start);
  if (base === null) return false;
  const shift = BigInt(128 - prefix);
  return (value >> shift) === (base >> shift);
}

/** Reject all address classes that must not be reached by an import job. */
export function isUnsafeRemoteAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address);
    if (value === null) return true;
    return [
      ["0.0.0.0", 8],       // unspecified
      ["10.0.0.0", 8],      // RFC1918
      ["100.64.0.0", 10],   // carrier-grade NAT
      ["127.0.0.0", 8],     // loopback
      ["169.254.0.0", 16],  // link-local and cloud metadata
      ["172.16.0.0", 12],   // RFC1918
      ["192.0.0.0", 24],    // IETF protocol assignments
      ["168.63.129.16", 32], // Azure platform/reserved address
      ["192.0.2.0", 24],    // TEST-NET
      ["192.88.99.0", 24],  // deprecated 6to4 relay anycast
      ["192.168.0.0", 16],  // RFC1918
      ["198.18.0.0", 15],   // benchmarking
      ["198.51.100.0", 24], // TEST-NET
      ["203.0.113.0", 24],  // TEST-NET
      ["224.0.0.0", 4],     // multicast
      ["240.0.0.0", 4],     // reserved
    ].some(([start, prefix]) => inIpv4Range(value, String(start), Number(prefix)));
  }
  if (family === 6) {
    const value = ipv6ToBigInt(address);
    if (value === null) return true;
    // IPv4-mapped IPv6 addresses inherit the IPv4 restrictions.
    if (inIpv6Range(value, "::ffff:0:0", 96)) {
      const mapped = Number(value & 0xffffffffn);
      return isUnsafeRemoteAddress(`${mapped >>> 24}.${(mapped >>> 16) & 255}.${(mapped >>> 8) & 255}.${mapped & 255}`);
    }
    // Public imports have no reason to target non-global IPv6 space. Start
    // default-deny, then exclude transition/documentation assignments that
    // sit inside the global-unicast 2000::/3 allocation.
    if (!inIpv6Range(value, "2000::", 3)) return true;
    return [
      ["::", 128],          // unspecified
      ["::1", 128],         // loopback
      ["fc00::", 7],        // unique local
      ["fe80::", 10],       // link-local
      ["fec0::", 10],       // deprecated site-local
      ["ff00::", 8],        // multicast
      ["2001::", 23],       // IETF protocol/transition assignments
      ["2001:db8::", 32],   // documentation
      ["2002::", 16],       // 6to4 can encode non-public IPv4 targets
      ["3fff::", 20],       // documentation
    ].some(([start, prefix]) => inIpv6Range(value, String(start), Number(prefix)));
  }
  return true;
}

export function normalizeAllowedHosts(values: string[]): string[] {
  return values.map((raw) => {
    const input = raw.trim();
    if (!input) return "";
    if (input.includes("*") || input.includes("@")) throw new Error("Wildcards and credentials are not allowed in media host allowlists");
    let parsed: URL;
    try {
      parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `http://${input}`);
    } catch {
      throw new Error("Invalid media host allowlist entry");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Only HTTP(S) media hosts are allowed");
    if (parsed.username || parsed.password) throw new Error("Credentials are not allowed in media host allowlists");
    // Preserve the historical convenience of allowing a URL with a path by
    // stripping the path after parsing the host.
    if (parsed.port && !SAFE_PORTS.has(Number(parsed.port))) throw new Error("Only ports 80 and 443 are allowed");
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host === "ip6-localhost" ||
      (net.isIP(host) !== 0 && isUnsafeRemoteAddress(host))) throw new Error("Unsafe media host allowlist entry");
    return host;
  }).filter(Boolean);
}

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

export async function resolveAndValidateRemoteUrl(rawUrl: string, allowedHosts: string[]): Promise<{ url: URL; addresses: Array<{ address: string; family: 4 | 6 }> }> {
  const normalizedAllowedHosts = normalizeAllowedHosts(allowedHosts);
  if (normalizedAllowedHosts.length === 0) throw new Error("A non-empty media host allowlist is required");
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP and HTTPS media URLs are allowed");
  if (url.username || url.password) throw new Error("Media URLs must not contain credentials");
  const port = url.port ? Number(url.port) : url.protocol === "http:" ? 80 : 443;
  if (!SAFE_PORTS.has(port)) throw new Error("Media URL uses an unsafe port");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "ip6-localhost") {
    throw new Error("Localhost media URLs are not allowed");
  }
  if (!isHostAllowed(hostname, normalizedAllowedHosts)) throw new Error(`Host ${hostname} is not in the media allowlist`);
  const records = net.isIP(hostname)
    ? [{ address: hostname, family: net.isIP(hostname) as 4 | 6 }]
    : await dns.lookup(hostname, { all: true, verbatim: true }) as Array<{ address: string; family: 4 | 6 }>;
  if (records.length === 0 || records.some((record) => isUnsafeRemoteAddress(record.address))) {
    throw new Error("Media host resolves to an unsafe address");
  }
  return { url, addresses: records };
}

/** Download via a pinned lookup callback; redirects are intentionally disabled. */
export async function downloadRemoteBytes(rawUrl: string, allowedHosts: string[], maxBytes: number): Promise<Uint8Array> {
  const { url, addresses } = await resolveAndValidateRemoteUrl(rawUrl, allowedHosts);
  const selected = addresses[0]!;
  const transport = url.protocol === "https:" ? https : http;
  const port = url.port ? Number(url.port) : url.protocol === "http:" ? 80 : 443;

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (deadline) clearTimeout(deadline);
      reject(error);
    };
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: { "User-Agent": "Narravo-WXR-Importer/1.0", Accept: "*/*" },
      servername: url.hostname,
      // Node uses this callback for the actual socket connection, preventing
      // an unchecked second DNS lookup after validation.
      lookup: (_hostname: string, _options: unknown, callback: (error: Error | null, address?: string, family?: number) => void) => {
        callback(null, selected.address, selected.family);
      },
    } as any, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        response.resume();
        request.destroy();
        fail(new Error("Redirects are not allowed for media downloads"));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        request.destroy();
        fail(new Error(`HTTP ${status}`));
        return;
      }
      const declared = response.headers["content-length"];
      const contentLength = typeof declared === "string" ? Number(declared) : Array.isArray(declared) ? Number(declared[0]) : undefined;
      if (contentLength !== undefined && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes)) {
        response.resume();
        request.destroy();
        fail(new Error("Media response exceeds the size limit"));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | Uint8Array) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += bytes.byteLength;
        if (total > maxBytes) {
          response.destroy();
          request.destroy();
          fail(new Error("Media response exceeds the size limit"));
          return;
        }
        chunks.push(bytes);
      });
      response.on("error", (error) => fail(error instanceof Error ? error : new Error("Media response failed")));
      response.on("end", () => {
        if (settled) return;
        settled = true;
        if (deadline) clearTimeout(deadline);
        resolve(new Uint8Array(Buffer.concat(chunks, total)));
      });
    });
    deadline = setTimeout(() => request.destroy(new Error("Media download exceeded the total time limit")), 30_000);
    request.setTimeout(15_000, () => request.destroy(new Error("Media download timed out")));
    request.on("error", (error) => fail(error));
    request.end();
  });
}
