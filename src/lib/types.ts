/** Normalized shapes we use internally (decoupled from Reddit's raw JSON). */

export interface RedditPost {
  /** Reddit fullname, e.g. "t3_abc123". */
  id: string;
  /** Base-36 id, e.g. "abc123". */
  shortId: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  /** Absolute URL to the comments page. */
  permalink: string;
  /** External/link URL (equals permalink for self posts). */
  url: string;
  /** Unix seconds. */
  createdUtc: number;
  numComments: number;
  score: number;
  upvoteRatio: number;
  over18: boolean;
  locked: boolean;
  removed: boolean;
  source: "new" | "rising" | "search" | "competitor";
  /** Set when source === "search". */
  searchKeyword?: string;
}

export interface RedditComment {
  /** Reddit fullname, e.g. "t1_abc123". */
  id: string;
  author: string;
  body: string;
  permalink: string;
  createdUtc: number;
  score: number;
  subreddit: string;
  /** Parent post fullname, e.g. "t3_xyz789" (Reddit "link_id"). */
  parentPostId: string;
  parentPostTitle?: string;
}

export type MentionFit = "helpful_only" | "iro_relevant";
export type TriageStatus = "new" | "commented" | "dismissed" | "saved";

/** A row of the triage queue (post + score + status), flattened for the UI. */
export interface TriageItem {
  postId: string;
  subreddit: string;
  title: string;
  permalink: string;
  author: string | null;
  createdUtc: number;
  numComments: number;
  postScore: number;
  locked: boolean;
  removed: boolean;
  relevance: number;
  intent: number;
  commentability: number;
  mentionFit: MentionFit;
  competitorBoost: number;
  saturationPenalty: number;
  freshnessBonus: number;
  total: number;
  why: string | null;
  model: string | null;
  category: string | null;
  sentiment: string | null;
  status: TriageStatus;
  competitorCount: number;
  competitors: { username: string; commentPermalink: string | null }[];
  promoReplyCount: number;
  /** true = allowed, false = restricted, null = unknown (treat as strict). */
  selfPromoAllowed: boolean | null;
}

export interface Audience {
  id: string;
  name: string;
  subreddits: string[];
}

export interface DraftComment {
  id: string;
  postId: string;
  variant: number;
  body: string;
  mentionsIro: boolean;
  model: string | null;
  createdAt: string;
}
