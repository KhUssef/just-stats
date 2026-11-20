import { query } from "@/lib/db";
import type { Filters } from "@/lib/range";
import { parseAgent, type Agent } from "@/lib/ua";

// Every number on the dashboard comes from here. A "page view" is a GET in
// the hits table that was a real navigation: Sec-Fetch-Mode is "navigate", or
// absent (old clients and most bots). Background fetches a page makes of
// itself (Sec-Fetch-Mode "cors") are not views. A "visitor" is a distinct IP.

const TZ = process.env.STATS_TZ ?? "Africa/Tunis";
const SITE_HOST = process.env.SITE_HOST ?? "khalifa-youssef.vercel.app";

// Conditions over `hits` for the window [$1, $2).
function viewsWhere(f: Filters): string {
  const base = "ts >= $1 and ts < $2 and method = 'GET' and (sf_mode is null or sf_mode = 'navigate')";
  return f.traffic === "humans" ? `${base} and not is_bot` : base;
}

function botWhere(f: Filters): string {
  return f.traffic === "humans" ? "and not is_bot" : "";
}

export interface Totals {
  visitors: number;
  views: number;
  clicks: number;
  botShare: number;
}

export interface Kpis {
  current: Totals;
  previous: Totals;
}

async function totals(f: Filters, from: Date, to: Date): Promise<Totals> {
  const [hits] = await query<{ visitors: number; views: number; all_views: number; bot_views: number }>(
    `select count(distinct ip) filter (where ${viewsWhere(f)})::int as visitors,
            count(*) filter (where ${viewsWhere(f)})::int as views,
            count(*)::int as all_views,
            count(*) filter (where is_bot)::int as bot_views
       from hits
      where ts >= $1 and ts < $2 and method = 'GET' and (sf_mode is null or sf_mode = 'navigate')`,
    [from, to],
  );
  const [events] = await query<{ clicks: number }>(
    `select count(*)::int as clicks from events
      where ts >= $1 and ts < $2 and type = 'click' ${botWhere(f)}`,
    [from, to],
  );
  return {
    visitors: hits.visitors,
    views: hits.views,
    clicks: events.clicks,
    botShare: hits.all_views === 0 ? 0 : hits.bot_views / hits.all_views,
  };
}

export async function kpis(f: Filters): Promise<Kpis> {
  const [current, previous] = await Promise.all([
    totals(f, f.start, f.end),
    totals(f, f.prevStart, f.start),
  ]);
  return { current, previous };
}

export interface Point {
  key: string;
  humans: number;
  bots: number;
}

// One point per hour or day in the window, zero-filled, in the STATS_TZ zone.
export async function series(f: Filters): Promise<Point[]> {
  const unit = f.range.bucket;
  return query<Point>(
    `with b as (
       select generate_series(
                date_trunc('${unit}', $1::timestamptz at time zone $3),
                date_trunc('${unit}', $2::timestamptz at time zone $3),
                interval '1 ${unit}') as t
     )
     select to_char(b.t, 'YYYY-MM-DD"T"HH24:MI') as key,
            count(h.id) filter (where not h.is_bot)::int as humans,
            count(h.id) filter (where h.is_bot)::int as bots
       from b
       left join hits h
         on date_trunc('${unit}', h.ts at time zone $3) = b.t
        and h.ts >= $1 and h.ts < $2 and h.method = 'GET'
        and (h.sf_mode is null or h.sf_mode = 'navigate')
      group by b.t
      order by b.t`,
    [f.start, f.end, TZ],
  );
}

export interface Row {
  label: string;
  visitors: number;
  views: number;
}

async function grouped(f: Filters, expr: string, limit = 10): Promise<Row[]> {
  return query<Row>(
    `select ${expr} as label,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from hits
      where ${viewsWhere(f)}
      group by 1
      order by visitors desc, views desc
      limit ${limit}`,
    [f.start, f.end],
  );
}

const REFERRER_HOST = `coalesce(substring(referer from '^https?://([^/:?#]+)'), 'Direct / email')`;

