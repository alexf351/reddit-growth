/** Typed Supabase queries. Keep all SQL/table knowledge in this file. */
import { getSupabase } from "./client";
import type { RedditPost } from "@/lib/types";

/** Chunk a list so we never blow past Postgres parameter / URL limits. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function ensureSubreddits(names: string[]): Promise<void> {
  if (names.length === 0) return;
  const sb = getSupabase();
  const rows = names.map((name) => ({ name, origin: "seed" as const }));
  // Don't clobber an existing row's origin/active — only insert missing ones.
  const { error } = await sb.from("reddit_subreddits").upsert(rows, {
    onConflict: "name",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`ensureSubreddits: ${error.message}`);
}

export async function upsertPosts(posts: RedditPost[]): Promise<number> {
  if (posts.length === 0) return 0;
  const sb = getSupabase();
  const now = new Date().toISOString();
  const rows = posts.map((p) => ({
    id: p.id,
    short_id: p.shortId,
    subreddit: p.subreddit,
    title: p.title,
    selftext: p.selftext,
    author: p.author,
    permalink: p.permalink,
    url: p.url,
    created_utc: p.createdUtc,
    num_comments: p.numComments,
    score: p.score,
    upvote_ratio: p.upvoteRatio,
    over_18: p.over18,
    locked: p.locked,
    removed: p.removed,
    source: p.source,
    search_keyword: p.searchKeyword ?? null,
    last_seen_at: now,
  }));
  // Upsert updates only the columns we pass, so `first_seen_at` (set by the
  // DB default on insert) is preserved across re-ingests.
  for (const part of chunk(rows, 500)) {
    const { error } = await sb.from("reddit_posts").upsert(part, { onConflict: "id" });
    if (error) throw new Error(`upsertPosts: ${error.message}`);
  }
  return rows.length;
}

/** Of the given post ids, which already exist in reddit_posts. */
export async function getKnownPostIds(ids: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  if (ids.length === 0) return known;
  const sb = getSupabase();
  for (const part of chunk(ids, 800)) {
    const { data, error } = await sb.from("reddit_posts").select("id").in("id", part);
    if (error) throw new Error(`getKnownPostIds: ${error.message}`);
    for (const row of data ?? []) known.add(row.id as string);
  }
  return known;
}

/** Of the given post ids, which are in reddit_my_activity (already engaged). */
export async function getEngagedPostIds(ids: string[]): Promise<Set<string>> {
  const engaged = new Set<string>();
  if (ids.length === 0) return engaged;
  const sb = getSupabase();
  for (const part of chunk(ids, 800)) {
    const { data, error } = await sb.from("reddit_my_activity").select("post_id").in("post_id", part);
    if (error) throw new Error(`getEngagedPostIds: ${error.message}`);
    for (const row of data ?? []) engaged.add(row.post_id as string);
  }
  return engaged;
}

export async function markEngaged(
  postIds: string[],
  source: "history" | "triage" = "history",
): Promise<void> {
  if (postIds.length === 0) return;
  const sb = getSupabase();
  const rows = postIds.map((post_id) => ({ post_id, source }));
  const { error } = await sb
    .from("reddit_my_activity")
    .upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
  if (error) throw new Error(`markEngaged: ${error.message}`);
}

// ── ingest run bookkeeping ───────────────────────────────────────────────────

export async function startRun(kind: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_ingest_runs")
    .insert({ kind })
    .select("id")
    .single();
  if (error) throw new Error(`startRun: ${error.message}`);
  return data.id as string;
}

export async function finishRun(
  id: string,
  status: "ok" | "error",
  counts: Record<string, unknown> | null,
  error?: string,
): Promise<void> {
  const sb = getSupabase();
  const { error: dbError } = await sb
    .from("reddit_ingest_runs")
    .update({
      status,
      counts_json: counts,
      error: error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (dbError) throw new Error(`finishRun: ${dbError.message}`);
}
