import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * Guards outbound fetches driven by user-supplied URLs (iCal feeds).
 *
 * Without this, an endpoint that fetches an arbitrary URL lets a caller use the
 * server as a proxy into networks it can reach but they can't — loopback,
 * private ranges, and cloud link-local metadata endpoints.
 */

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

/** Blocked IPv4 ranges, as [firstOctet, predicate] checks. */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
  const [a = 0, b = 0] = parts;
  if (a === 0) return true;                        // 0.0.0.0/8 "this network"
  if (a === 10) return true;                       // private
  if (a === 127) return true;                      // loopback
  if (a === 169 && b === 254) return true;         // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true;// private
  if (a === 192 && b === 168) return true;         // private
  if (a === 100 && b >= 64 && b <= 127) return true;// CGNAT
  if (a === 192 && b === 0) return true;           // IETF protocol assignments
  if (a >= 224) return true;                       // multicast + reserved + broadcast
  return false;
}

/**
 * Expand an IPv6 address to its eight 16-bit groups. Needed because equivalent
 * spellings normalize differently — `::ffff:127.0.0.1` becomes `::ffff:7f00:1`
 * — so matching on the text form misses embedded addresses.
 */
function expandIPv6(ip: string): number[] | null {
  let addr = ip.toLowerCase();

  // A trailing dotted-quad (::ffff:127.0.0.1) becomes two hex groups.
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (dotted?.[1]) {
    const o = dotted[1].split(".").map(Number);
    if (o.length !== 4 || o.some(n => Number.isNaN(n) || n < 0 || n > 255)) return null;
    const hex = `${(((o[0] ?? 0) << 8) | (o[1] ?? 0)).toString(16)}:${(((o[2] ?? 0) << 8) | (o[3] ?? 0)).toString(16)}`;
    addr = addr.slice(0, dotted.index) + hex;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":").map(g => parseInt(g, 16)) : []);
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if ([...head, ...tail].some(n => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;

  const groups = halves.length === 2
    ? [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail]
    : head;
  return groups.length === 8 ? groups : null;
}

function isBlockedIPv6(ip: string): boolean {
  const g = expandIPv6(ip);
  if (!g) return true; // unparseable — refuse

  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;

  if (g.every(n => n === 0)) return true;                       // ::
  if (g.slice(0, 7).every(n => n === 0) && g7 === 1) return true; // ::1 loopback
  if ((g0 & 0xfe00) === 0xfc00) return true;                    // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true;                    // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true;                    // ff00::/8 multicast

  // Addresses carrying an embedded IPv4 address: IPv4-mapped (::ffff:x),
  // IPv4-compatible (::x), and NAT64 (64:ff9b::/96). Check the v4 they wrap.
  const embedded = () => {
    const a = (g6 >> 8) & 0xff, b = g6 & 0xff, c = (g7 >> 8) & 0xff, d = g7 & 0xff;
    return isBlockedIPv4(`${a}.${b}.${c}.${d}`);
  };
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return embedded();
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return embedded();
  if (g0 === 0x0064 && g1 === 0xff9b) return embedded();

  return false;
}

function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true; // not a parseable address — refuse
}

/**
 * Throws unless `raw` is an http(s) URL whose host resolves entirely to public
 * addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host.toLowerCase() === "localhost" || host.toLowerCase().endsWith(".localhost")) {
    throw new Error("URL host is not permitted");
  }

  // A literal IP needs no lookup; a name may resolve to several addresses and
  // every one of them has to be public.
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("URL host is not permitted");
    return url;
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    throw new Error("Could not resolve URL host");
  }
  if (resolved.length === 0) throw new Error("Could not resolve URL host");
  if (resolved.some(r => isBlockedAddress(r.address))) {
    throw new Error("URL host is not permitted");
  }

  return url;
}

/**
 * fetch() for user-supplied URLs. Validates the target, then follows redirects
 * manually so each hop is validated too — otherwise a public URL could bounce
 * the request to an internal one.
 *
 * Note: this does not pin the resolved address, so a DNS entry that changes
 * between validation and connection could still slip through. Closing that
 * fully needs connection-level control; this covers the practical cases.
 */
export async function safeFetch(raw: string, init?: RequestInit): Promise<Response> {
  let target = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(target);
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      target = new URL(location, url).toString();
      continue;
    }
    return res;
  }

  throw new Error("Too many redirects");
}
