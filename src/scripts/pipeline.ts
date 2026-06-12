/**
 * Run the full pipeline end-to-end:  npm run pipeline
 * ingest → score → mine → discover → insights → alerts.
 * Handy for manual/local runs without cron. Each step is NO DATA aware.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runIngest } from "@/lib/ingest";
import { runScoring } from "@/lib/score";
import { runMining } from "@/lib/mine";
import { runDiscovery } from "@/lib/discover";
import { runInsights } from "@/lib/insights";
import { runAlerts } from "@/lib/alerts";

async function step(label: string, fn: () => Promise<{ ok: boolean; reason?: string }>, fmt: (r: any) => string) {
  process.stdout.write(`  ${label}… `);
  try {
    const r = await fn();
    console.log(r.ok ? fmt(r) : r.reason);
  } catch (err) {
    console.log(`failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main(): Promise<void> {
  console.log("\nrunning full pipeline:\n");
  await step("ingest", runIngest, (r) => `stored ${r.stored} (${r.newPosts} new)`);
  await step("score", () => runScoring(100), (r) => `scored ${r.scored} (${r.promptTokens}/${r.completionTokens} tokens)`);
  await step("mine", runMining, (r) => `${r.postsAdded} threads, ${r.suggestedSubreddits}+${r.suggestedKeywords} suggestions`);
  await step("discover", () => runDiscovery(), (r) => `${r.suggested} subreddit suggestions`);
  await step("insights", runInsights, (r) => `${r.themes} themes from ${r.analyzed} posts`);
  await step("alerts", runAlerts, (r) => `${r.alerted} alerted, ${r.spikes} spikes`);
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Pipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
