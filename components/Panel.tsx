"use client";

import { useState } from "react";
import type { Row } from "@/lib/stats";

// A card listing ranked rows, with a bar behind each row sized by its share
// of the top value. Several lists can share one card as tabs.

export interface Tab {
  name: string;
  rows: Row[];
  metric?: "visitors" | "views";
  metricLabel?: string;
}

export function Panel({ tabs, empty = "No data in this range" }: { tabs: Tab[]; empty?: string }) {
  const [current, setCurrent] = useState(0);
  const tab = tabs[current];
  const metric = tab.metric ?? "visitors";
  const max = Math.max(1, ...tab.rows.map((r) => r[metric]));

  return (
    <section className="flex min-h-80 flex-col rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4">
        <div role="tablist" className="flex gap-4">
          {tabs.map((t, i) => (
            <button
              key={t.name}
              role="tab"
              type="button"
              aria-selected={i === current}
              onClick={() => setCurrent(i)}
              className={`-mb-px border-b-2 py-3 text-sm ${
                i === current ? "border-ink font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink-2"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <span className="text-xs uppercase tracking-wide text-ink-3">{tab.metricLabel ?? "Visitors"}</span>
      </div>

      {tab.rows.length === 0 ? (
        <p className="m-auto p-6 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1 p-2">
          {tab.rows.map((r) => (
            <li key={r.label} className="relative flex items-center justify-between rounded px-2 py-1.5 text-sm">
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 rounded bg-bar"
                style={{ width: `${(r[metric] / max) * 100}%` }}
              />
              <span className="relative truncate pr-4 text-ink" title={r.label}>
                {r.label}
              </span>
              <span className="relative tabular-nums text-ink-2">{r[metric]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
