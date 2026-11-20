import { change, number, percent } from "@/lib/format";

// One headline total with its change against the previous period of the
// same length. `lowerIsBetter` flips which direction reads as good.

export function Kpi({
  label,
  value,
  previous,
  asPercent = false,
  lowerIsBetter = false,
}: {
  label: string;
  value: number;
  previous: number;
  asPercent?: boolean;
  lowerIsBetter?: boolean;
}) {
  const delta = asPercent ? value - previous : change(value, previous);
  const good = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0);
  const shown = asPercent ? percent(value) : number(value);

  return (
    <div className="flex flex-col gap-1 px-4 py-4">
      <span className="text-sm text-ink-2">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{shown}</span>
        {delta !== null && delta !== 0 && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${good ? "text-good" : "text-bad"}`}
            title="Change against the previous period of the same length"
          >
            {delta > 0 ? "Up " : "Down "}
            {asPercent ? `${Math.abs(Math.round(delta * 100))} pts` : percent(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}
