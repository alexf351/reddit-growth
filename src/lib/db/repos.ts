/** Typed Supabase queries. Keep all SQL/table knowledge in this file. */
import { getSupabase } from "./client";
import type {
  DraftComment,
  RedditComment,
  RedditPost,
  TriageItem,
  TriageStatus,
} from "@/lib/types";
import type { LlmScore, ScoreBreakdown } from "@/lib/scoring/score";
import type { LlmUsage } from "@/lib/llm/provider";
import { scoringConfig } from "@config/scoring";

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
    category: (r.category as string) ?? null,
    sentiment: (r.sentiment as string) ?? null,
    status: (r.status as TriageStatus) ?? "new",
    competitorCount: Number(r.competitor_count ?? 0),
    competitors: Array.isArray(r.competitors_json)
      ? (r.competitors_json as { username: string; commentPermalink: string | null }[])
      : [],
    promoReplyCount: Number(r.promo_reply_count ?? 0),
    selfPromoAllowed:
      r.self_promo_allowed === null || r.self_promo_allowed === undefined
        ? null
        : Boolean(r.self_promo_allowed),
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

/** Store a subreddit's self-promo flag + raw rules (P4). Leaves origin intact. */
export async function upsertSubredditRules(
  name: string,
  selfPromoAllowed: boolean | null,
  rulesJson: unknown,
): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("reddit_subreddits").upsert(
    {
      name,
      self_promo_allowed: selfPromoAllowed,
      rules_json: rulesJson,
      rules_fetched_at: new Date().toISOString(),
    },
    { onConflict: "name" },
  );
  if (error) throw new Error(`upsertSubredditRules: ${error.message}`);
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
  llm: Pick<LlmScore, "why" | "category" | "sentiment">,
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
      why: llm.why,
      category: llm.category,
      sentiment: llm.sentiment,
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

// ── competitor mining (P3) ───────────────────────────────────────────────────

export interface CompetitorRecord {
  id: string;
  username: string;
  label: string;
  active: boolean;
  lastMinedAt: string | null;
  notes: string | null;
}

export async function ensureCompetitors(
  list: { username: string; label: string; notes?: string }[],
): Promise<void> {
  if (list.length === 0) return;
  const sb = getSupabase();
  const rows = list.map((c) => ({
    username: c.username,
    label: c.label,
    notes: c.notes ?? null,
    origin: "seed" as const,
  }));
  const { error } = await sb
    .from("reddit_competitors")
    .upsert(rows, { onConflict: "username", ignoreDuplicates: true });
  if (error) throw new Error(`ensureCompetitors: ${error.message}`);
}

