import Link from "next/link";
import { hasSupabaseCreds } from "@/lib/db/client";
import { getTriageQueue, listAudiences } from "@/lib/db/repos";
import { TriageInbox } from "@/components/TriageInbox";
import type { Audience, TriageItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-xl font-semibold">Triage inbox</h1>
        <div className="mt-6 rounded-lg border border-zinc-800 px-4 py-8 text-sm text-zinc-400">
          <p className="font-medium text-zinc-200">NO DATA — needs creds (Supabase)</p>
          <p className="mt-2">
            Set <code className="text-zinc-300">SUPABASE_URL</code> and{" "}
            <code className="text-zinc-300">SUPABASE_SERVICE_ROLE_KEY</code> in{" "}
            <code className="text-zinc-300">.env.local</code>, apply the migrations in{" "}
            <code className="text-zinc-300">supabase/migrations</code>, then run{" "}
            <code className="text-zinc-300">npm run ingest</code> and{" "}
            <code className="text-zinc-300">npm run score</code>.
          </p>
          <p className="mt-2">
            See <Link href="/status" className="text-sky-400 hover:underline">Status</Link> for all integrations.
          </p>
        </div>
      </main>
    );
  }

  let items: TriageItem[] = [];
  let audiences: Audience[] = [];
  let error: string | null = null;
  try {
    [items, audiences] = await Promise.all([getTriageQueue({ limit: 300 }), listAudiences()]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Triage inbox</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ranked threads worth a comment. You post manually — nothing here is auto-posted.
          </p>
        </div>
        <a
          href="/api/export/opportunities"
          className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          export CSV
        </a>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          Failed to load queue: {error}. Have you applied the migrations in{" "}
          <code>supabase/migrations</code>?
        </p>
      ) : (
        <TriageInbox initialItems={items} audiences={audiences} />
      )}
    </main>
  );
}
