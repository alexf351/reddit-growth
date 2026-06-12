/** Cluster recent high-signal posts into audience insights:  npm run insights */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runInsights } from "@/lib/insights";

async function main(): Promise<void> {
  const result = await runInsights();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log(`\nInsights: analyzed ${result.analyzed} posts → ${result.themes} themes\n`);
}

main().catch((err: unknown) => {
  console.error("Insights failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
