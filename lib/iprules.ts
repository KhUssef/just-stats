import data from "@/lib/ranges.json";

// Looks up which data-centre network (if any) an IP address belongs to, using
// the ranges scripts/ranges.mjs downloads at build time. Lookups are binary
// searches over one sorted, non-overlapping list per address family.

interface Network {
  name: string;
  label: string;
  asns: number[];
  prefixes: number;
  v4: number[][];
  v6: string[][];
}

interface Span<T> {
  start: T;
  end: T;
  network: string;
}

const networks = data.networks as Network[];

export const RANGES_GENERATED: string = data.generated;

export const NETWORK_SUMMARY = networks.map((n) => ({
  name: n.name,
  label: n.label,
  asns: n.asns,
  prefixes: n.prefixes,
}));

function sorted<T extends number | bigint>(spans: Span<T>[]): Span<T>[] {
  return spans.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

const V4 = sorted(networks.flatMap((n) => n.v4.map(([start, end]) => ({ start, end, network: n.name }))));
const V6 = sorted(
  networks.flatMap((n) =>
    n.v6.map(([start, end]) => ({ start: BigInt(`0x${start}`), end: BigInt(`0x${end}`), network: n.name })),
  ),
);

function find<T extends number | bigint>(spans: Span<T>[], value: T): string | null {
  let lo = 0;
  let hi = spans.length - 1;
  let hit: string | null = null;
  // Networks can overlap one another, so keep the last span starting at or
  // before the value and check a few neighbours below it.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].start <= value) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  for (let i = hi; i >= 0 && i > hi - 8; i--) {
    if (spans[i].end >= value) {
      hit = spans[i].network;
      break;
    }
  }
  return hit;
}

function parseV4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!/^\d{1,3}$/.test(p) || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function parseV6(ip: string): bigint | null {
  if (!/^[0-9a-f:]+$/i.test(ip) || (ip.match(/::/g) ?? []).length > 1) return null;
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (groups.length !== 8) return null;
  return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || "0", 16)), 0n);
}

// The network name for an address in a data-centre range, or null.
export function networkOf(ip: string): string | null {
  const mapped = ip.toLowerCase().replace(/^::ffff:/, "");
  const v4 = parseV4(mapped);
  if (v4 !== null) return find(V4, v4);
  const v6 = parseV6(mapped);
  return v6 === null ? null : find(V6, v6);
}
