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
  source: "new" | "rising" | "search";
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
