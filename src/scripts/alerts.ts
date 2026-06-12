/** Send real-time alerts for new high-value opportunities:  npm run alerts */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { runAlerts } from "@/lib/alerts";

async function main(): Promise<void> {
  const result = await runAlerts();
  if (!result.ok) {
    console.log(`\n${result.reason}\n`);
    return;
  }
  console.log(`\nAlerts via ${result.channels.join(", ")}: ${result.alerted} sent, ${result.spikes} spikes\n`);
}

main().catch((err: unknown) => {
  console.error("Alerts failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
