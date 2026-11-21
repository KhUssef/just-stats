import { query } from "@/lib/db";
import { networkOf } from "@/lib/iprules";
import type { Filters } from "@/lib/range";
import { parseAgent, type Agent } from "@/lib/ua";

// Every number on the dashboard comes from here.
//
// A "page view" is a GET in the hits table that was a real navigation:
// Sec-Fetch-Mode is "navigate", or absent (old clients and most bots).
// Background fetches a page makes of itself (Sec-Fetch-Mode "cors") are not
// views. A "visitor" is a distinct IP.
//
// A request counts as a bot when any rule matches, checked in this order:
//   1. the portfolio flagged it from its headers (hits.is_bot, bot_reason);
//   2. its IP is in a data-centre network (lib/iprules.ts) -> "ip:<network>";
//   3. its IP is an echo: it opened a page with no referrer and no
//      originating site less than ECHO_SECONDS after a different, unflagged
//      IP opened the same page -> "echo". Link-checking security tools do
//      this, replaying a person's visit from another machine.
// Rules 2 and 3 are applied here at read time: the dashboard never writes.

const TZ = process.env.STATS_TZ ?? "Africa/Tunis";
const SITE_HOST = process.env.SITE_HOST ?? "khalifa-youssef.vercel.app";
export const ECHO_SECONDS = 15;

const NAV = "method = 'GET' and (sf_mode is null or sf_mode = 'navigate')";

// Bots flagged at read time, passed into every query as $3 (IPs) and $4
// (reasons). Covers [prevStart, end) so period comparisons agree.
export interface Flags {
  ips: string[];
  reasons: string[];
}

export async function flags(f: Filters): Promise<Flags> {
  const [candidates, echoes] = await Promise.all([
    query<{ ip: string }>(
      `select ip from hits where ts >= $1 and ts < $2 and not is_bot and ip is not null
       union
       select ip from events where ts >= $1 and ts < $2 and not is_bot and ip is not null`,
      [f.prevStart, f.end],
    ),
    query<{ ip: string }>(
      `select distinct h.ip from hits h
        where h.ts >= $1 and h.ts < $2 and not h.is_bot and h.ip is not null
          and h.sf_site = 'none' and h.referer is null
          and exists (
            select 1 from hits o
             where o.path = h.path and o.ip is distinct from h.ip and not o.is_bot
               and o.ts < h.ts and o.ts >= h.ts - make_interval(secs => $3))`,
      [f.prevStart, f.end, ECHO_SECONDS],
    ),
  ]);
  const reasons = new Map<string, string>();
  for (const { ip } of candidates) {
    const network = networkOf(ip);
    if (network) reasons.set(ip, `ip:${network}`);
  }
  for (const { ip } of echoes) {
    if (!reasons.has(ip)) reasons.set(ip, "echo");
  }
  return { ips: [...reasons.keys()], reasons: [...reasons.values()] };
}

// Hits or events in [$1, $2) with the effective `bot` flag and `reason`,
// limited to the selected country. The country code is validated by
// parseFilters as two letters A-Z, so it is safe to inline.
function source(table: "hits" | "events", f: Filters): string {
  const country = f.country ? ` and r.country = '${f.country}'` : "";
  return `src as (
    select r.*, (r.is_bot or x.ip is not null) as bot,
           case when r.is_bot then r.bot_reason else x.reason end as reason
      from ${table} r
      left join unnest($3::text[], $4::text[]) as x(ip, reason) on x.ip = r.ip
     where r.ts >= $1 and r.ts < $2${country})`;
}

function traffic(f: Filters): string {
  return f.traffic === "humans" ? "not bot" : f.traffic === "bots" ? "bot" : "true";
}

