"use client";

import { useState } from "react";

export interface UISuggestion {
  id: string;
  type: string;
  value: string;
  rationale: string | null;
}

export function SuggestionList({ initial }: { initial: UISuggestion[] }) {
  const [items, setItems] = useState<UISuggestion[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    const prev = items;
    setBusy(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setItems(prev);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 px-4 py-6 text-sm text-zinc-500">
        No pending suggestions. Run <code className="text-zinc-300">npm run mine</code> to generate
        some from competitor activity.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
        >
          <div className="min-w-0">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">{s.type}</span>{" "}
            <span className="font-medium">
              {s.type === "subreddit" ? `r/${s.value}` : `"${s.value}"`}
            </span>
            {s.rationale && <p className="mt-1 text-xs text-zinc-500">{s.rationale}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              disabled={busy === s.id}
              onClick={() => decide(s.id, "approved")}
              className="rounded-md border border-emerald-700/60 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-50"
            >
              approve
            </button>
            <button
              disabled={busy === s.id}
              onClick={() => decide(s.id, "rejected")}
              className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
            >
              reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
