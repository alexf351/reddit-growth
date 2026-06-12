/**
 * Run competitor mining from the CLI:  npm run mine
 * Reads creds from .env.local. Surfaces NO DATA cleanly.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runMining } from "@/lib/mine";

async function main(): Promise<void> {
  const result = await runMining();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log("\nMining complete:");
  console.log(`  competitors mined:   ${result.competitorsMined}`);
  console.log(`  comments stored:     ${result.commentsStored}`);
  console.log(`  threads linked:      ${result.threadsLinked}`);
  console.log(`  posts injected:      ${result.postsAdded}`);
  console.log(`  saturation checked:  ${result.saturationChecked}`);
  console.log(`  suggested subs/kw:   ${result.suggestedSubreddits} / ${result.suggestedKeywords}`);
  if (result.errors.length) {
    console.log(`  errors (${result.errors.length}):`);
    for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Mining failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
