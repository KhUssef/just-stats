// Downloads the IP prefixes announced by the networks in NETWORKS (data
// centres and clouds, where real visitors almost never browse from) and
// writes them, merged into sorted ranges, to lib/ranges.json. Runs before
// `next dev` and `next build`, so every deployment carries current ranges.
// Source: RIPEstat "announced-prefixes", which covers every registry.
import { writeFile } from "node:fs/promises";

// CDN networks (Cloudflare, Akamai, Fastly) are left out on purpose: iCloud
// Private Relay and similar privacy proxies send real people through them.
// Google's main network (AS15169) is left out too: it also carries Google
// staff and some consumer services. Its email proxies are caught by headers.
const NETWORKS = [
  { name: "microsoft", label: "Microsoft / Azure", asns: [8075] },
  { name: "aws", label: "Amazon AWS", asns: [16509, 14618] },
  { name: "google-cloud", label: "Google Cloud", asns: [396982] },
  { name: "ovh", label: "OVH", asns: [16276] },
  { name: "hetzner", label: "Hetzner", asns: [24940] },
  { name: "digitalocean", label: "DigitalOcean", asns: [14061] },
  { name: "linode", label: "Akamai Linode", asns: [63949] },
  { name: "vultr", label: "Vultr", asns: [20473] },
  { name: "oracle", label: "Oracle Cloud", asns: [31898] },
  { name: "alibaba", label: "Alibaba Cloud", asns: [45102] },
  { name: "tencent", label: "Tencent Cloud", asns: [132203] },
  { name: "scaleway", label: "Scaleway", asns: [12876] },
  { name: "contabo", label: "Contabo", asns: [51167] },
];

async function prefixes(asn) {
  const url = `https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}&sourceapp=just-stats`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body.data.prefixes.map((p) => p.prefix);
    } catch (e) {
      if (attempt === 3) throw new Error(`AS${asn}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function v4Range(cidr) {
  const [ip, bits] = cidr.split("/");
  const n = ip.split(".").reduce((acc, part) => acc * 256 + Number(part), 0);
  const size = 2 ** (32 - Number(bits));
  const start = n - (n % size);
  return [start, start + size - 1];
}

function v6ToBigInt(ip) {
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  return groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || "0", 16)), 0n);
}

function v6Range(cidr) {
  const [ip, bits] = cidr.split("/");
  const host = 128n - BigInt(bits);
  const start = (v6ToBigInt(ip) >> host) << host;
  return [start, start + (1n << host) - 1n];
}

// Sorts and merges overlapping or touching ranges.
function merge(ranges, one) {
  ranges.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const r of ranges) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + one) {
      if (r[1] > last[1]) last[1] = r[1];
    } else {
      out.push([r[0], r[1]]);
    }
  }
  return out;
}

const networks = [];
for (const net of NETWORKS) {
  const all = (await Promise.all(net.asns.map(prefixes))).flat();
  const v4 = merge(all.filter((p) => !p.includes(":")).map(v4Range), 1);
  const v6 = merge(all.filter((p) => p.includes(":")).map(v6Range), 1n).map(([a, b]) => [
    a.toString(16),
    b.toString(16),
  ]);
  networks.push({ name: net.name, label: net.label, asns: net.asns, prefixes: all.length, v4, v6 });
  console.log(`ranges: ${net.label} ${all.length} prefixes -> ${v4.length} v4 + ${v6.length} v6 ranges`);
}

await writeFile(
  new URL("../lib/ranges.json", import.meta.url),
  JSON.stringify({ generated: new Date().toISOString(), networks }),
);
