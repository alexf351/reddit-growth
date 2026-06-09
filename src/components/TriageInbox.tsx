"use client";

import { useMemo, useState } from "react";
import type { MentionFit, TriageItem, TriageStatus } from "@/lib/types";

function formatAge(createdUtc: number): string {
  const hours = (Date.now() / 1000 - createdUtc) / 3600;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function scoreColor(total: number): string {
  if (total >= 70) return "bg-emerald-600/20 text-emerald-300 border-emerald-700/50";
  if (total >= 50) return "bg-amber-600/20 text-amber-300 border-amber-700/50";
  return "bg-zinc-700/30 text-zinc-400 border-zinc-700";
}

type StatusView = "active" | "all" | TriageStatus;
type MentionFilter = "all" | MentionFit;

export function TriageInbox({ initialItems }: { initialItems: TriageItem[] }) {
  const [items, setItems] = useState<TriageItem[]>(initialItems);
  const [subreddit, setSubreddit] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [mention, setMention] = useState<MentionFilter>("all");
  const [statusView, setStatusView] = useState<StatusView>("active");
  const [busy, setBusy] = useState<string | null>(null);

  const subreddits = useMemo(
    () => [...new Set(initialItems.map((i) => i.subreddit))].sort((a, b) => a.localeCompare(b)),
    [initialItems],
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (subreddit !== "all" && i.subreddit !== subreddit) return false;
      if (i.total < minScore) return false;
      if (mention !== "all" && i.mentionFit !== mention) return false;
      if (statusView === "active") return i.status === "new" || i.status === "saved";
      if (statusView === "all") return true;
      return i.status === statusView;
    });
  }, [items, subreddit, minScore, mention, statusView]);

  async function setStatus(postId: string, status: TriageStatus) {
    const prev = items;
    setBusy(postId);
    setItems((cur) => cur.map((i) => (i.postId === postId ? { ...i, status } : i)));
    try {
      const res = await fetch(`/api/items/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setItems(prev); // revert on failure
    } finally {
      setBusy(null);
    }
  }

  const selectCls =
    "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select className={selectCls} value={subreddit} onChange={(e) => setSubreddit(e.target.value)}>
          <option value="all">all subreddits</option>
          {subreddits.map((s) => (
            <option key={s} value={s}>
              r/{s}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={mention}
          onChange={(e) => setMention(e.target.value as MentionFilter)}
        >
          <option value="all">any mention-fit</option>
          <option value="iro_relevant">iro-relevant</option>
          <option value="helpful_only">helpful-only</option>
        </select>
        <select
          className={selectCls}
          value={statusView}
          onChange={(e) => setStatusView(e.target.value as StatusView)}
        >
          <option value="active">active (new + saved)</option>
          <option value="new">new</option>
          <option value="saved">saved</option>
          <option value="commented">commented</option>
          <option value="dismissed">dismissed</option>
          <option value="all">all</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          min score
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
            className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
          />
        </label>
        <span className="ml-auto text-sm text-zinc-500">{filtered.length} shown</span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No items match. Run <code className="text-zinc-300">npm run ingest</code> then{" "}
          <code className="text-zinc-300">npm run score</code> to populate the queue.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((i) => (
            <li key={i.postId} className="rounded-lg border border-zinc-800 p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${scoreColor(
                    i.total,
                  )}`}
                  title={`relevance ${i.relevance.toFixed(2)} · intent ${i.intent.toFixed(
                    2,
                  )} · commentability ${i.commentability.toFixed(2)}${
                    i.competitorBoost ? ` · +${i.competitorBoost} competitor` : ""
                  }${i.saturationPenalty ? ` · ${i.saturationPenalty} saturation` : ""}${
                    i.freshnessBonus ? ` · +${i.freshnessBonus} fresh` : ""
                  }`}
                >
                  {i.total}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={i.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium leading-snug hover:underline"
                  >
                    {i.title}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>r/{i.subreddit}</span>
                    <span>{formatAge(i.createdUtc)} old</span>
                    <span>{i.numComments} comments</span>
                    <span
                      className={
                        i.mentionFit === "iro_relevant" ? "text-sky-400" : "text-zinc-500"
                      }
                    >
                      {i.mentionFit === "iro_relevant" ? "iro-relevant" : "helpful-only"}
                    </span>
                    {i.competitorCount > 0 &&
                      (i.competitors[0]?.commentPermalink ? (
                        <a
                          href={i.competitors[0].commentPermalink}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded bg-fuchsia-900/40 px-1.5 py-0.5 text-fuchsia-300 hover:bg-fuchsia-900/60"
                        >
                          competitor: u/{i.competitors[0].username}
                          {i.competitorCount > 1 ? ` +${i.competitorCount - 1}` : ""}
                        </a>
                      ) : (
                        <span className="rounded bg-fuchsia-900/40 px-1.5 py-0.5 text-fuchsia-300">
                          competitor present
                        </span>
                      ))}
                    {i.promoReplyCount > 0 && (
                      <span className="text-amber-400">{i.promoReplyCount} promo replies</span>
                    )}
                    <span
                      className={
                        i.selfPromoAllowed === true
                          ? "text-emerald-400"
                          : i.selfPromoAllowed === false
                            ? "text-rose-400"
                            : "text-zinc-600"
                      }
                      title="subreddit self-promo rule"
                    >
                      {i.selfPromoAllowed === true
                        ? "promo ok"
                        : i.selfPromoAllowed === false
                          ? "promo: strict"
                          : "promo: unknown"}
                    </span>
                    {i.status !== "new" && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">{i.status}</span>
                    )}
                    {(i.locked || i.removed) && (
                      <span className="text-rose-400">{i.locked ? "locked" : "removed"}</span>
                    )}
                  </div>
                  {i.why && <p className="mt-2 text-sm text-zinc-400">{i.why}</p>}
                </div>
              </div>

              <div className="mt-3 flex gap-2 pl-12">
                {(["commented", "saved", "dismissed"] as TriageStatus[]).map((s) => (
                  <button
                    key={s}
                    disabled={busy === i.postId}
                    onClick={() => setStatus(i.postId, i.status === s ? "new" : s)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-50 ${
                      i.status === s
                        ? "border-zinc-500 bg-zinc-700 text-zinc-100"
                        : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                    }`}
                  >
                    {s === "commented" ? "mark commented" : s === "saved" ? "save" : "dismiss"}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
