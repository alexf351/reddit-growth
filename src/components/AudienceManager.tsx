"use client";

import { useState } from "react";
import type { Audience } from "@/lib/types";

export function AudienceManager({
  initial,
  allSubreddits,
}: {
  initial: Audience[];
  allSubreddits: string[];
}) {
  const [audiences, setAudiences] = useState<Audience[]>(initial);
  const [name, setName] = useState("");
  const [subs, setSubs] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const subreddits = subs
      .split(/[\s,]+/)
      .map((s) => s.replace(/^\/?r\//i, "").trim())
      .filter(Boolean);
    if (!name.trim() || subreddits.length === 0) {
      setError("name and at least one subreddit required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), subreddits }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; audience?: Audience };
      if (!json.ok || !json.audience) throw new Error(json.error ?? "failed");
      setAudiences((a) => [...a, json.audience!]);
      setName("");
      setSubs("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const prev = audiences;
    setAudiences((a) => a.filter((x) => x.id !== id));
    try {
      await fetch(`/api/audiences/${id}`, { method: "DELETE" });
    } catch {
      setAudiences(prev);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-zinc-800 p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">New audience</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name (e.g. AI learners)"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 sm:w-48"
          />
          <input
            value={subs}
            onChange={(e) => setSubs(e.target.value)}
            placeholder="subreddits, comma or space separated (e.g. ChatGPT, learnprogramming)"
            className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600"
          />
          <button
            onClick={create}
            disabled={busy}
            className="rounded-md border border-sky-700/60 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
          >
            create
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        {allSubreddits.length > 0 && (
          <p className="mt-2 text-xs text-zinc-600">
            in your data: {allSubreddits.slice(0, 20).map((s) => `r/${s}`).join("  ·  ")}
          </p>
        )}
      </div>

      {audiences.length === 0 ? (
        <p className="text-sm text-zinc-500">No audiences yet. Create one to scope the inbox to a subreddit group.</p>
      ) : (
        <ul className="space-y-2">
          {audiences.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3">
              <div className="min-w-0">
                <span className="font-medium">{a.name}</span>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{a.subreddits.map((s) => `r/${s}`).join("  ·  ")}</p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
