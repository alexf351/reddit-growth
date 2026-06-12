/**
 * Run the full P1 ingest from the CLI:  npm run ingest
 * Reads creds from .env.local. Prints a summary; surfaces NO DATA cleanly.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runIngest } from "@/lib/ingest";

async function main(): Promise<void> {
  const result = await runIngest();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log("\nIngest complete:");
  console.log(`  fetched:        ${result.fetched}`);
  console.log(`  unique:         ${result.unique}`);
  console.log(`  new posts:      ${result.newPosts}`);
  console.log(`  stored:         ${result.stored}`);
  console.log(`  skipped (engaged already): ${result.skippedEngaged}`);
  if (result.errors.length) {
    console.log(`  per-source errors (${result.errors.length}):`);
    for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Ingest failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
