/**
 * Run scoring from the CLI:  npm run score [limit]
 * Reads creds from .env.local. Surfaces NO DATA cleanly.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runScoring } from "@/lib/score";

async function main(): Promise<void> {
  const limit = Number(process.argv[2] ?? "50");
  const result = await runScoring(Number.isFinite(limit) ? limit : 50);
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log("\nScoring complete:");
  console.log(`  scored:           ${result.scored}`);
  console.log(`  failed:           ${result.failed}`);
  console.log(`  tokens (in/out):  ${result.promptTokens} / ${result.completionTokens}`);
  if (result.errors.length) {
    console.log(`  errors (${result.errors.length}):`);
    for (const e of result.errors.slice(0, 10)) console.log(`    - ${e}`);
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Scoring failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
