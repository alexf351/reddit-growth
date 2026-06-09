/** Typed Supabase queries. Keep all SQL/table knowledge in this file. */
import { getSupabase } from "./client";
import type { RedditPost, TriageItem, TriageStatus } from "@/lib/types";
import type { ScoreBreakdown } from "@/lib/scoring/score";
import type { LlmUsage } from "@/lib/llm/provider";

type Row = Record<string, unknown>;

function rowToPost(r: Row): RedditPost {
  return {
    id: String(r.id),
    shortId: String(r.short_id),
    subreddit: String(r.subreddit),
    title: String(r.title),
    selftext: (r.selftext as string) ?? "",
    author: (r.author as string) ?? "",
    permalink: String(r.permalink),
    url: (r.url as string) ?? "",
    createdUtc: Number(r.created_utc),
    numComments: Number(r.num_comments ?? 0),
    score: Number(r.score ?? 0),
    upvoteRatio: Number(r.upvote_ratio ?? 0),
    over18: Boolean(r.over_18),
    locked: Boolean(r.locked),
    removed: Boolean(r.removed),
    source: (r.source as RedditPost["source"]) ?? "new",
    searchKeyword: (r.search_keyword as string) ?? undefined,
  };
}

function rowToTriageItem(r: Row): TriageItem {
  return {
    postId: String(r.post_id),
    subreddit: String(r.subreddit),
    title: String(r.title),
    permalink: String(r.permalink),
    author: (r.author as string) ?? null,
    createdUtc: Number(r.created_utc),
    numComments: Number(r.num_comments ?? 0),
    postScore: Number(r.post_score ?? 0),
    locked: Boolean(r.locked),
    removed: Boolean(r.removed),
    relevance: Number(r.relevance ?? 0),
    intent: Number(r.intent ?? 0),
    commentability: Number(r.commentability ?? 0),
    mentionFit: (r.mention_fit as TriageItem["mentionFit"]) ?? "helpful_only",
    competitorBoost: Number(r.competitor_boost ?? 0),
    saturationPenalty: Number(r.saturation_penalty ?? 0),
    freshnessBonus: Number(r.freshness_bonus ?? 0),
    total: Number(r.total ?? 0),
    why: (r.why as string) ?? null,
    model: (r.model as string) ?? null,
    status: (r.status as TriageStatus) ?? "new",
  };
}

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

// ── scoring (P2) ─────────────────────────────────────────────────────────────

/** Posts that don't yet have a score, newest first. */
export async function getUnscoredPosts(limit: number): Promise<RedditPost[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_unscored_posts")
    .select("*")
    .order("created_utc", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getUnscoredPosts: ${error.message}`);
  return (data ?? []).map(rowToPost);
}

export async function upsertScore(
  postId: string,
  b: ScoreBreakdown,
  why: string,
  model: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reddit_scores").upsert(
    {
      post_id: postId,
      relevance: b.relevance,
      intent: b.intent,
      commentability: b.commentability,
      mention_fit: b.mentionFit,
      mention_fit_score: b.mentionFitScore,
      competitor_boost: b.competitorBoost,
      saturation_penalty: b.saturationPenalty,
      freshness_bonus: b.freshnessBonus,
      total: b.total,
      why,
      model,
      scored_at: new Date().toISOString(),
    },
    { onConflict: "post_id" },
  );
  if (error) throw new Error(`upsertScore: ${error.message}`);
}

/** Make sure a triage row exists for a scored post (status defaults to 'new'). */
export async function ensureTriage(postId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("reddit_triage")
    .upsert({ post_id: postId }, { onConflict: "post_id", ignoreDuplicates: true });
  if (error) throw new Error(`ensureTriage: ${error.message}`);
}

export async function logLlmUsage(callType: string, usage: LlmUsage): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reddit_llm_usage").insert({
    call_type: callType,
    provider: usage.provider,
    model: usage.model,
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
  });
  if (error) throw new Error(`logLlmUsage: ${error.message}`);
}

// ── triage queue (P2) ────────────────────────────────────────────────────────

export interface TriageQueueFilter {
  includeDismissed?: boolean;
  minScore?: number;
  limit?: number;
}

export async function getTriageQueue(f: TriageQueueFilter = {}): Promise<TriageItem[]> {
  const sb = getSupabase();
  let q = sb
    .from("reddit_triage_queue")
    .select("*")
    .order("total", { ascending: false })
    .limit(f.limit ?? 200);
  if (typeof f.minScore === "number") q = q.gte("total", f.minScore);
  if (!f.includeDismissed) q = q.neq("status", "dismissed");
  const { data, error } = await q;
  if (error) throw new Error(`getTriageQueue: ${error.message}`);
  return (data ?? []).map(rowToTriageItem);
}

export async function updateTriageStatus(
  postId: string,
  status: TriageStatus,
  note?: string,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reddit_triage").upsert(
    { post_id: postId, status, note: note ?? null, acted_at: new Date().toISOString() },
    { onConflict: "post_id" },
  );
  if (error) throw new Error(`updateTriageStatus: ${error.message}`);
  // Commenting means we've engaged — dedup it out of future ingests.
  if (status === "commented") await markEngaged([postId], "triage");
}