function params(from: Date, to: Date, fl: Flags): unknown[] {
  return [from, to, fl.ips, fl.reasons];
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

async function totals(f: Filters, fl: Flags, from: Date, to: Date): Promise<Totals> {
  const t = traffic(f);
  const [[hits], [events]] = await Promise.all([
    query<{ visitors: number; views: number; all_views: number; bot_views: number }>(
      `with ${source("hits", f)}
       select count(distinct ip) filter (where ${NAV} and ${t})::int as visitors,
              count(*) filter (where ${NAV} and ${t})::int as views,
              count(*) filter (where ${NAV})::int as all_views,
              count(*) filter (where ${NAV} and bot)::int as bot_views
         from src`,
      params(from, to, fl),
    ),
    query<{ clicks: number }>(
      `with ${source("events", f)}
       select count(*)::int as clicks from src where type = 'click' and ${t}`,
      params(from, to, fl),
    ),
  ]);
  return {
    visitors: hits.visitors,
    views: hits.views,
    clicks: events.clicks,
    botShare: hits.all_views === 0 ? 0 : hits.bot_views / hits.all_views,
  };
}

export async function kpis(f: Filters, fl: Flags): Promise<Kpis> {
  const [current, previous] = await Promise.all([
    totals(f, fl, f.start, f.end),
    totals(f, fl, f.prevStart, f.start),
  ]);
  return { current, previous };
}

export interface Point {
  key: string;
  humans: number;
  bots: number;
}

// One point per hour or day in the window, zero-filled, in the STATS_TZ zone.
export async function series(f: Filters, fl: Flags): Promise<Point[]> {
  const unit = f.range.bucket;
  return query<Point>(
    `with ${source("hits", f)},
     b as (
       select generate_series(
                date_trunc('${unit}', $1::timestamptz at time zone $5),
                date_trunc('${unit}', $2::timestamptz at time zone $5),
                interval '1 ${unit}') as t
     )
     select to_char(b.t, 'YYYY-MM-DD"T"HH24:MI') as key,
            count(s.id) filter (where not s.bot)::int as humans,
            count(s.id) filter (where s.bot)::int as bots
       from b
       left join src s
         on date_trunc('${unit}', s.ts at time zone $5) = b.t
        and s.method = 'GET' and (s.sf_mode is null or s.sf_mode = 'navigate')
      group by b.t
      order by b.t`,
    [...params(f.start, f.end, fl), TZ],
  );
}

export interface Row {
  label: string;
  // Country code the row belongs to, when the row is about a place.
  code?: string | null;
  visitors: number;
  views: number;
}

async function grouped(f: Filters, fl: Flags, expr: string, limit = 10, code = "null"): Promise<Row[]> {
  return query<Row>(
    `with ${source("hits", f)}
     select ${expr} as label, ${code} as code,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from src
      where ${NAV} and ${traffic(f)}
      group by 1, 2
      order by visitors desc, views desc
      limit ${limit}`,
    params(f.start, f.end, fl),
  );
}

const REFERRER_HOST = `coalesce(substring(referer from '^https?://([^/:?#]+)'), 'Direct / email')`;

export async function referrers(f: Filters, fl: Flags): Promise<Row[]> {
  const rows = await grouped(f, fl, REFERRER_HOST, 20);
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

export async function countries(f: Filters, fl: Flags): Promise<Row[]> {
  const rows = await grouped(f, fl, "country", 12, "country");
  return rows.map((r) => ({ ...r, label: countryName(r.code ?? null) }));
}

export async function cities(f: Filters, fl: Flags): Promise<Row[]> {
  const rows = await grouped(f, fl, "coalesce(city, 'Unknown city')", 10, "country");
  return rows.map((r) => ({ ...r, label: `${r.label}, ${countryName(r.code ?? null)}` }));
}

export const COUNTRY_SLOTS = 7;

// The countries that own a colour: the ones with the most visitors over the
// last 90 days. Ranked over a fixed window, so a country keeps its colour
// whatever range or filter is on screen.
export async function countryPalette(now: Date): Promise<string[]> {
  const rows = await query<{ country: string }>(
    `select country from hits
      where ts >= $1 and country is not null and not is_bot
      group by country
      order by count(distinct ip) desc, country
      limit ${COUNTRY_SLOTS}`,
    [new Date(now.getTime() - 90 * 24 * 3600_000)],
  );
  return rows.map((r) => r.country);
}

export async function pages(f: Filters, fl: Flags): Promise<Row[]> {
  return grouped(f, fl, "path");
}

export async function tokens(f: Filters, fl: Flags): Promise<Row[]> {
  return grouped(f, fl, "coalesce(token, 'No token')");
}

export interface AgentRows {
  browsers: Row[];
  systems: Row[];
  devices: Row[];
}

// Grouped by raw user agent in SQL, then folded into coarse buckets here.
// Visitor counts are summed per bucket, so an IP seen with two user agents
// in the same bucket counts twice; at this traffic level that is negligible.
export async function agents(f: Filters, fl: Flags): Promise<AgentRows> {
  const raw = await query<{ ua: string | null; visitors: number; views: number }>(
    `with ${source("hits", f)}
     select ua, count(distinct ip)::int as visitors, count(*)::int as views
       from src where ${NAV} and ${traffic(f)} group by ua`,
    params(f.start, f.end, fl),
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

export async function clicks(f: Filters, fl: Flags): Promise<Row[]> {
  return query<Row>(
    `with ${source("events", f)}
     select coalesce(name, href, 'Unnamed') as label,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from src
      where type = 'click' and ${traffic(f)}
      group by 1
      order by views desc
      limit 10`,
    params(f.start, f.end, fl),
  );
}

// Always over bot traffic, whatever the filter: what was removed and why.
export async function botReasons(f: Filters, fl: Flags): Promise<Row[]> {
  return query<Row>(
    `with ${source("hits", f)}
     select coalesce(reason, 'unknown') as label,
            count(distinct ip)::int as visitors,
            count(*)::int as views
       from src
      where bot
      group by 1
      order by views desc
      limit 15`,
    params(f.start, f.end, fl),
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
export async function visits(f: Filters, fl: Flags, limit = 50): Promise<Visit[]> {
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
    `with ${source("hits", f)},
     h as (
       select ts, path, ip, country, city, ua, token, referer, bot, reason,
              case when ts - lag(ts) over (partition by ip order by ts) <= interval '30 minutes'
                   then 0 else 1 end as fresh
         from src
        where ${traffic(f)}
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
              count(*) filter (where bot)::int as bot_hits,
              array_remove(array_agg(distinct reason), null) as reasons
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
    params(f.start, f.end, fl),
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
