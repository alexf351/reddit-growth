/** Typed wrappers over the read-only Reddit listing/search/user endpoints. */
import { redditGet } from "./client";
import type { RedditComment, RedditPost } from "@/lib/types";

interface RawListing<T> {
  kind: string;
  data: {
    after: string | null;
    before: string | null;
    children: { kind: string; data: T }[];
  };
}

interface RawPost {
  id: string;
  name: string;
  subreddit: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  url: string;
  created_utc: number;
  num_comments: number;
  score: number;
  upvote_ratio: number;
  over_18: boolean;
  locked: boolean;
  removed_by_category?: string | null;
}

interface RawComment {
  id: string;
  name: string;
  author: string;
  body: string;
  permalink: string;
  created_utc: number;
  score: number;
  subreddit: string;
  link_id: string;
  link_title?: string;
}

function normalizePost(
  raw: RawPost,
  source: RedditPost["source"],
  searchKeyword?: string,
): RedditPost {
  return {
    id: raw.name,
    shortId: raw.id,
    subreddit: raw.subreddit,
    title: raw.title,
    selftext: raw.selftext ?? "",
    author: raw.author,
    permalink: `https://www.reddit.com${raw.permalink}`,
    url: raw.url,
    createdUtc: raw.created_utc,
    numComments: raw.num_comments,
    score: raw.score,
    upvoteRatio: raw.upvote_ratio,
    over18: raw.over_18,
    locked: raw.locked,
    removed: Boolean(raw.removed_by_category),
    source,
    searchKeyword,
  };
}

function normalizeComment(raw: RawComment): RedditComment {
  return {
    id: raw.name,
    author: raw.author,
    body: raw.body,
    permalink: `https://www.reddit.com${raw.permalink}`,
    createdUtc: raw.created_utc,
    score: raw.score,
    subreddit: raw.subreddit,
    parentPostId: raw.link_id,
    parentPostTitle: raw.link_title,
  };
}

/** Pull `new` or `rising` posts from a subreddit. */
export async function getSubredditPosts(
  subreddit: string,
  sort: "new" | "rising" = "new",
  limit = 50,
): Promise<RedditPost[]> {
  const data = await redditGet<RawListing<RawPost>>(`/r/${subreddit}/${sort}`, {
    params: { limit },
  });
  return data.data.children
    .filter((c) => c.kind === "t3")
    .map((c) => normalizePost(c.data, sort));
}

/** Keyword search, optionally restricted to one subreddit. */
export async function searchReddit(
  query: string,
  opts: { subreddit?: string; limit?: number; sort?: string; t?: string } = {},
): Promise<RedditPost[]> {
  const { subreddit, limit = 50, sort = "new", t = "week" } = opts;
  const path = subreddit ? `/r/${subreddit}/search` : `/search`;
  const params: Record<string, string | number> = { q: query, limit, sort, t, type: "link" };
  if (subreddit) params.restrict_sr = "true";
  const data = await redditGet<RawListing<RawPost>>(path, { params });
  return data.data.children
    .filter((c) => c.kind === "t3")
    .map((c) => normalizePost(c.data, "search", query));
}

interface RawSubreddit {
  display_name: string;
  subscribers: number | null;
  public_description: string;
  over18: boolean;
  active_user_count?: number | null;
}

export interface SubredditHit {
  name: string;
  subscribers: number;
  activeUsers: number | null;
  description: string;
  over18: boolean;
}

/** Search for subreddits by topic (audience discovery). */
export async function searchSubreddits(query: string, limit = 25): Promise<SubredditHit[]> {
  const data = await redditGet<RawListing<RawSubreddit>>(`/subreddits/search`, {
    params: { q: query, limit },
  });
  return data.data.children
    .filter((c) => c.kind === "t5")
    .map((c) => ({
      name: c.data.display_name,
      subscribers: c.data.subscribers ?? 0,
      activeUsers: c.data.active_user_count ?? null,
      description: c.data.public_description ?? "",
      over18: c.data.over18,
    }));
}

/** Public comment history for a user (competitor mining + our own dedup). */
export async function getUserComments(
  username: string,
  opts: { limit?: number; after?: string } = {},
): Promise<{ comments: RedditComment[]; after: string | null }> {
  const { limit = 100, after } = opts;
  const data = await redditGet<RawListing<RawComment>>(`/user/${username}/comments`, {
    params: { limit, after },
  });
  const comments = data.data.children
    .filter((c) => c.kind === "t1")
    .map((c) => normalizeComment(c.data));
  return { comments, after: data.data.after };
}

/** Page through a user's comment history up to `max` comments. */
export async function getUserCommentsPaged(username: string, max = 200): Promise<RedditComment[]> {
  const out: RedditComment[] = [];
  let after: string | null | undefined;
  while (out.length < max) {
    const page = await getUserComments(username, { limit: 100, after: after ?? undefined });
    out.push(...page.comments);
    if (!page.after) break;
    after = page.after;
  }
  return out.slice(0, max);
}

/** Fetch full posts by fullname (t3_...). Batches of up to 100 via /api/info. */
export async function getPostsByIds(ids: string[]): Promise<RedditPost[]> {
  const out: RedditPost[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const data = await redditGet<RawListing<RawPost>>(`/api/info`, { params: { id: batch.join(",") } });
    out.push(
      ...data.data.children.filter((c) => c.kind === "t3").map((c) => normalizePost(c.data, "competitor")),
    );
  }
  return out;
}

/** Top-level comment bodies for a post (for saturation heuristics). */
export async function getPostTopComments(shortId: string, limit = 50): Promise<string[]> {
  // The comments endpoint returns [postListing, commentsListing].
  const data = await redditGet<[RawListing<RawPost>, RawListing<RawComment>]>(
    `/comments/${shortId}`,
    { params: { limit, depth: 1, sort: "top" } },
  );
  const commentsListing = data[1];
  return commentsListing.data.children
    .filter((c) => c.kind === "t1")
    .map((c) => c.data.body ?? "");
}
