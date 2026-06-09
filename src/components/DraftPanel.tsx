"use client";

import { useState } from "react";
import type { DraftComment } from "@/lib/types";

export function DraftPanel({
  postId,
  initialDrafts,
}: {
  postId: string;
  initialDrafts: DraftComment[];
}) {
  const [drafts, setDrafts] = useState<DraftComment[]>(initialDrafts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${postId}/drafts`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; reason?: string; error?: string; drafts?: DraftComment[] };
      if (!json.ok) {
        setError(json.reason ?? json.error ?? "failed to generate");
        return;
      }
      // newest first
      setDrafts([...(json.drafts ?? []), ...drafts]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copy(d: DraftComment) {
    try {
      await navigator.clipboard.writeText(d.body);
      setCopied(d.id);
      setTimeout(() => setCopied((c) => (c === d.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md border border-sky-700/60 bg-sky-900/30 px-3 py-1.5 text-sm text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
        >
          {loading ? "generating…" : drafts.length ? "regenerate drafts" : "generate drafts"}
        </button>
        <span className="text-xs text-zinc-600">drafts are suggestions you edit — nothing is posted</span>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {drafts.length === 0 ? (
        <p className="text-sm text-zinc-500">No drafts yet.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <li key={d.id} className="rounded-lg border border-zinc-800 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                {d.mentionsIro ? (
                  <span className="rounded bg-sky-900/40 px-1.5 py-0.5 text-sky-300">mentions Iro (disclosed)</span>
                ) : (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5">helpful-only</span>
                )}
                {d.model && <span>{d.model}</span>}
                <button
                  onClick={() => copy(d)}
                  className="ml-auto rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {copied === d.id ? "copied!" : "copy"}
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{d.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
