/** LLM relevance + intent + mention-fit for a single post. */
import { product } from "@config/product";
import { POST_CATEGORIES } from "@config/scoring";
import type { RedditPost } from "@/lib/types";
import { generateJSON, type LlmUsage } from "./provider";
import type { LlmScore } from "@/lib/scoring/score";

interface RawScore {
  relevance: number;
  intent: number;
  category: string;
  sentiment: string;
  mention_fit: string;
  why: string;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevance: { type: "number", description: "0..1, how well the topic matches what the product helps with" },
    intent: { type: "number", description: "0..1, is the author seeking help/solution/recommendation" },
    category: { type: "string", enum: [...POST_CATEGORIES] },
    sentiment: { type: "string", enum: ["negative", "neutral", "positive"] },
    mention_fit: { type: "string", enum: ["helpful_only", "iro_relevant"] },
    why: { type: "string", description: "one short lowercase line, no em dashes" },
  },
  required: ["relevance", "intent", "category", "sentiment", "mention_fit", "why"],
};

export async function scorePostWithLlm(
  post: RedditPost,
): Promise<{ score: LlmScore; usage: LlmUsage }> {
  const system =
    `You triage Reddit posts for ${product.name} (${product.url}). ${product.description}\n` +
    `Be strict and honest. Do not inflate scores. Most posts are NOT relevant.`;

  const body = post.selftext ? post.selftext.slice(0, 1500) : "(no body text)";
  const user =
    `Subreddit: r/${post.subreddit}\nTitle: ${post.title}\nBody: ${body}\n\n` +
    `Score this post:\n` +
    `- relevance (0..1): does it match what ${product.name} actually helps with?\n` +
    `- intent (0..1): is the author looking for a solution/help/recommendation (high) vs venting, news, or meta (low)?\n` +
    `- category: the post's shape. solution_request = wants a tool/solution; advice_request = wants how-to/guidance; pain_anger = venting a frustration/problem; money_talk = pricing/ROI/cost; self_promotion = author plugging something; news; idea; discussion.\n` +
    `- sentiment: negative | neutral | positive.\n` +
    `- mention_fit: "iro_relevant" ONLY if naming ${product.name} would genuinely help this person; otherwise "helpful_only".\n` +
    `- why: one short lowercase line explaining the call.`;

  const { data, usage } = await generateJSON<RawScore>({ system, user, schema, maxTokens: 450 });

  const category = (POST_CATEGORIES as readonly string[]).includes(data.category)
    ? (data.category as LlmScore["category"])
    : "discussion";
  const sentiment =
    data.sentiment === "negative" || data.sentiment === "positive" ? data.sentiment : "neutral";

  const score: LlmScore = {
    relevance: Number(data.relevance) || 0,
    intent: Number(data.intent) || 0,
    category,
    sentiment,
    mentionFit: data.mention_fit === "iro_relevant" ? "iro_relevant" : "helpful_only",
    why: (data.why ?? "").slice(0, 280),
  };
  return { score, usage };
}
