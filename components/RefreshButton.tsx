"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Re-runs the dashboard queries on the server and swaps in the fresh numbers
// without a full page reload, keeping the current filters.
export function RefreshButton({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-busy={pending}
      title={`Data loaded at ${loadedAt}`}
      className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:text-ink disabled:opacity-60"
    >
      <svg
        viewBox="0 0 16 16"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className={pending ? "animate-spin" : undefined}
      >
        <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
        <path d="M13.5 2.5v3h-3" />
      </svg>
      {pending ? "Refreshing" : "Refresh"}
      <span className="tabular-nums text-ink-3">{loadedAt}</span>
    </button>
  );
}
