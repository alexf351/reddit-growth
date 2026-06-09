import { competitors } from "@config/competitors";

export const dynamic = "force-dynamic";

export default function CompetitorsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">Competitor Intel</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Sub map, question-pattern clustering, posting cadence, and config suggestions land in P3.
        </p>
      </header>

      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Tracked accounts ({competitors.length})
      </h2>
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {competitors.map((c) => (
          <li key={c.username} className="px-4 py-3">
            <span className="text-sm font-medium">u/{c.username}</span>
            {c.notes && <span className="ml-2 text-xs text-zinc-500">{c.notes}</span>}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-zinc-500">
        Public comment history only. We never contact, reply to, or interact with these accounts.
      </p>
    </main>
  );
}
