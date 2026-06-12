/** Discover new subreddits:  npm run discover ["keyword" ...] */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runDiscovery } from "@/lib/discover";

async function main(): Promise<void> {
  const queries = process.argv.slice(2);
  const result = await runDiscovery(queries.length ? queries : undefined);
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log(`\nDiscovery: ${result.candidates} candidates → ${result.suggested} new suggestions (approve in /competitors)`);
  if (result.errors.length) for (const e of result.errors.slice(0, 8)) console.log(`  - ${e}`);
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Discovery failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
