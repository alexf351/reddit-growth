/** Combine LLM sub-scores + computed signals into a 0–100 score. */
import { scoringConfig, type MentionFit, type PostCategory, type Sentiment } from "@config/scoring";
import type { RedditPost } from "@/lib/types";

export interface LlmScore {
  relevance: number; // 0..1
  intent: number; // 0..1
  category: PostCategory;
  sentiment: Sentiment;
  mentionFit: MentionFit;
  why: string;
}

export interface ScoreSignals {
  /** A tracked competitor already commented on the thread (P3). */
  competitorPresent?: boolean;
  /** Count of promo/recommendation replies already present (P3). */
  promoReplyCount?: number;
}

export interface ScoreBreakdown {
  relevance: number;
  intent: number;
  commentability: number;
  mentionFit: MentionFit;
  mentionFitScore: number;
  competitorBoost: number;
  saturationPenalty: number;
  freshnessBonus: number;
  total: number;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

const QUESTION_RE =
  /^(how|what|which|should|is|are|can|could|why|where|who|when|best|help|advice|recommend|looking for|need|tips?)\b/;

/** 0..1 — is this a post where a real answer fits and would be seen? */
export function computeCommentability(post: RedditPost): number {
  if (scoringConfig.commentability.penalizeLockedRemoved && (post.locked || post.removed)) {
    return 0.05;
  }
  let c = 0.55;
  const title = post.title.toLowerCase();
  if (title.includes("?") || QUESTION_RE.test(title)) c += 0.25;
  if (post.numComments >= 1 && post.numComments <= 60) c += 0.1; // some discussion, not a megathread
  if (post.numComments > 200) c -= 0.15;
  return clamp01(c);
}

function freshnessBonus(post: RedditPost): number {
  const ageHours = (Date.now() / 1000 - post.createdUtc) / 3600;
  return ageHours <= scoringConfig.modifiers.freshnessWindowHours
    ? scoringConfig.modifiers.freshnessBonus
    : 0;
}

export function combineScore(
  post: RedditPost,
  llm: LlmScore,
  signals: ScoreSignals = {},
): ScoreBreakdown {
  const w = scoringConfig.weights;
  const relevance = clamp01(llm.relevance);
  const intent = clamp01(llm.intent);
  const commentability = computeCommentability(post);
  const mentionFitScore = llm.mentionFit === "iro_relevant" ? 1 : 0.5;

  const base =
    100 *
    (w.relevance * relevance +
      w.intent * intent +
      w.commentability * commentability +
      w.mentionFit * mentionFitScore);

  const competitorBoost = signals.competitorPresent ? scoringConfig.modifiers.competitorPresentBoost : 0;
  const promo = signals.promoReplyCount ?? 0;
  const saturationPenalty =
    promo >= scoringConfig.saturation.promoReplyThreshold ? scoringConfig.modifiers.saturationPenalty : 0;
  const fresh = freshnessBonus(post);

  const total = Math.max(0, Math.min(100, Math.round(base + competitorBoost + saturationPenalty + fresh)));

  return {
    relevance,
    intent,
    commentability,
    mentionFit: llm.mentionFit,
    mentionFitScore,
    competitorBoost,
    saturationPenalty,
    freshnessBonus: fresh,
    total,
  };
}
