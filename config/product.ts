/**
 * What Iro is + the voice for drafts. The LLM reads `description` to judge
 * relevance and mention-fit, and `voice` to write drafts (P5).
 *
 * EDIT THIS to match Iro precisely — the more accurate it is, the better the
 * relevance/mention-fit scoring. Keep it factual; don't oversell.
 */
export const product = {
  name: "Iro",
  handle: "Kiro_ai", // the Reddit account that comments (without u/)
  url: "tryiro.com",
  description:
    "Iro is an app that helps people actually learn AI skills — getting better at " +
    "prompting, using ChatGPT/Claude/Gemini well for real work, and building a practical " +
    "path to learn AI (and adjacent things like learning to code) without buying into " +
    "overpriced courses. Positioning is honest-reviewer / helpful-first, not a course seller.",
  // Used by the draft module (P5). Human, not marketing.
  voice:
    "lowercase-casual, no em dashes, no corporate or marketing tone, answer the person's " +
    "actual question first, only mention Iro when it genuinely helps and always disclose it's my app.",
} as const;
