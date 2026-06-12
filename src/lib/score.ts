/**
 * P2 scoring orchestration: take unscored posts, score each with the LLM
 * (relevance / intent / mention-fit), combine with computed signals into a
 * 0–100 score, store it, and ensure a triage row exists. Every LLM call's token
 * usage is logged. Returns NO DATA if Supabase or the LLM is unconfigured.
 */
import { hasSupabaseCreds } from "@/lib/db/client";
import { hasLlmCreds, llmProvider } from "@/lib/llm/provider";
import { scorePostWithLlm } from "@/lib/llm/relevance";
import { combineScore } from "@/lib/scoring/score";
import * as repos from "@/lib/db/repos";

export interface ScoringResult {
  ok: boolean;
  reason?: string;
  scored: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  errors: string[];
}

function empty(reason: string): ScoringResult {
  return { ok: false, reason, scored: 0, failed: 0, promptTokens: 0, completionTokens: 0, errors: [] };
}

export async function runScoring(limit = 50): Promise<ScoringResult> {
  if (!hasSupabaseCreds()) return empty("NO DATA — needs creds (Supabase)");
  if (!hasLlmCreds()) return empty(`NO DATA — needs creds (LLM: ${llmProvider()})`);

  const runId = await repos.startRun("score");
  const errors: string[] = [];
  let scored = 0;
  let failed = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const posts = await repos.getUnscoredPosts(limit);
    const signals = await repos.getScoringSignals(posts.map((p) => p.id));
    for (const post of posts) {
      try {
        const { score, usage } = await scorePostWithLlm(post);
        const breakdown = combineScore(post, score, signals.get(post.id) ?? {});
        await repos.upsertScore(post.id, breakdown, score, usage.model);
        await repos.ensureTriage(post.id);
        await repos.logLlmUsage("score", usage);
        promptTokens += usage.promptTokens;
        completionTokens += usage.completionTokens;
        scored++;
      } catch (err) {
        failed++;
        errors.push(`${post.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const result: ScoringResult = { ok: true, scored, failed, promptTokens, completionTokens, errors };
    await repos.finishRun(runId, "ok", { scored, failed, promptTokens, completionTokens });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", { scored, failed }, message);
    throw err;
  }
}
