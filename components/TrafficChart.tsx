"use client";

import { useEffect, useRef, useState } from "react";
import type { Bucket } from "@/lib/range";
import type { Point } from "@/lib/stats";

// Stacked bar chart of page views per bucket: people at the base, bots on
// top, each series drawn only when shown. Hovering or focusing a column
// shows its exact numbers.

const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Keys are wall-clock strings already in the dashboard time zone.
function label(key: string, bucket: Bucket): string {
  const [date, time] = key.split("T");
  const [, m, d] = date.split("-").map(Number);
  return bucket === "hour" ? time : `${d} ${MONTHS[m - 1]}`;
}

function niceMax(n: number): number {
  if (n <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * step >= n) return k * step;
  return 10 * step;
}

// Rectangle with only its top corners rounded.
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function TrafficChart({
  points,
  bucket,
  showHumans,
  showBots,
}: {
  points: Point[];
  bucket: Bucket;
  showHumans: boolean;
  showBots: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const people = (p: Point) => (showHumans ? p.humans : 0);
  const robots = (p: Point) => (showBots ? p.bots : 0);
  const total = (p: Point) => people(p) + robots(p);
  const max = niceMax(Math.max(0, ...points.map(total)));
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = points.length ? plotW / points.length : 0;
  const barW = Math.max(1, Math.min(28, slot * 0.7));
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 64))));
  const hovered = active === null ? null : points[active];

  return (
    <div ref={box} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Page views per ${bucket}`}
        className="block overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--border)"
              strokeDasharray={t === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={11}
              fill="var(--text-3)"
              className="tabular-nums"
            >
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const h = people(p);
          const b = robots(p);
          const humanTop = y(h);
          const botTop = y(h + b);
          const showBot = b > 0;
          const humanH = y(0) - humanTop;
          // 2px surface gap between the stacked segments.
          const botH = Math.max(0, humanTop - botTop - (h > 0 ? 2 : 0));
          return (
            <g key={p.key} opacity={active === null || active === i ? 1 : 0.45}>
              {h > 0 && (
                <path
                  d={showBot ? `M${x},${y(0)}V${humanTop}H${x + barW}V${y(0)}Z` : topRounded(x, humanTop, barW, humanH, 4)}
                  fill="var(--series-human)"
                />
              )}
              {showBot && botH > 0 && <path d={topRounded(x, botTop, barW, botH, 4)} fill="var(--series-bot)" />}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                  {label(p.key, bucket)}
                </text>
              )}
              <rect
                x={PAD.left + i * slot}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                aria-label={[
                  label(p.key, bucket),
                  showHumans ? `${p.humans} human views` : null,
                  showBots ? `${p.bots} bot views` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && active !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(Math.max(0, PAD.left + active * slot + slot / 2 - 72), Math.max(0, width - 150)),
          }}
        >
          <div className="mb-1 font-medium text-ink">
            {bucket === "hour" ? hovered.key.replace("T", " ") : label(hovered.key, bucket)}
          </div>
          {showHumans && (
            <div className="flex items-center justify-between gap-4 text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-human" aria-hidden />
                People
              </span>
              <span className="tabular-nums text-ink">{hovered.humans}</span>
            </div>
          )}
          {showBots && (
            <div className="flex items-center justify-between gap-4 text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-bot" aria-hidden />
                Bots
              </span>
              <span className="tabular-nums text-ink">{hovered.bots}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
