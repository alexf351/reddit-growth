import { credStatus } from "@/lib/env";
import { competitors } from "@config/competitors";
import { targets } from "@config/targets";
import { llmProvider } from "@/lib/llm/provider";
import { hasSupabaseCreds } from "@/lib/db/client";
import { getRecentRuns, getUsageTotals, type IngestRunRecord, type UsageTotals } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-zinc-600"}`}
      aria-hidden
    />
  );
}

export default async function StatusPage() {
  const creds = credStatus();
  const rows = [
    { label: "Reddit API", ok: creds.reddit, note: "REDDIT_CLIENT_ID / SECRET — P0" },
    { label: "Supabase", ok: creds.supabase, note: "SUPABASE_URL / SERVICE_ROLE_KEY — P1" },
    { label: `LLM (${llmProvider()})`, ok: creds.llm, note: "GEMINI_API_KEY or ANTHROPIC_API_KEY — P2" },
    { label: "Resend", ok: creds.resend, note: "RESEND_API_KEY — P4" },
  ];

  let runs: IngestRunRecord[] = [];
  let usage: UsageTotals | null = null;
  if (creds.supabase) {
    try {
      [runs, usage] = await Promise.all([getRecentRuns(12), getUsageTotals()]);
    } catch {
      /* migrations not applied yet — leave activity empty */
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Read-only, human-in-the-loop. Anything unconfigured shows{" "}
          <span className="text-zinc-300">NO DATA — needs creds</span> instead of fake numbers.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Integration status
        </h2>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <StatusDot ok={r.ok} />
                <span className="text-sm">{r.label}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {r.ok ? "configured" : "NO DATA — needs creds"}
                <span className="ml-2 text-zinc-600">({r.note})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {usage && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            LLM usage (cumulative)
          </h2>
          <div className="flex gap-6 rounded-lg border border-zinc-800 px-4 py-3 text-sm">
            <span>
              <span className="text-zinc-500">calls</span> {usage.calls}
            </span>
            <span>
              <span className="text-zinc-500">tokens in</span> {usage.promptTokens.toLocaleString()}
            </span>
            <span>
              <span className="text-zinc-500">tokens out</span> {usage.completionTokens.toLocaleString()}
            </span>
          </div>
        </section>
      )}

      {runs.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Recent runs
          </h2>
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
            {runs.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2">
                <span className="flex items-center gap-3">
                  <StatusDot ok={r.status === "ok"} />
                  <span className="font-medium">{r.kind}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(r.startedAt).toLocaleString()}
                  </span>
                </span>
                <span className="text-xs text-zinc-500">
                  {r.status}
                  {r.counts ? ` · ${Object.entries(r.counts).map(([k, v]) => `${k}:${v}`).join(" ")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Target subreddits ({targets.subreddits.length})
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            {targets.subreddits.map((s) => `r/${s}`).join("  ·  ")}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Tracked competitors ({competitors.length})
          </h2>
          <p className="text-sm leading-relaxed text-zinc-300">
            {competitors.map((c) => `u/${c.username}`).join("  ·  ")}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Keywords ({targets.keywords.length})
        </h2>
        <p className="text-sm leading-relaxed text-zinc-400">{targets.keywords.join("  ·  ")}</p>
      </section>
    </main>
  );
}
