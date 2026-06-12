/**
 * Scoring config — one tunable place. Final score is 0–100:
 *   base = 100 * (w.relevance*relevance + w.intent*intent
 *                 + w.commentability*commentability + w.mentionFit*mentionFitScore)
 *   total = clamp(base + competitorPresentBoost? + saturationPenalty? + freshnessBonus?, 0, 100)
 * where each sub-score (relevance/intent/commentability/mentionFitScore) is 0..1.
 */
export type MentionFit = "helpful_only" | "iro_relevant";

/**
 * GummySearch-style post themes — the recurring shapes that signal intent.
 * `solution_request` / `advice_request` / `pain_anger` are the money categories;
 * `self_promotion` flags competitor noise; the rest are usually low value.
 */
export const POST_CATEGORIES = [
  "solution_request",
  "advice_request",
  "pain_anger",
  "money_talk",
  "self_promotion",
  "news",
  "idea",
  "discussion",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

/** Human labels for the UI. */
export const CATEGORY_LABELS: Record<PostCategory, string> = {
  solution_request: "solution request",
  advice_request: "advice request",
  pain_anger: "pain / anger",
  money_talk: "money talk",
  self_promotion: "self-promotion",
  news: "news",
  idea: "idea",
  discussion: "discussion",
};

export type Sentiment = "negative" | "neutral" | "positive";

export interface ScoringConfig {
  weights: {
    relevance: number;
    intent: number;
    commentability: number;
    mentionFit: number;
  };
  modifiers: {
    /** A tracked competitor already commented → validated thread worth out-answering. */
    competitorPresentBoost: number;
    /** Thread already has several promo/recommend replies → piling on looks spammy. */
    saturationPenalty: number;
    /** Early on a post = more visibility for a reply. */
    freshnessBonus: number;
    freshnessWindowHours: number;
  };
  saturation: {
    /** >= this many promo/recommend replies already present → apply penalty. */
    promoReplyThreshold: number;
  };
  commentability: {
    penalizeLockedRemoved: boolean;
  };
  mentionFit: {
    /** Default tag until the LLM says otherwise; only iro_relevant items ever mention Iro. */
    default: MentionFit;
  };
  thresholds: {
    /** Below this, hide from the default queue view. */
    queueMinScore: number;
    /** Only items >= this are eligible for the daily digest. */
    digestMinScore: number;
    /** Cap on items in the daily digest. */
    digestTopN: number;
  };
}

export const scoringConfig: ScoringConfig = {
  weights: {
    relevance: 0.3,
    intent: 0.3,
    commentability: 0.25,
    mentionFit: 0.15,
  },
  modifiers: {
    competitorPresentBoost: 10,
    saturationPenalty: -15,
    freshnessBonus: 8,
    freshnessWindowHours: 6,
  },
  saturation: {
    promoReplyThreshold: 3,
  },
  commentability: {
    penalizeLockedRemoved: true,
  },
  mentionFit: {
    default: "helpful_only",
  },
  thresholds: {
    queueMinScore: 40,
    digestMinScore: 60,
    digestTopN: 10,
  },
};