export async function getActiveCompetitors(): Promise<CompetitorRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_competitors")
    .select("*")
    .eq("active", true)
    .order("username");
  if (error) throw new Error(`getActiveCompetitors: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    username: String(r.username),
    label: String(r.label),
    active: Boolean(r.active),
    lastMinedAt: (r.last_mined_at as string) ?? null,
    notes: (r.notes as string) ?? null,
  }));
}

export async function storeCompetitorComments(
  competitorId: string,
  comments: RedditComment[],
): Promise<number> {
  if (comments.length === 0) return 0;
  const sb = getSupabase();
  const rows = comments.map((c) => ({
    id: c.id,
    competitor_id: competitorId,
    body: c.body,
    permalink: c.permalink,
    created_utc: c.createdUtc,
    score: c.score,
    parent_post_id: c.parentPostId,
    parent_title: c.parentPostTitle ?? null,
    parent_subreddit: c.subreddit,
    fetched_at: new Date().toISOString(),
  }));
  for (const part of chunk(rows, 500)) {
    const { error } = await sb.from("reddit_competitor_comments").upsert(part, { onConflict: "id" });
    if (error) throw new Error(`storeCompetitorComments: ${error.message}`);
  }
  return rows.length;
}

export async function linkPostCompetitors(
  rows: { postId: string; competitorId: string; username: string; commentId: string; commentPermalink: string }[],
): Promise<void> {
  if (rows.length === 0) return;
  const sb = getSupabase();
  const mapped = rows.map((r) => ({
    post_id: r.postId,
    competitor_id: r.competitorId,
    competitor_username: r.username,
    comment_id: r.commentId,
    comment_permalink: r.commentPermalink,
  }));
  for (const part of chunk(mapped, 500)) {
    const { error } = await sb
      .from("reddit_post_competitors")
      .upsert(part, { onConflict: "post_id,competitor_id" });
    if (error) throw new Error(`linkPostCompetitors: ${error.message}`);
  }
}

export async function setLastMined(competitorId: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("reddit_competitors")
    .update({ last_mined_at: new Date().toISOString() })
    .eq("id", competitorId);
  if (error) throw new Error(`setLastMined: ${error.message}`);
}

export async function upsertPostSignal(postId: string, promoReplyCount: number): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("reddit_post_signals")
    .upsert(
      { post_id: postId, promo_reply_count: promoReplyCount, checked_at: new Date().toISOString() },
      { onConflict: "post_id" },
    );
  if (error) throw new Error(`upsertPostSignal: ${error.message}`);
}

export interface ScoringSignal {
  competitorPresent: boolean;
  promoReplyCount: number;
}

export async function getScoringSignals(ids: string[]): Promise<Map<string, ScoringSignal>> {
  const map = new Map<string, ScoringSignal>();
  if (ids.length === 0) return map;
  const sb = getSupabase();
  for (const part of chunk(ids, 500)) {
    const { data: pc, error: e1 } = await sb
      .from("reddit_post_competitors")
      .select("post_id")
      .in("post_id", part);
    if (e1) throw new Error(`getScoringSignals: ${e1.message}`);
    for (const r of pc ?? []) {
      const id = String(r.post_id);
      map.set(id, { competitorPresent: true, promoReplyCount: map.get(id)?.promoReplyCount ?? 0 });
    }
    const { data: sig, error: e2 } = await sb
      .from("reddit_post_signals")
      .select("post_id, promo_reply_count")
      .in("post_id", part);
    if (e2) throw new Error(`getScoringSignals: ${e2.message}`);
    for (const r of sig ?? []) {
      const id = String(r.post_id);
      const cur = map.get(id) ?? { competitorPresent: false, promoReplyCount: 0 };
      map.set(id, { ...cur, promoReplyCount: Number(r.promo_reply_count ?? 0) });
    }
  }
  return map;
}

// ── suggestions (P3) ─────────────────────────────────────────────────────────

export interface SuggestionRecord {
  id: string;
  type: "subreddit" | "keyword";
  value: string;
  rationale: string | null;
  status: string;
  createdAt: string;
}

export async function insertSuggestions(
  rows: { type: "subreddit" | "keyword"; value: string; rationale: string; evidence: unknown }[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const sb = getSupabase();
  const mapped = rows.map((r) => ({
    type: r.type,
    value: r.value,
    rationale: r.rationale,
    evidence_json: r.evidence,
  }));
  // Don't overwrite an already-decided suggestion.
  const { error } = await sb
    .from("reddit_suggestions")
    .upsert(mapped, { onConflict: "type,value", ignoreDuplicates: true });
  if (error) throw new Error(`insertSuggestions: ${error.message}`);
  return mapped.length;
}

export async function getPendingSuggestions(): Promise<SuggestionRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_suggestions")
    .select("*")
    .eq("status", "pending")
    .order("type")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getPendingSuggestions: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    type: r.type as SuggestionRecord["type"],
    value: String(r.value),
    rationale: (r.rationale as string) ?? null,
    status: String(r.status),
    createdAt: String(r.created_at),
  }));
}

export async function getApprovedSuggestionValues(type: "subreddit" | "keyword"): Promise<string[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_suggestions")
    .select("value")
    .eq("type", type)
    .eq("status", "approved");
  if (error) throw new Error(`getApprovedSuggestionValues: ${error.message}`);
  return (data ?? []).map((r) => String(r.value));
}

export async function decideSuggestion(id: string, status: "approved" | "rejected"): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("reddit_suggestions")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`decideSuggestion: ${error.message}`);
}

// ── competitor intel (P3) ────────────────────────────────────────────────────

export interface SubCount {
  subreddit: string;
  count: number;
}

export interface CompetitorIntel {
  username: string;
  label: string;
  lastMinedAt: string | null;
  totalComments: number;
  commentsPerDay: number;
  medianReplyHours: number | null;
  subMap: SubCount[];
  recentThreads: { title: string; subreddit: string; permalink: string }[];
}

export async function getCompetitorIntel(): Promise<CompetitorIntel[]> {
  const sb = getSupabase();
  const comps = await getActiveCompetitors();
  const out: CompetitorIntel[] = [];

  for (const c of comps) {
    const { data, error } = await sb
      .from("reddit_competitor_comments")
      .select("created_utc, parent_post_id, parent_subreddit, parent_title, permalink")
      .eq("competitor_id", c.id)
      .order("created_utc", { ascending: false })
      .limit(500);
    if (error) throw new Error(`getCompetitorIntel: ${error.message}`);
    const rows = data ?? [];
    const total = rows.length;

    const subCounts = new Map<string, number>();
    for (const r of rows) {
      const s = (r.parent_subreddit as string) || "?";
      subCounts.set(s, (subCounts.get(s) ?? 0) + 1);
    }
    const subMap = [...subCounts.entries()]
      .map(([subreddit, count]) => ({ subreddit, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    let commentsPerDay = 0;
    if (total > 1) {
      const times = rows.map((r) => Number(r.created_utc));
      const span = (Math.max(...times) - Math.min(...times)) / 86400;
      commentsPerDay = span > 0 ? total / span : total;
    }

    // Reply speed: comment age relative to its parent post (where we have it).
    const parentIds = [...new Set(rows.map((r) => String(r.parent_post_id)))];
    const created = new Map<string, number>();
    for (const part of chunk(parentIds, 500)) {
      const { data: pd } = await sb.from("reddit_posts").select("id, created_utc").in("id", part);
      for (const p of pd ?? []) created.set(String(p.id), Number(p.created_utc));
    }
    const delays: number[] = [];
    for (const r of rows) {
      const pc = created.get(String(r.parent_post_id));
      if (pc) {
        const d = (Number(r.created_utc) - pc) / 3600;
        if (d >= 0 && d < 24 * 30) delays.push(d);
      }
    }
    delays.sort((a, b) => a - b);
    const medianReplyHours = delays.length ? delays[Math.floor(delays.length / 2)] : null;

    out.push({
      username: c.username,
      label: c.label,
      lastMinedAt: c.lastMinedAt,
      totalComments: total,
      commentsPerDay: Math.round(commentsPerDay * 10) / 10,
      medianReplyHours: medianReplyHours != null ? Math.round(medianReplyHours * 10) / 10 : null,
      subMap,
      recentThreads: rows.slice(0, 8).map((r) => ({
        title: (r.parent_title as string) || "(untitled)",
        subreddit: (r.parent_subreddit as string) || "?",
        permalink: (r.permalink as string) || "#",
      })),
    });
  }
  return out;
}

// ── drafts (P5) ──────────────────────────────────────────────────────────────

function rowToDraft(r: Row): DraftComment {
  return {
    id: String(r.id),
    postId: String(r.post_id),
    variant: Number(r.variant ?? 1),
    body: String(r.body ?? ""),
    mentionsIro: Boolean(r.mentions_iro),
    model: (r.model as string) ?? null,
    createdAt: String(r.created_at),
  };
}

export async function getPostById(id: string): Promise<RedditPost | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("reddit_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getPostById: ${error.message}`);
  return data ? rowToPost(data) : null;
}

