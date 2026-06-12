/** Send the daily digest:  npm run digest */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runDigest } from "@/lib/email/digest";

async function main(): Promise<void> {
  const result = await runDigest();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log(`\nDigest: ${result.sent ? `sent (${result.count} opportunities)` : "nothing to send"}\n`);
}

main().catch((err: unknown) => {
  console.error("Digest failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
