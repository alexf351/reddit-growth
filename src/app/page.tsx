import { credStatus } from "@/lib/env";
import { competitors } from "@config/competitors";
import { targets } from "@config/targets";

export const dynamic = "force-dynamic";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-zinc-600"}`}
      aria-hidden
    />
  );
}

export default function Home() {
  const creds = credStatus();
  const rows: { label: string; ok: boolean; note: string }[] = [
    { label: "Reddit API", ok: creds.reddit, note: "REDDIT_CLIENT_ID / SECRET — P0" },
    { label: "Supabase", ok: creds.supabase, note: "SUPABASE_URL / SERVICE_ROLE_KEY — P1" },
    { label: "LLM (Gemini/Claude)", ok: creds.llm, note: "GEMINI_API_KEY or ANTHROPIC_API_KEY — P2" },
    { label: "Resend", ok: creds.resend, note: "RESEND_API_KEY — P4" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Iro — Reddit Opportunity Finder</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Read-only, human-in-the-loop. The tool finds, scores, and explains threads worth a
          genuinely helpful comment. You post manually — nothing is ever auto-posted.
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
        <p className="text-sm leading-relaxed text-zinc-400">
          {targets.keywords.join("  ·  ")}
        </p>
      </section>

      <footer className="mt-12 border-t border-zinc-800 pt-6 text-xs text-zinc-600">
        Phase 0 — scaffold + Reddit OAuth + single-subreddit ingest. The triage inbox, scoring, and
        competitor intel land in later phases. Run <code className="text-zinc-400">npm run ingest:one</code>{" "}
        to test ingestion from the CLI.
      </footer>
    </main>
  );
}
