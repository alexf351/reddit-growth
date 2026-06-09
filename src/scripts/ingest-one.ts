/**
 * P0 smoke test — ingest ONE subreddit end-to-end and print the results.
 *
 *   npm run ingest:one            # uses the first subreddit in config/targets.ts
 *   npm run ingest:one -- ClaudeAI
 *
 * Reads creds from .env.local. With no creds it prints "NO DATA — needs creds"
 * (and exits 0) rather than failing or inventing numbers.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { NO_DATA } from "@/lib/env";
import { hasRedditCreds } from "@/lib/reddit/auth";
import { getSubredditPosts } from "@/lib/reddit/listings";
import { targets } from "@config/targets";

async function main(): Promise<void> {
  const sub = process.argv[2] ?? targets.subreddits[0];

  if (!hasRedditCreds()) {
    console.log(`\n${NO_DATA}`);
    console.log("Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local (see .env.example).");
    console.log("Create a 'script' app at https://www.reddit.com/prefs/apps\n");
    return;
  }

  console.log(`\nIngesting r/${sub} (new + rising)...\n`);

  const [newPosts, risingPosts] = await Promise.all([
    getSubredditPosts(sub, "new", 25),
    getSubredditPosts(sub, "rising", 25),
  ]);

  // Dedup by id; a post seen in both lists is counted once.
  const byId = new Map<string, RedditPostLite>();
  for (const p of newPosts) byId.set(p.id, p);
  for (const p of risingPosts) if (!byId.has(p.id)) byId.set(p.id, p);

  const posts = [...byId.values()].sort((a, b) => b.createdUtc - a.createdUtc);

  console.log(
    `Found ${posts.length} unique posts (${newPosts.length} new, ${risingPosts.length} rising)\n`,
  );

  for (const p of posts.slice(0, 30)) {
    const ageH = ((Date.now() / 1000 - p.createdUtc) / 3600).toFixed(1);
    const flags = [
      p.locked ? "locked" : "",
      p.removed ? "removed" : "",
      p.over18 ? "nsfw" : "",
    ]
      .filter(Boolean)
      .join(",");
    console.log(`• [${ageH}h] (${p.score}↑ ${p.numComments}c) ${p.title}`);
    console.log(`  ${p.permalink}${flags ? `  [${flags}]` : ""}`);
  }
  console.log("");
}

type RedditPostLite = Awaited<ReturnType<typeof getSubredditPosts>>[number];

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Ingest failed:", msg);
  process.exit(1);
});