/** A single scored queue item (null if the post isn't scored yet). */
export async function getQueueItem(postId: string): Promise<TriageItem | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_triage_queue")
    .select("*")
    .eq("post_id", postId)
    .maybeSingle();
  if (error) throw new Error(`getQueueItem: ${error.message}`);
  return data ? rowToTriageItem(data) : null;
}

export interface CompetitorCommentLite {
  username: string;
  body: string;
  permalink: string;
}

export async function getCompetitorCommentsForPost(postId: string): Promise<CompetitorCommentLite[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_competitor_comments")
    .select("body, permalink, reddit_competitors(username)")
    .eq("parent_post_id", postId)
    .limit(10);
  if (error) throw new Error(`getCompetitorCommentsForPost: ${error.message}`);
  return (data ?? []).map((r) => {
    const rel = (r as Row).reddit_competitors as { username?: string } | { username?: string }[] | null;
    const username = Array.isArray(rel) ? rel[0]?.username : rel?.username;
    return {
      username: username ?? "competitor",
      body: String((r as Row).body ?? ""),
      permalink: String((r as Row).permalink ?? "#"),
    };
  });
}

export async function insertDrafts(
  postId: string,
  drafts: { body: string; mentionsIro: boolean }[],
  model: string,
  usage: LlmUsage,
): Promise<DraftComment[]> {
  if (drafts.length === 0) return [];
  const sb = getSupabase();
  const rows = drafts.map((d, i) => ({
    post_id: postId,
    variant: i + 1,
    body: d.body,
    mentions_iro: d.mentionsIro,
    model,
    // Attribute the (single) LLM call's tokens to the first row.
    prompt_tokens: i === 0 ? usage.promptTokens : 0,
    completion_tokens: i === 0 ? usage.completionTokens : 0,
  }));
  const { data, error } = await sb.from("reddit_drafts").insert(rows).select("*");
  if (error) throw new Error(`insertDrafts: ${error.message}`);
  return (data ?? []).map(rowToDraft);
}

