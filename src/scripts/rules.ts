/** Refresh subreddit self-promo flags:  npm run rules */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runRulesRefresh } from "@/lib/rules";

async function main(): Promise<void> {
  const result = await runRulesRefresh();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log("\nRules refresh complete:");
  console.log(`  refreshed:   ${result.refreshed}`);
  console.log(`  allowed:     ${result.allowed}`);
  console.log(`  restricted:  ${result.restricted}`);
  console.log(`  unknown:     ${result.unknown}`);
  if (result.errors.length) {
    console.log(`  errors (${result.errors.length}):`);
    for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Rules refresh failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
