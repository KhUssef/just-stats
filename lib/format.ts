// Display formatting shared by the dashboard components.

const TZ = process.env.STATS_TZ ?? "Africa/Tunis";

export function number(n: number): string {
  return new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard" }).format(n);
}

export function percent(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// Relative change between two totals, or null when there is no baseline.
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export function dateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);
}

export function clock(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(ms);
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Collapses consecutive repeats: ["/", "/", "/cv"] -> ["/", "/cv"].
export function journey(paths: string[]): string[] {
  return paths.filter((p, i) => i === 0 || p !== paths[i - 1]);
}