export async function getDrafts(postId: string): Promise<DraftComment[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_drafts")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getDrafts: ${error.message}`);
  return (data ?? []).map(rowToDraft);
}

// ── observability (P6) ───────────────────────────────────────────────────────

export interface IngestRunRecord {
  kind: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  counts: Record<string, unknown> | null;
}

export async function getRecentRuns(limit = 12): Promise<IngestRunRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_ingest_runs")
    .select("kind, status, started_at, finished_at, counts_json")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentRuns: ${error.message}`);
  return (data ?? []).map((r) => ({
    kind: String(r.kind),
    status: String(r.status),
    startedAt: String(r.started_at),
    finishedAt: (r.finished_at as string) ?? null,
    counts: (r.counts_json as Record<string, unknown>) ?? null,
  }));
}

export interface UsageTotals {
  promptTokens: number;
  completionTokens: number;
  calls: number;
}

export async function getUsageTotals(): Promise<UsageTotals> {
  const sb = getSupabase();
  const { data, error } = await sb.from("reddit_llm_usage_totals").select("*").maybeSingle();
  if (error) throw new Error(`getUsageTotals: ${error.message}`);
  return {
    promptTokens: Number(data?.prompt_tokens ?? 0),
    completionTokens: Number(data?.completion_tokens ?? 0),
    calls: Number(data?.calls ?? 0),
  };
}

// ── audience insights (P10) ──────────────────────────────────────────────────

export async function getRecentSignalPosts(
  limit = 150,
): Promise<{ title: string; permalink: string; category: string | null }[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_triage_queue")
    .select("title, permalink, category, created_utc")
    .in("category", ["pain_anger", "solution_request", "advice_request"])
    .order("created_utc", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getRecentSignalPosts: ${error.message}`);
  return (data ?? []).map((r) => ({
    title: String(r.title),
    permalink: String(r.permalink),
    category: (r.category as string) ?? null,
  }));
}

export interface InsightRecord {
  theme: string;
  summary: string | null;
  count: number;
  examples: { title: string; permalink: string }[];
  batchAt: string;
}

export async function replaceInsights(
  themes: { theme: string; summary: string; count: number; examples: { title: string; permalink: string }[] }[],
): Promise<void> {
  const sb = getSupabase();
  // Single-user tool: keep only the latest batch.
  const { error: delErr } = await sb.from("reddit_insights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw new Error(`replaceInsights(delete): ${delErr.message}`);
  if (themes.length === 0) return;
  const batchAt = new Date().toISOString();
  const rows = themes.map((t) => ({
    batch_at: batchAt,
    theme: t.theme,
    summary: t.summary,
    count: t.count,
    examples_json: t.examples,
  }));
  const { error } = await sb.from("reddit_insights").insert(rows);
  if (error) throw new Error(`replaceInsights(insert): ${error.message}`);
}

export async function getLatestInsights(): Promise<InsightRecord[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("reddit_insights")
    .select("*")
    .order("batch_at", { ascending: false })
    .order("count", { ascending: false })
    .limit(50);
  if (error) throw new Error(`getLatestInsights: ${error.message}`);
  const rows = data ?? [];
  const latest = rows.length ? String(rows[0].batch_at) : null;
  return rows
    .filter((r) => String(r.batch_at) === latest)
    .map((r) => ({
      theme: String(r.theme),
      summary: (r.summary as string) ?? null,
      count: Number(r.count ?? 0),
      examples: Array.isArray(r.examples_json) ? (r.examples_json as { title: string; permalink: string }[]) : [],
      batchAt: String(r.batch_at),
    }));
}

// ── real-time alerts + spikes (P9) ───────────────────────────────────────────

export async function getAlertedPostIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (ids.length === 0) return out;
  const sb = getSupabase();
  for (const part of chunk(ids, 800)) {
    const { data, error } = await sb.from("reddit_alerts_sent").select("post_id").in("post_id", part);
    if (error) throw new Error(`getAlertedPostIds: ${error.message}`);
    for (const r of data ?? []) out.add(String(r.post_id));
  }
  return out;
}

