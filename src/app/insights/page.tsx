import { hasSupabaseCreds } from "@/lib/db/client";
import { getLatestInsights, type InsightRecord } from "@/lib/db/repos";
import { InsightsRunner } from "@/components/InsightsRunner";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-xl font-semibold">Audience Insights</h1>
        <p className="mt-6 text-sm text-zinc-400">NO DATA — needs creds (Supabase)</p>
      </main>
    );
  }

  let insights: InsightRecord[] = [];
  let error: string | null = null;
  try {
    insights = await getLatestInsights();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audience Insights</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The recurring pains and requests your audience keeps raising — clustered from recent
            pain / solution / advice posts.
          </p>
        </div>
        <InsightsRunner />
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {insights.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
          No insights yet. Ingest + score some posts, then hit{" "}
          <span className="text-zinc-300">regenerate insights</span> (or run{" "}
          <code className="text-zinc-300">npm run insights</code>).
        </p>
      ) : (
        <>
          <p className="mb-4 text-xs text-zinc-600">
            Generated {new Date(insights[0].batchAt).toLocaleString()}
          </p>
          <ul className="space-y-4">
            {insights.map((t, i) => (
              <li key={i} className="rounded-lg border border-zinc-800 p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-base font-semibold">{t.theme}</h2>
                  <span className="shrink-0 rounded-full bg-fuchsia-900/40 px-2 py-0.5 text-xs text-fuchsia-200">
                    {t.count} posts
                  </span>
                </div>
                {t.summary && <p className="mt-2 text-sm text-zinc-400">{t.summary}</p>}
                {t.examples.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {t.examples.map((e, j) => (
                      <li key={j} className="truncate text-zinc-500">
                        <a href={e.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                          {e.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
