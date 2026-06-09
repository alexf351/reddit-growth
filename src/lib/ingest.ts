/**
 * P1 ingest orchestration: pull new/rising from every target subreddit + run
 * keyword searches across Reddit, drop negative-keyword noise, dedup, skip posts
 * we've already engaged with, and upsert the rest into Supabase.
 *
 * Returns a structured result. If a required integration is missing creds it
 * returns `{ ok: false, reason: "NO DATA — needs creds ..." }` rather than
 * throwing or inventing numbers.
 */
import { targets } from "@config/targets";
import { hasRedditCreds } from "@/lib/reddit/auth";
import { getSubredditPosts, searchReddit } from "@/lib/reddit/listings";
import { hasSupabaseCreds } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";
import type { RedditPost } from "@/lib/types";

export interface IngestResult {
  ok: boolean;
  reason?: string;
  fetched: number;
  unique: number;
  stored: number;
  skippedEngaged: number;
  newPosts: number;
  errors: string[];
}

function emptyResult(reason: string): IngestResult {
  return { ok: false, reason, fetched: 0, unique: 0, stored: 0, skippedEngaged: 0, newPosts: 0, errors: [] };
}

function matchesNegative(p: RedditPost, negatives: string[]): boolean {
  const hay = `${p.title}\n${p.selftext}`.toLowerCase();
  return negatives.some((n) => hay.includes(n.toLowerCase()));
}

export async function runIngest(): Promise<IngestResult> {
  if (!hasRedditCreds()) return emptyResult("NO DATA — needs creds (Reddit)");
  if (!hasSupabaseCreds()) return emptyResult("NO DATA — needs creds (Supabase)");

  const errors: string[] = [];
  const runId = await repos.startRun("ingest");

  try {
    const all: RedditPost[] = [];

    // Subreddit new + rising.
    for (const sub of targets.subreddits) {
      try {
        const [fresh, rising] = await Promise.all([
          getSubredditPosts(sub, "new", 50),
          getSubredditPosts(sub, "rising", 25),
        ]);
        all.push(...fresh, ...rising);
      } catch (err) {
        errors.push(`r/${sub}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Keyword search across Reddit.
    for (const kw of targets.keywords) {
      try {
        const found = await searchReddit(kw, { limit: 50, sort: "new", t: "week" });
        all.push(...found);
      } catch (err) {
        errors.push(`search "${kw}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Dedup by id; drop negative-keyword noise. First occurrence wins so a post
    // keeps its subreddit-listing source rather than a later "search" hit.
    const byId = new Map<string, RedditPost>();
    for (const p of all) {
      if (matchesNegative(p, targets.negativeKeywords)) continue;
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    const unique = [...byId.values()];

    const ids = unique.map((p) => p.id);
    const [engaged, known] = await Promise.all([
      repos.getEngagedPostIds(ids),
      repos.getKnownPostIds(ids),
    ]);

    const toStore = unique.filter((p) => !engaged.has(p.id));
    const newPosts = toStore.filter((p) => !known.has(p.id)).length;

    await repos.ensureSubreddits(targets.subreddits);
    const stored = await repos.upsertPosts(toStore);

    const result: IngestResult = {
      ok: true,
      fetched: all.length,
      unique: unique.length,
      stored,
      skippedEngaged: unique.length - toStore.length,
      newPosts,
      errors,
    };
    await repos.finishRun(runId, "ok", { ...result, ok: undefined });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}
