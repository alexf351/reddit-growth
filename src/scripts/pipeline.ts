/**
 * Run the full pipeline end-to-end:  npm run pipeline
 * ingest → score → mine. Handy for manual/local runs without cron.
 * Each step is NO DATA aware and won't fabricate.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runIngest } from "@/lib/ingest";
import { runScoring } from "@/lib/score";
import { runMining } from "@/lib/mine";

async function main(): Promise<void> {
  console.log("\n[1/3] ingest…");
  const ingest = await runIngest();
  console.log(ingest.ok ? `  stored ${ingest.stored} (${ingest.newPosts} new)` : `  ${ingest.reason}`);

  console.log("[2/3] score…");
  const score = await runScoring(100);
  console.log(score.ok ? `  scored ${score.scored} (tokens ${score.promptTokens}/${score.completionTokens})` : `  ${score.reason}`);

  console.log("[3/3] mine competitors…");
  const mine = await runMining();
  console.log(
    mine.ok
      ? `  ${mine.competitorsMined} competitors, ${mine.postsAdded} threads injected, ${mine.suggestedSubreddits}+${mine.suggestedKeywords} suggestions`
      : `  ${mine.reason}`,
  );
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Pipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
