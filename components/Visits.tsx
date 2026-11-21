import Link from "next/link";
import { Flag } from "@/components/Flag";
import { countryColor } from "@/lib/countries";
import { dateTime, duration, journey } from "@/lib/format";
import { href, type Filters } from "@/lib/range";
import { countryName, type Visit } from "@/lib/stats";
import { parseAgent } from "@/lib/ua";

// Recent visits, newest first: one row per IP session, with where it came
// from, what it opened, and whether the bot filter flagged it.

function Status({ visit }: { visit: Visit }) {
  if (visit.botHits === 0) {
    return <span className="rounded bg-bar px-1.5 py-0.5 text-xs font-medium text-human">Person</span>;
  }
  const label = visit.botHits === visit.hits ? "Bot" : "Mixed";
  return (
    <span
      className="rounded border border-line px-1.5 py-0.5 text-xs font-medium text-ink-2"
      title={visit.reasons.join(", ")}
    >
      {label}
    </span>
  );
}

export function Visits({ visits, palette, filters }: { visits: Visit[]; palette: string[]; filters: Filters }) {
  return (
    <section className="rounded-lg border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Recent visits</h2>
      {visits.length === 0 ? (
        <p className="p-6 text-center text-sm text-ink-3">No visits in this range</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs text-ink-3">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2 font-normal">Started</th>
                <th scope="col" className="px-4 py-2 font-normal">Type</th>
                <th scope="col" className="px-4 py-2 font-normal">Location</th>
                <th scope="col" className="px-4 py-2 font-normal">Device</th>
                <th scope="col" className="px-4 py-2 font-normal">Pages</th>
                <th scope="col" className="px-4 py-2 font-normal">From</th>
                <th scope="col" className="px-4 py-2 text-right font-normal">Clicks</th>
                <th scope="col" className="px-4 py-2 text-right font-normal">Length</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => {
                const agent = parseAgent(v.ua);
                return (
                  <tr key={`${v.ip}-${v.startedMs}`} className="border-b border-line last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-ink-2">{dateTime(v.startedMs)}</td>
                    <td className="px-4 py-2.5">
                      <Status visit={v} />
                      {v.reasons.length > 0 && (
                        <div className="mt-1 font-mono text-[11px] text-ink-3">{v.reasons.join(", ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-sm"
                          style={{ background: countryColor(palette, v.country) }}
                        />
                        <Flag code={v.country} />
                        {v.country ? (
                          <Link
                            href={href(filters, { country: v.country })}
                            className="text-ink underline-offset-2 hover:underline"
                            title={`Show only ${countryName(v.country)}`}
                          >
                            {v.city ? `${v.city}, ${countryName(v.country)}` : countryName(v.country)}
                          </Link>
                        ) : (
                          <span className="text-ink">Unknown</span>
                        )}
                      </div>
                      <div className="mt-0.5 pl-9 font-mono text-[11px] text-ink-3">{v.ip ?? "no ip"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-ink-2" title={v.ua ?? undefined}>
                      {agent.browser}
                      <div className="text-[11px] text-ink-3">
                        {agent.os}, {agent.device}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-ink">{journey(v.paths).join("  >  ")}</td>
                    <td className="max-w-48 truncate px-4 py-2.5 text-ink-2" title={v.referer ?? undefined}>
                      {v.token ? <span className="font-mono text-xs">r={v.token}</span> : v.referer ?? "Direct / email"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{v.clicks}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-ink-2">
                      {duration(v.endedMs - v.startedMs)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
