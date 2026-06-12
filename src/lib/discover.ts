/**
 * P7 audience discovery: search Reddit for subreddits related to our keywords,
 * (optionally) LLM-gate them for relevance, and propose the best new ones as
 * pending subreddit suggestions. You approve before anything is ingested.
 */
import { targets } from "@config/targets";
import { product } from "@config/product";
import { hasRedditCreds } from "@/lib/reddit/auth";
import { searchSubreddits, type SubredditHit } from "@/lib/reddit/listings";
import { hasSupabaseCreds } from "@/lib/db/client";
import { generateJSON, hasLlmCreds } from "@/lib/llm/provider";
import * as repos from "@/lib/db/repos";

export interface DiscoveryResult {
  ok: boolean;
  reason?: string;
  candidates: number;
  suggested: number;
  errors: string[];
}

const MIN_SUBS = 1_000; // skip tiny/dead subs
const MAX_SUBS = 5_000_000; // skip mega-subs where a comment vanishes
const TOP_N = 40;

export async function runDiscovery(queries?: string[]): Promise<DiscoveryResult> {
  if (!hasRedditCreds()) return { ok: false, reason: "NO DATA — needs creds (Reddit)", candidates: 0, suggested: 0, errors: [] };
  if (!hasSupabaseCreds()) return { ok: false, reason: "NO DATA — needs creds (Supabase)", candidates: 0, suggested: 0, errors: [] };

  const runId = await repos.startRun("discover");
  const errors: string[] = [];

  try {
    const seedQueries = queries && queries.length ? queries : targets.keywords;
    const have = new Set(
      [...targets.subreddits, ...(await repos.getApprovedSuggestionValues("subreddit"))].map((s) => s.toLowerCase()),
    );

    const byName = new Map<string, SubredditHit & { hits: number }>();
    for (const q of seedQueries) {
      try {
        for (const hit of await searchSubreddits(q, 25)) {
          if (hit.over18) continue;
          if (have.has(hit.name.toLowerCase())) continue;
          if (hit.subscribers < MIN_SUBS || hit.subscribers > MAX_SUBS) continue;
          const cur = byName.get(hit.name);
          if (cur) cur.hits += 1;
          else byName.set(hit.name, { ...hit, hits: 1 });
        }
      } catch (err) {
        errors.push(`search "${q}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const candidates = [...byName.values()]
      .sort((a, b) => b.hits - a.hits || b.subscribers - a.subscribers)
      .slice(0, TOP_N);

    let relevant = candidates;
    if (hasLlmCreds() && candidates.length > 0) {
      try {
        relevant = await gateRelevance(candidates);
      } catch (err) {
        errors.push(`relevance gate: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const rows = relevant.map((c) => ({
      type: "subreddit" as const,
      value: c.name,
      rationale: `${c.subscribers.toLocaleString()} subscribers · matched ${c.hits} keyword${c.hits > 1 ? "s" : ""}`,
      evidence: { subscribers: c.subscribers, activeUsers: c.activeUsers, description: c.description.slice(0, 300), hits: c.hits },
    }));
    const suggested = await repos.insertSuggestions(rows);

    await repos.finishRun(runId, "ok", { candidates: candidates.length, suggested });
    return { ok: true, candidates: candidates.length, suggested, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}

async function gateRelevance<T extends { name: string; description: string }>(candidates: T[]): Promise<T[]> {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: { relevant: { type: "array", items: { type: "string" } } },
    required: ["relevant"],
  };
  const list = candidates.map((c) => `- ${c.name}: ${c.description.slice(0, 160)}`).join("\n");
  const { data, usage } = await generateJSON<{ relevant: string[] }>({
    system: `You pick subreddits worth posting in for ${product.name}. ${product.description}`,
    user: `Candidate subreddits:\n${list}\n\nReturn the subreddit names where ${product.name}'s audience genuinely hangs out and a helpful comment would fit. Be selective.`,
    schema,
    maxTokens: 500,
  });
  await repos.logLlmUsage("discover", usage).catch(() => {});
  const keep = new Set(data.relevant.map((s) => s.replace(/^r\//i, "").toLowerCase()));
  const filtered = candidates.filter((c) => keep.has(c.name.toLowerCase()));
  return filtered.length ? filtered : candidates;
}
