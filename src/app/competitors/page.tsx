import Link from "next/link";
import { hasSupabaseCreds } from "@/lib/db/client";
import { getCompetitorIntel, getPendingSuggestions } from "@/lib/db/repos";
import { SuggestionList } from "@/components/SuggestionList";
import type { CompetitorIntel } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage() {
  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-xl font-semibold">Competitor Intel</h1>
        <div className="mt-6 rounded-lg border border-zinc-800 px-4 py-8 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">NO DATA — needs creds (Supabase)</p>
          <p className="mt-2">
            Configure Supabase, then run <code className="text-zinc-300">npm run mine</code>.
          </p>
        </div>
      </main>
    );
  }

  let intel: CompetitorIntel[] = [];
  let pending: { id: string; type: string; value: string; rationale: string | null }[] = [];
  let error: string | null = null;
  try {
    [intel, pending] = await Promise.all([getCompetitorIntel(), getPendingSuggestions()]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Competitor Intel</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Where rivals are farming, how often, and the patterns they answer. Public comment history
          only — we never contact or interact with these accounts.
        </p>
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          Failed to load: {error}. Have you applied the migrations and run{" "}
          <code>npm run mine</code>?
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Pending suggestions
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Approved items are merged into ingestion automatically — no silent list changes.
        </p>
        <SuggestionList initial={pending} />
      </section>

      <section className="space-y-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Accounts</h2>
        {intel.length === 0 && !error && (
          <p className="rounded-lg border border-zinc-800 px-4 py-6 text-sm text-zinc-500">
            No competitor data yet. Run <code className="text-zinc-300">npm run mine</code>.
          </p>
        )}
        {intel.map((c) => (
          <div key={c.username} className="rounded-lg border border-zinc-800 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">u/{c.username}</h3>
              <div className="flex gap-4 text-xs text-zinc-500">
                <span>{c.totalComments} comments</span>
                <span>{c.commentsPerDay}/day</span>
                <span>
                  {c.medianReplyHours != null ? `~${c.medianReplyHours}h to reply` : "reply speed n/a"}
                </span>
                {c.lastMinedAt && <span>mined {new Date(c.lastMinedAt).toLocaleDateString()}</span>}
              </div>
            </div>

            {c.subMap.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
                  Sub map
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.subMap.map((s) => (
                    <span
                      key={s.subreddit}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                    >
                      r/{s.subreddit} <span className="text-zinc-500">×{s.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {c.recentThreads.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-600">
                  Recent threads they answered
                </p>
                <ul className="space-y-1 text-sm">
                  {c.recentThreads.map((t, i) => (
                    <li key={i} className="truncate text-zinc-400">
                      <a href={t.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                        {t.title}
                      </a>{" "}
                      <span className="text-zinc-600">· r/{t.subreddit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </section>

      <p className="mt-10 text-xs text-zinc-600">
        Competitor-present threads appear in the{" "}
        <Link href="/" className="text-sky-400 hover:underline">
          inbox
        </Link>{" "}
        with a badge so you can out-answer them.
      </p>
    </main>
  );
}
