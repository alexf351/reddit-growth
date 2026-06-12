/**
 * P10 audience insights: cluster recent high-signal posts into recurring
 * themes/pain points, store the latest batch. NO DATA without Supabase + LLM.
 */
import { hasSupabaseCreds } from "@/lib/db/client";
import { hasLlmCreds, llmProvider } from "@/lib/llm/provider";
import { clusterInsights } from "@/lib/llm/insights";
import * as repos from "@/lib/db/repos";

export interface InsightsResult {
  ok: boolean;
  reason?: string;
  themes: number;
  analyzed: number;
}

export async function runInsights(): Promise<InsightsResult> {
  if (!hasSupabaseCreds()) return { ok: false, reason: "NO DATA — needs creds (Supabase)", themes: 0, analyzed: 0 };
  if (!hasLlmCreds()) return { ok: false, reason: `NO DATA — needs creds (LLM: ${llmProvider()})`, themes: 0, analyzed: 0 };

  const runId = await repos.startRun("insights");
  try {
    const posts = await repos.getRecentSignalPosts(150);
    if (posts.length < 5) {
      await repos.finishRun(runId, "ok", { themes: 0, analyzed: posts.length });
      return { ok: true, themes: 0, analyzed: posts.length };
    }
    const { themes, usage } = await clusterInsights(posts);
    await repos.logLlmUsage("insights", usage);
    await repos.replaceInsights(themes);
    await repos.finishRun(runId, "ok", { themes: themes.length, analyzed: posts.length });
    return { ok: true, themes: themes.length, analyzed: posts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}