export async function markAlerted(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sb = getSupabase();
  const rows = ids.map((post_id) => ({ post_id }));
  const { error } = await sb.from("reddit_alerts_sent").upsert(rows, { onConflict: "post_id", ignoreDuplicates: true });
  if (error) throw new Error(`markAlerted: ${error.message}`);
}

export interface Spike {
  subreddit: string;
  today: number;
  avg: number;
  ratio: number;
}

/** Subreddits whose ingest volume today is well above their 14-day baseline. */
export async function getSpikes(): Promise<Spike[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from("reddit_subreddit_daily").select("*");
  if (error) throw new Error(`getSpikes: ${error.message}`);
  const today = new Date().toISOString().slice(0, 10);
  const bySub = new Map<string, { day: string; n: number }[]>();
  for (const r of data ?? []) {
    const s = String(r.subreddit);
    const arr = bySub.get(s) ?? [];
    arr.push({ day: String(r.day), n: Number(r.n) });
    bySub.set(s, arr);
  }
  const spikes: Spike[] = [];
  for (const [subreddit, rows] of bySub) {
    const todayN = rows.find((r) => r.day === today)?.n ?? 0;
    if (todayN < 5) continue;
    const prior = rows.filter((r) => r.day !== today);
    const avg = prior.length ? prior.reduce((a, r) => a + r.n, 0) / prior.length : 0;
    if (todayN >= 2.5 * Math.max(1, avg)) {
      spikes.push({ subreddit, today: todayN, avg: Math.round(avg * 10) / 10, ratio: Math.round((todayN / Math.max(1, avg)) * 10) / 10 });
    }
  }
  return spikes.sort((a, b) => b.ratio - a.ratio).slice(0, 8);
}

// ── analytics dashboard (P8) ─────────────────────────────────────────────────

export interface DashboardData {
  totals: {
    scored: number;
    queueNew: number;
    saved: number;
    commented: number;
    dismissed: number;
    highValue: number;
    competitorPresent: number;
  };
  categories: { category: string; n: number; avgTotal: number }[];
  sentiment: { sentiment: string; n: number }[];
  subreddits: { subreddit: string; n: number; avgTotal: number; maxTotal: number }[];
  funnel: { status: string; n: number }[];
  dailyVolume: { day: string; n: number }[];
  spikes: Spike[];
  usage: UsageTotals;
}

export async function getDashboard(): Promise<DashboardData> {
  const sb = getSupabase();
  const [cats, sent, subs, funnelRows, vol, spikes, usage] = await Promise.all([
    sb.from("reddit_dashboard_categories").select("*"),
    sb.from("reddit_dashboard_sentiment").select("*"),
    sb.from("reddit_dashboard_subreddits").select("*").limit(12),
    sb.from("reddit_dashboard_funnel").select("*"),
    sb.from("reddit_daily_volume").select("*"),
    getSpikes(),
    getUsageTotals(),
  ]);
  for (const r of [cats, sent, subs, funnelRows, vol]) {
    if (r.error) throw new Error(`getDashboard: ${r.error.message}`);
  }

  const funnel = (funnelRows.data ?? []).map((r) => ({ status: String(r.status), n: Number(r.n) }));
  const byStatus = (s: string) => funnel.find((f) => f.status === s)?.n ?? 0;
  const scored = funnel.reduce((a, f) => a + f.n, 0);

  const [{ count: highValue }, { count: competitorPresent }] = await Promise.all([
    sb.from("reddit_scores").select("*", { count: "exact", head: true }).gte("total", scoringConfig.thresholds.digestMinScore),
    sb.from("reddit_triage_queue").select("*", { count: "exact", head: true }).gt("competitor_count", 0),
  ]);

  return {
    totals: {
      scored,
      queueNew: byStatus("new"),
      saved: byStatus("saved"),
      commented: byStatus("commented"),
      dismissed: byStatus("dismissed"),
      highValue: highValue ?? 0,
      competitorPresent: competitorPresent ?? 0,
    },
    categories: (cats.data ?? []).map((r) => ({ category: String(r.category), n: Number(r.n), avgTotal: Number(r.avg_total) })),
    sentiment: (sent.data ?? []).map((r) => ({ sentiment: String(r.sentiment), n: Number(r.n) })),
    subreddits: (subs.data ?? []).map((r) => ({ subreddit: String(r.subreddit), n: Number(r.n), avgTotal: Number(r.avg_total), maxTotal: Number(r.max_total) })),
    funnel,
    dailyVolume: (vol.data ?? []).map((r) => ({ day: String(r.day), n: Number(r.n) })),
    spikes,
    usage,
  };
}
