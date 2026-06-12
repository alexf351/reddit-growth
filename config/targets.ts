/**
 * Target lists — edit these freely. The ingest pulls new/rising posts from
 * `subreddits` and runs `keywords` as searches across Reddit, then drops
 * anything matching `negativeKeywords`.
 *
 * No silent changes: competitor mining (P3) only *suggests* additions here via
 * the suggestions queue — you approve before anything lands in this file.
 */
export interface TargetConfig {
  subreddits: string[];
  keywords: string[];
  negativeKeywords: string[];
}

export const targets: TargetConfig = {
  subreddits: [
    // AI / LLM tools
    "ChatGPT",
    "OpenAI",
    "ClaudeAI",
    "artificial",
    "ArtificialIntelligence",
    "PromptEngineering",
    "perplexity_ai",
    "GoogleGemini", // verify exact Gemini sub name; prune if wrong
    // productivity / growth / career
    "productivity",
    "selfimprovement",
    "careerguidance",
    "learnprogramming",
    "Entrepreneur",
    "sidehustle",
    // question-farm subs competitors use
    "cscareerquestions",
    "AskProgramming",
    "techbootcamp",
    "AI_Agents",
    "aiagents",
    "AILearningHub",
    "GenAI4all",
    "AIIncomeLab",
  ],
  keywords: [
    "how to learn AI",
    "get better at prompting",
    "ChatGPT for work",
    "AI skills for my job",
    "which AI course",
    "is X course worth it",
    "learn AI as a beginner",
    "best path to becoming a developer 2026",
    "worth learning to code in 2026",
  ],
  negativeKeywords: [
    "nsfw",
    "onlyfans",
    "giveaway",
    "airdrop",
    "hiring",
    "for hire",
    "promo code",
  ],
};
