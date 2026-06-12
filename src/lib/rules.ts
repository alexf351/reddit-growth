/**
 * P4 rule refresh: for each target subreddit (config + approved suggestions),
 * fetch its rules and flag whether self-promo/linking is allowed. Default
 * assumption when unknown is strict (null → be helpful-first).
 */
import { targets } from "@config/targets";
import { hasRedditCreds } from "@/lib/reddit/auth";
import { classifySelfPromo, getSubredditRules } from "@/lib/reddit/rules";
import { hasSupabaseCreds } from "@/lib/db/client";
import * as repos from "@/lib/db/repos";

export interface RulesResult {
  ok: boolean;
  reason?: string;
  refreshed: number;
  allowed: number;
  restricted: number;
  unknown: number;
  errors: string[];
}

export async function runRulesRefresh(): Promise<RulesResult> {
  if (!hasRedditCreds()) {
    return { ok: false, reason: "NO DATA — needs creds (Reddit)", refreshed: 0, allowed: 0, restricted: 0, unknown: 0, errors: [] };
  }
  if (!hasSupabaseCreds()) {
    return { ok: false, reason: "NO DATA — needs creds (Supabase)", refreshed: 0, allowed: 0, restricted: 0, unknown: 0, errors: [] };
  }

  const runId = await repos.startRun("rules");
  const errors: string[] = [];
  let refreshed = 0;
  let allowed = 0;
  let restricted = 0;
  let unknown = 0;

  try {
    const approved = await repos.getApprovedSuggestionValues("subreddit");
    const subs = [...new Set([...targets.subreddits, ...approved])];

    for (const sub of subs) {
      try {
        const r = await getSubredditRules(sub);
        const flag = classifySelfPromo(r.combinedText);
        await repos.upsertSubredditRules(sub, flag, r.rules);
        refreshed++;
        if (flag === true) allowed++;
        else if (flag === false) restricted++;
        else unknown++;
      } catch (err) {
        errors.push(`r/${sub}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const result: RulesResult = { ok: true, refreshed, allowed, restricted, unknown, errors };
    await repos.finishRun(runId, "ok", { refreshed, allowed, restricted, unknown });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}
