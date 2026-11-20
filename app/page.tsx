import Link from "next/link";
import { Kpi } from "@/components/Kpi";
import { Panel } from "@/components/Panel";
import { Rules } from "@/components/Rules";
import { TrafficChart } from "@/components/TrafficChart";
import { Visits } from "@/components/Visits";
import { href, parseFilters, RANGES, TRAFFIC } from "@/lib/range";
import * as stats from "@/lib/stats";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Dashboard({ searchParams }: Props) {
  const f = parseFilters(await searchParams);
  const fl = await stats.flags(f);
  const [k, points, pages, referrers, countries, cities, tokens, agents, clicks, reasons, visits] =
    await Promise.all([
      stats.kpis(f, fl),
      stats.series(f, fl),
      stats.pages(f, fl),
      stats.referrers(f, fl),
      stats.countries(f, fl),
      stats.cities(f, fl),
      stats.tokens(f, fl),
      stats.agents(f, fl),
      stats.clicks(f, fl),
      stats.botReasons(f, fl),
      stats.visits(f, fl),
    ]);
  const showHumans = f.traffic !== "bots";
  const showBots = f.traffic !== "humans";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">just-stats</h1>
          <p className="text-sm text-ink-3">Traffic on the portfolio, with bots split out</p>
        </div>
        <nav aria-label="Filters" className="flex flex-wrap gap-2">
          <div className="flex rounded-md border border-line bg-surface p-0.5 text-sm">
            {TRAFFIC.map((t) => (
              <Link
                key={t.key}
                href={href(f, { traffic: t.key })}
                aria-current={f.traffic === t.key ? "page" : undefined}
                className={`rounded px-3 py-1 ${f.traffic === t.key ? "bg-bar font-medium text-ink" : "text-ink-3 hover:text-ink-2"}`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="flex rounded-md border border-line bg-surface p-0.5 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={href(f, { range: r.key })}
                aria-current={f.range.key === r.key ? "page" : undefined}
                title={r.label}
                className={`rounded px-3 py-1 ${f.range.key === r.key ? "bg-bar font-medium text-ink" : "text-ink-3 hover:text-ink-2"}`}
              >
                {r.key}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <section className="rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
          <Kpi label="Visitors" value={k.current.visitors} previous={k.previous.visitors} />
          <Kpi label="Page views" value={k.current.views} previous={k.previous.views} />
          <Kpi label="Clicks" value={k.current.clicks} previous={k.previous.clicks} />
          <Kpi label="Bot share" value={k.current.botShare} previous={k.previous.botShare} asPercent lowerIsBetter />
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <div className="mb-2 flex gap-4 px-2 text-xs text-ink-2">
            {showHumans && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-human" aria-hidden /> People
              </span>
            )}
            {showBots && (
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-bot" aria-hidden /> Bots
              </span>
            )}
          </div>
          <TrafficChart points={points} bucket={f.range.bucket} showHumans={showHumans} showBots={showBots} />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel tabs={[{ name: "Pages", rows: pages }, { name: "Clicks", rows: clicks, metric: "views", metricLabel: "Clicks" }]} />
        <Panel tabs={[{ name: "Referrers", rows: referrers }, { name: "Outreach tokens", rows: tokens }]} />
        <Panel tabs={[{ name: "Countries", rows: countries }, { name: "Cities", rows: cities }]} />
        <Panel
          tabs={[
            { name: "Devices", rows: agents.devices },
            { name: "Browsers", rows: agents.browsers },
            { name: "OS", rows: agents.systems },
          ]}
        />
      </div>

      <Panel
        tabs={[{ name: "Why traffic was flagged as bots", rows: reasons, metric: "views", metricLabel: "Requests" }]}
        empty="No bot traffic in this range"
      />

      <Visits visits={visits} />

      <Rules />
    </main>
  );
}
