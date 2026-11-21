// Time ranges and traffic filters selectable from the dashboard header,
// parsed from the URL search params.

export type Bucket = "hour" | "day";

export interface Range {
  key: string;
  label: string;
  hours: number;
  bucket: Bucket;
}

export const RANGES: Range[] = [
  { key: "24h", label: "Last 24 hours", hours: 24, bucket: "hour" },
  { key: "7d", label: "Last 7 days", hours: 24 * 7, bucket: "day" },
  { key: "30d", label: "Last 30 days", hours: 24 * 30, bucket: "day" },
  { key: "90d", label: "Last 90 days", hours: 24 * 90, bucket: "day" },
];

export type Traffic = "humans" | "bots" | "all";

export const TRAFFIC: { key: Traffic; label: string }[] = [
  { key: "humans", label: "People only" },
  { key: "bots", label: "Bots only" },
  { key: "all", label: "All traffic" },
];

export interface Filters {
  range: Range;
  traffic: Traffic;
  // ISO 3166-1 alpha-2 code, or null for every country.
  country: string | null;
  start: Date;
  end: Date;
  prevStart: Date;
}

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFilters(params: Params, now: Date = new Date()): Filters {
  const range = RANGES.find((r) => r.key === first(params.range)) ?? RANGES[1];
  const traffic = TRAFFIC.find((t) => t.key === first(params.traffic))?.key ?? "humans";
  const code = first(params.country)?.toUpperCase();
  const country = code && /^[A-Z]{2}$/.test(code) ? code : null;
  const span = range.hours * 3600_000;
  const end = now;
  const start = new Date(end.getTime() - span);
  return { range, traffic, country, start, end, prevStart: new Date(start.getTime() - span) };
}

type Change = Partial<{ range: string; traffic: Traffic; country: string | null }>;

export function href(filters: Filters, change: Change): string {
  const params = new URLSearchParams({
    range: change.range ?? filters.range.key,
    traffic: change.traffic ?? filters.traffic,
  });
  const country = change.country === undefined ? filters.country : change.country;
  if (country) params.set("country", country);
  return `/?${params.toString()}`;
}
