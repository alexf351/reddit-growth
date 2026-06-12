/**
 * P3 competitor mining: pull each tracked competitor's public comment history,
 * store the comments + the parent posts (injected into the triage pipeline,
 * tagged competitor-present), compute a saturation signal for a capped set of
 * those threads, and propose subreddit/keyword suggestions for approval.
 *
 * Read-only: we only read public comment history. We never contact, reply to,
 * or interact with competitor accounts.
 */
import { competitors as competitorConfig } from "@config/competitors";
import { targets } from "@config/targets";
import { hasRedditCreds } from "@/lib/reddit/auth";
import {
  getPostTopComments,
  getPostsByIds,
  getUserCommentsPaged,
} from "@/lib/reddit/listings";
import { hasSupabaseCreds } from "@/lib/db/client";
import { hasLlmCreds } from "@/lib/llm/provider";
import { clusterQuestionPatterns } from "@/lib/llm/cluster";
import * as repos from "@/lib/db/repos";

const PROMO_RE =
  /(https?:\/\/|\bcourse\b|bootcamp|enroll|sign\s?up|\bcohort\b|check out|i built|i made|my (app|tool|course|video|channel)|recommend|udemy|coursera|simplilearn)/i;

const SATURATION_CHECK_CAP = 25; // bound Reddit calls per run
const SUB_SUGGEST_MIN = 3; // a competitor sub must appear at least this often

export interface MiningResult {
  ok: boolean;
  reason?: string;
  competitorsMined: number;
  commentsStored: number;
  threadsLinked: number;
  postsAdded: number;
  saturationChecked: number;
  suggestedSubreddits: number;
  suggestedKeywords: number;
  errors: string[];
}

function empty(reason: string): MiningResult {
  return {
    ok: false,
    reason,
    competitorsMined: 0,
    commentsStored: 0,
    threadsLinked: 0,
    postsAdded: 0,
    saturationChecked: 0,
    suggestedSubreddits: 0,
    suggestedKeywords: 0,
    errors: [],
  };
}

export async function runMining(): Promise<MiningResult> {
  if (!hasRedditCreds()) return empty("NO DATA — needs creds (Reddit)");
  if (!hasSupabaseCreds()) return empty("NO DATA — needs creds (Supabase)");

  const runId = await repos.startRun("mine");
  const errors: string[] = [];
  let competitorsMined = 0;
  let commentsStored = 0;
  let threadsLinked = 0;
  let postsAdded = 0;
  let saturationChecked = 0;

  try {
    await repos.ensureCompetitors([...competitorConfig]);
    const comps = await repos.getActiveCompetitors();

    const parentTitles: string[] = [];
    const injected: { postId: string; shortId: string }[] = [];

    for (const comp of comps) {
      try {
        const comments = await getUserCommentsPaged(comp.username, 200);
        if (comments.length === 0) {
          await repos.setLastMined(comp.id);
          continue;
        }
        commentsStored += await repos.storeCompetitorComments(comp.id, comments);

        const parentIds = [...new Set(comments.map((c) => c.parentPostId))];
        const parents = await getPostsByIds(parentIds);
        const engaged = await repos.getEngagedPostIds(parents.map((p) => p.id));
        const toAdd = parents.filter((p) => !engaged.has(p.id));
        postsAdded += await repos.upsertPosts(toAdd);

        const addable = new Set(toAdd.map((p) => p.id));
        const seen = new Set<string>();
        const links = comments
          .filter((c) => addable.has(c.parentPostId) && !seen.has(c.parentPostId) && seen.add(c.parentPostId))
          .map((c) => ({
            postId: c.parentPostId,
            competitorId: comp.id,
            username: comp.username,
            commentId: c.id,
            commentPermalink: c.permalink,
          }));
        await repos.linkPostCompetitors(links);
        threadsLinked += links.length;

        for (const p of toAdd) {
          parentTitles.push(p.title);
          injected.push({ postId: p.id, shortId: p.shortId });
        }
        await repos.setLastMined(comp.id);
        competitorsMined++;
      } catch (err) {
        errors.push(`u/${comp.username}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Saturation: read actual replies on a capped set of injected threads.
    for (const t of injected.slice(0, SATURATION_CHECK_CAP)) {
      try {
        const bodies = await getPostTopComments(t.shortId, 50);
        const promo = bodies.filter((b) => PROMO_RE.test(b)).length;
        await repos.upsertPostSignal(t.postId, promo);
        saturationChecked++;
      } catch (err) {
        errors.push(`saturation ${t.shortId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const { suggestedSubreddits, suggestedKeywords } = await buildSuggestions(parentTitles, errors);

    const result: MiningResult = {
      ok: true,
      competitorsMined,
      commentsStored,
      threadsLinked,
      postsAdded,
      saturationChecked,
      suggestedSubreddits,
      suggestedKeywords,
      errors,
    };
    await repos.finishRun(runId, "ok", {
      competitorsMined,
      commentsStored,
      threadsLinked,
      postsAdded,
      saturationChecked,
      suggestedSubreddits,
      suggestedKeywords,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}

async function buildSuggestions(
  parentTitles: string[],
  errors: string[],
): Promise<{ suggestedSubreddits: number; suggestedKeywords: number }> {
  // Subreddit suggestions: where competitors are active but we aren't yet.
  const have = new Set(targets.subreddits.map((s) => s.toLowerCase()));
  const intel = await repos.getCompetitorIntel();
  const subCounts = new Map<string, number>();
  for (const c of intel) {
    for (const s of c.subMap) subCounts.set(s.subreddit, (subCounts.get(s.subreddit) ?? 0) + s.count);
  }
  const subRows = [...subCounts.entries()]
    .filter(([sub, count]) => count >= SUB_SUGGEST_MIN && !have.has(sub.toLowerCase()) && sub !== "?")
    .map(([sub, count]) => ({
      type: "subreddit" as const,
      value: sub,
      rationale: `competitors commented here ${count}× and it isn't in your target list`,
      evidence: { count },
    }));
  const suggestedSubreddits = await repos.insertSuggestions(subRows);

  // Keyword suggestions from LLM clustering (only when an LLM is configured).
  let suggestedKeywords = 0;
  if (hasLlmCreds() && parentTitles.length > 0) {
    try {
      const { patterns, usage } = await clusterQuestionPatterns(parentTitles);
      await repos.logLlmUsage("cluster", usage);
      const haveKw = new Set(targets.keywords.map((k) => k.toLowerCase()));
      const kwRows = patterns
        .filter((p) => p.keyword && !haveKw.has(p.keyword.toLowerCase()))
        .map((p) => ({
          type: "keyword" as const,
          value: p.keyword,
          rationale: `competitor question pattern: ${p.label}`,
          evidence: { label: p.label },
        }));
      suggestedKeywords = await repos.insertSuggestions(kwRows);
    } catch (err) {
      errors.push(`clustering: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { suggestedSubreddits, suggestedKeywords };
}
