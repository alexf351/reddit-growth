import Link from "next/link";
import { hasSupabaseCreds } from "@/lib/db/client";
import { listAudiences } from "@/lib/db/repos";
import { targets } from "@config/targets";
import { AudienceManager } from "@/components/AudienceManager";
import type { Audience } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-xl font-semibold">Audiences</h1>
        <p className="mt-6 text-sm text-zinc-400">NO DATA — needs creds (Supabase)</p>
      </main>
    );
  }

  let audiences: Audience[] = [];
  let error: string | null = null;
  try {
    audiences = await listAudiences();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Audiences</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Save named groups of subreddits, then scope the{" "}
          <Link href="/" className="text-sky-400 hover:underline">inbox</Link> to one.
        </p>
      </header>

      {error && (
        <p className="mb-6 rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {error}. Apply the migrations in <code>supabase/migrations</code>.
        </p>
      )}

      <AudienceManager initial={audiences} allSubreddits={targets.subreddits} />
    </main>
  );
}
