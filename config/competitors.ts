/**
 * Tracked competitor Reddit accounts. We read ONLY their public comment history
 * (same read-only API) to learn where demand is and which threads to out-answer.
 * We never contact, reply to, or interact with these accounts.
 */
export interface CompetitorConfig {
  /** Reddit username without the "u/" prefix. */
  username: string;
  /** Human-friendly label for the UI. */
  label: string;
  notes?: string;
}

export const competitors: CompetitorConfig[] = [
  {
    username: "Simplilearn",
    label: "Simplilearn",
    notes: "Proven: ~5 promo comments/day across AI-learning subs (seed account).",
  },
  // Add others as you find them (e.g. Coursiv's account if one exists).
];
