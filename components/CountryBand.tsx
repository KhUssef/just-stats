import Link from "next/link";
import { Flag } from "@/components/Flag";
import { countryColor } from "@/lib/countries";
import { number, percent } from "@/lib/format";
import { href, type Filters } from "@/lib/range";
import type { Row } from "@/lib/stats";

// Share of visitors by country as one segmented bar, with every country
// listed underneath. Selecting a country scopes the whole dashboard to it;
// selecting it again clears the scope.

export function CountryBand({
  rows,
  total,
  palette,
  filters,
}: {
  rows: Row[];
  total: number;
  palette: string[];
  filters: Filters;
}) {
  const listed = rows.reduce((sum, r) => sum + r.visitors, 0);
  const rest = Math.max(0, total - listed);
  const whole = Math.max(1, listed + rest);
  const segments = [
    ...rows.map((r) => ({ key: r.code ?? "unknown", label: r.label, value: r.visitors, color: countryColor(palette, r.code) })),
    ...(rest > 0 ? [{ key: "rest", label: "Other countries", value: rest, color: "var(--country-other)" }] : []),
  ];

  return (
    <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">Where visitors are</h2>
        <p className="text-sm text-ink-3">
          {rows.length === 0
            ? "No visitors in this range"
            : `${number(total)} ${total === 1 ? "visitor" : "visitors"} from ${rows.length} ${rows.length === 1 ? "country" : "countries"}`}
        </p>
      </div>

      {segments.length > 0 && (
        <div className="flex h-10 w-full gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Visitors by country">
          {segments.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value} (${percent(s.value / whole)})`}
              className="h-full min-w-1"
              style={{ flexGrow: s.value, flexBasis: 0, background: s.color }}
            />
          ))}
        </div>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const active = filters.country !== null && filters.country === r.code;
          return (
            <li key={r.code ?? "unknown"}>
              <Link
                href={r.code ? href(filters, { country: active ? null : r.code }) : "#"}
                aria-current={active ? "true" : undefined}
                aria-disabled={!r.code}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-bar ${active ? "bg-bar" : ""} ${r.code ? "" : "pointer-events-none"}`}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: countryColor(palette, r.code) }} />
                <Flag code={r.code} />
                <span className="truncate text-ink">{r.label}</span>
                <span className="ml-auto tabular-nums text-ink-2">{r.visitors}</span>
                <span className="w-10 text-right tabular-nums text-ink-3">{percent(r.visitors / whole)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