export async function referrers(f: Filters): Promise<Row[]> {
  const rows = await grouped(f, REFERRER_HOST, 20);
  return rows.filter((r) => r.label !== SITE_HOST).slice(0, 10);
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string | null): string {
  if (!code) return "Unknown";
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export async function countries(f: Filters): Promise<Row[]> {
  const rows = await grouped(f, "country");
  return rows.map((r) => ({ ...r, label: countryName(r.label) }));
}

export async function cities(f: Filters): Promise<Row[]> {
  return grouped(f, "coalesce(city || ', ' || country, country, 'Unknown')");
}

export async function pages(f: Filters): Promise<Row[]> {
  return grouped(f, "path");
}

export async function tokens(f: Filters): Promise<Row[]> {
  const rows = await grouped(f, "coalesce(token, 'No token')");
  return rows;
}

export interface AgentRows {
  browsers: Row[];
  systems: Row[];
  devices: Row[];
}

// Grouped by raw user agent in SQL, then folded into coarse buckets here.
// Visitor counts are summed per bucket, so an IP seen with two user agents
// in the same bucket counts twice; at this traffic level that is negligible.
export async function agents(f: Filters): Promise<AgentRows> {
  const raw = await query<{ ua: string | null; visitors: number; views: number }>(
    `select ua, count(distinct ip)::int as visitors, count(*)::int as views
       from hits where ${viewsWhere(f)} group by ua`,
    [f.start, f.end],
  );
  const fold = (key: keyof Agent): Row[] => {
    const acc = new Map<string, Row>();
    for (const r of raw) {
      const label = parseAgent(r.ua)[key];
      const row = acc.get(label) ?? { label, visitors: 0, views: 0 };
      row.visitors += r.visitors;
      row.views += r.views;
      acc.set(label, row);
    }
    return [...acc.values()].sort((a, b) => b.visitors - a.visitors || b.views - a.views);
  };
  return { browsers: fold("browser"), systems: fold("os"), devices: fold("device") };
}

export async function clicks(f: Filters): Promise<Row[]> {
  return query<Row>(
    `select coalesce(name, href, 'Unnamed') as label,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from events
      where ts >= $1 and ts < $2 and type = 'click' ${botWhere(f)}
      group by 1
      order by views desc
      limit 10`,
    [f.start, f.end],
  );
}

// Always over all traffic: shows what the bot filter removed and why.
export async function botReasons(f: Filters): Promise<Row[]> {
  return query<Row>(
    `select coalesce(bot_reason, 'unknown') as label,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from hits
      where ts >= $1 and ts < $2 and is_bot
      group by 1
      order by views desc
      limit 10`,
    [f.start, f.end],
  );
}

export interface Visit {
  ip: string | null;
  startedMs: number;
  endedMs: number;
  hits: number;
  paths: string[];
  country: string | null;
  city: string | null;
  ua: string | null;
  token: string | null;
  referer: string | null;
  botHits: number;
  reasons: string[];
  clicks: number;
}

// Hits from one IP with no gap longer than 30 minutes form one visit.
export async function visits(f: Filters, limit = 50): Promise<Visit[]> {
  const rows = await query<{
    ip: string | null;
    started_ms: number;
    ended_ms: number;
    hits: number;
    paths: string[];
    country: string | null;
    city: string | null;
    ua: string | null;
    token: string | null;
    referer: string | null;
    bot_hits: number;
    reasons: string[];
    clicks: number;
  }>(
    `with h as (
       select ts, path, ip, country, city, ua, token, referer, is_bot, bot_reason,
              case when ts - lag(ts) over (partition by ip order by ts) <= interval '30 minutes'
                   then 0 else 1 end as fresh
         from hits
        where ts >= $1 and ts < $2 ${botWhere(f)}
     ),
     n as (select *, sum(fresh) over (partition by ip order by ts) as visit from h),
     v as (
       select ip, visit,
              min(ts) as started, max(ts) as ended,
              count(*)::int as hits,
              array_agg(path order by ts) as paths,
              max(country) as country, max(city) as city,
              (array_agg(ua order by ts))[1] as ua,
              max(token) as token,
              (array_agg(referer order by ts) filter (where referer is not null))[1] as referer,
              count(*) filter (where is_bot)::int as bot_hits,
              array_remove(array_agg(distinct bot_reason), null) as reasons
         from n
        group by ip, visit
     )
     select v.ip, v.hits, v.paths, v.country, v.city, v.ua, v.token, v.referer,
            v.bot_hits, v.reasons,
            (extract(epoch from v.started) * 1000)::float8 as started_ms,
            (extract(epoch from v.ended) * 1000)::float8 as ended_ms,
            (select count(*)::int from events e
              where e.ip = v.ip and e.type = 'click'
                and e.ts between v.started and v.ended + interval '30 minutes') as clicks
       from v
      order by v.started desc
      limit ${limit}`,
    [f.start, f.end],
  );
  return rows.map((r) => ({
    ip: r.ip,
    startedMs: r.started_ms,
    endedMs: r.ended_ms,
    hits: r.hits,
    paths: r.paths,
    country: r.country,
    city: r.city,
    ua: r.ua,
    token: r.token,
    referer: r.referer,
    botHits: r.bot_hits,
    reasons: r.reasons,
    clicks: r.clicks,
  }));
}
