import Link from "next/link";
import { hasSupabaseCreds } from "@/lib/db/client";
import { getDashboard, type DashboardData } from "@/lib/db/repos";
import { CATEGORY_LABELS } from "@config/scoring";
import { Bars, Sparkline, StatCard } from "@/components/Charts";

export const dynamic = "force-dynamic";

function label(c: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[c] ?? c.replace(/_/g, " ");
}

export default async function DashboardPage() {
  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-6 text-sm text-zinc-400">NO DATA — needs creds (Supabase)</p>
      </main>
    );
  }

  let d: DashboardData | null = null;
  let error: string | null = null;
  try {
    d = await getDashboard();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error || !d) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-6 rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {error ?? "no data"}. Apply migrations and run <code>npm run pipeline</code>.
        </p>
      </main>
    );
  }

  const t = d.totals;
  const commentRate = t.scored > 0 ? Math.round((t.commented / t.scored) * 100) : 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Your Reddit marketing funnel at a glance.</p>
        </div>
        <a
          href="/api/export/opportunities"
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          export CSV
        </a>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="scored" value={t.scored} />
        <StatCard label="in queue" value={t.queueNew} />
        <StatCard label={`high-value (≥${60})`} value={t.highValue} />
        <StatCard label="commented" value={t.commented} hint={`${commentRate}% of scored`} />
        <StatCard label="competitor-present" value={t.competitorPresent} />
        <StatCard label="LLM tokens" value={`${(d.usage.promptTokens + d.usage.completionTokens).toLocaleString()}`} hint={`${d.usage.calls} calls`} />
      </section>

      {d.spikes.length > 0 && (
        <section className="mb-8 rounded-lg border border-amber-900/40 bg-amber-950/10 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-400">
            📈 Trending now
          </h2>
          <div className="flex flex-wrap gap-2">
            {d.spikes.map((s) => (
              <span key={s.subreddit} className="rounded-md border border-amber-800/50 px-2 py-1 text-sm text-amber-200">
                r/{s.subreddit} <span className="text-amber-500/80">{s.today} today · {s.ratio}× baseline</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Funnel</h2>
          <Bars
            items={[
              { label: "new", value: t.queueNew },
              { label: "saved", value: t.saved },
              { label: "commented", value: t.commented },
              { label: "dismissed", value: t.dismissed },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Themes</h2>
          {d.categories.length ? (
            <Bars
              color="bg-fuchsia-600"
              items={d.categories.map((c) => ({ label: label(c.category), value: c.n, right: `${c.n} · avg ${c.avgTotal}` }))}
            />
          ) : (
            <p className="text-sm text-zinc-600">No scored posts yet.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Top subreddits</h2>
          {d.subreddits.length ? (
            <Bars
              color="bg-emerald-600"
              items={d.subreddits.map((s) => ({ label: `r/${s.subreddit}`, value: s.n, right: `${s.n} · avg ${s.avgTotal}` }))}
            />
          ) : (
            <p className="text-sm text-zinc-600">No data yet.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Sentiment</h2>
          <Bars
            color="bg-amber-600"
            items={["positive", "neutral", "negative"].map((s) => ({
              label: s,
              value: d.sentiment.find((x) => x.sentiment === s)?.n ?? 0,
            }))}
          />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Ingest volume (30d)
        </h2>
        <div className="rounded-lg border border-zinc-800 p-4">
          <Sparkline values={d.dailyVolume.map((v) => v.n)} />
          <div className="mt-1 flex justify-between text-xs text-zinc-600">
            <span>{d.dailyVolume[0]?.day ?? ""}</span>
            <span>{d.dailyVolume[d.dailyVolume.length - 1]?.day ?? ""}</span>
          </div>
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-600">
        Open the <Link href="/" className="text-sky-400 hover:underline">inbox</Link> to act on opportunities.
      </p>
    </main>
  );
}
