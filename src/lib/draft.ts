/**
 * P5 orchestration: gather the post + its mention-fit + any competitor comments,
 * generate 1–2 human-reviewed draft comments, store them, log token usage.
 * NO DATA if Supabase or the LLM is unconfigured. Never posts anything.
 */
import { hasSupabaseCreds } from "@/lib/db/client";
import { hasLlmCreds, llmProvider } from "@/lib/llm/provider";
import { generateDrafts, type DraftTone } from "@/lib/llm/draft";
import * as repos from "@/lib/db/repos";
import type { DraftComment } from "@/lib/types";

export interface DraftResult {
  ok: boolean;
  reason?: string;
  drafts: DraftComment[];
}

export interface DraftOptions {
  tone?: DraftTone;
  instruction?: string;
}

export async function generateAndStoreDrafts(
  postId: string,
  opts: DraftOptions = {},
): Promise<DraftResult> {
  if (!hasSupabaseCreds()) return { ok: false, reason: "NO DATA — needs creds (Supabase)", drafts: [] };
  if (!hasLlmCreds()) return { ok: false, reason: `NO DATA — needs creds (LLM: ${llmProvider()})`, drafts: [] };

  const post = await repos.getPostById(postId);
  if (!post) return { ok: false, reason: "post not found", drafts: [] };

  const item = await repos.getQueueItem(postId);
  const mentionFit = item?.mentionFit ?? "helpful_only";
  const competitorComments = (await repos.getCompetitorCommentsForPost(postId)).map((c) => c.body);

  const { drafts, usage } = await generateDrafts({
    title: post.title,
    body: post.selftext,
    subreddit: post.subreddit,
    mentionFit,
    competitorComments,
    tone: opts.tone,
    instruction: opts.instruction,
  });

  await repos.logLlmUsage("draft", usage);
  const stored = await repos.insertDrafts(postId, drafts, usage.model, usage);
  return { ok: true, drafts: stored };
}
