import Link from "next/link";
import { hasSupabaseCreds } from "@/lib/db/client";
import {
  getCompetitorCommentsForPost,
  getDrafts,
  getPostById,
  getQueueItem,
} from "@/lib/db/repos";
import { DraftPanel } from "@/components/DraftPanel";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!hasSupabaseCreds()) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-zinc-400">NO DATA — needs creds (Supabase)</p>
      </main>
    );
  }

  const post = await getPostById(id);
  if (!post) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-sky-400 hover:underline">
          ← inbox
        </Link>
        <p className="mt-6 text-sm text-zinc-400">Post not found. Ingest/score first.</p>
      </main>
    );
  }

  const [item, drafts, competitor] = await Promise.all([
    getQueueItem(id),
    getDrafts(id),
    getCompetitorCommentsForPost(id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-sky-400 hover:underline">
        ← inbox
      </Link>

      <header className="mt-4">
        <div className="flex items-start gap-3">
          {item && (
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-sm font-semibold">
              {item.total}
            </span>
          )}
          <div>
            <h1 className="text-lg font-semibold leading-snug">{post.title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
              <span>r/{post.subreddit}</span>
              <span>{post.numComments} comments</span>
              <a href={post.permalink} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                open on reddit ↗
              </a>
              {item && (
                <span className={item.mentionFit === "iro_relevant" ? "text-sky-400" : ""}>
                  {item.mentionFit === "iro_relevant" ? "iro-relevant" : "helpful-only"}
                </span>
              )}
              <span>
                self-promo:{" "}
                {item?.selfPromoAllowed === true
                  ? "ok"
                  : item?.selfPromoAllowed === false
                    ? "strict"
                    : "unknown"}
              </span>
            </div>
          </div>
        </div>
        {item?.why && <p className="mt-3 text-sm text-zinc-400">{item.why}</p>}
      </header>

      {post.selftext && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Post</h2>
          <p className="whitespace-pre-wrap rounded-lg border border-zinc-800 p-4 text-sm leading-relaxed text-zinc-300">
            {post.selftext.slice(0, 4000)}
          </p>
        </section>
      )}

      {competitor.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Competitor comments to out-answer
          </h2>
          <ul className="space-y-2">
            {competitor.map((c, i) => (
              <li key={i} className="rounded-lg border border-fuchsia-900/40 bg-fuchsia-950/10 p-3">
                <a
                  href={c.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-fuchsia-300 hover:underline"
                >
                  u/{c.username} ↗
                </a>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{c.body.slice(0, 800)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Drafts</h2>
        <DraftPanel postId={id} initialDrafts={drafts} />
      </section>
    </main>
  );
}
