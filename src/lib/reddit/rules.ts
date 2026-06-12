/** Subreddit self-promotion rule flagging (read-only). */
import { redditGet } from "./client";

interface RawRules {
  rules?: { short_name?: string; description?: string }[];
}

export interface SubredditRules {
  rules: { name: string; description: string }[];
  combinedText: string;
}

export async function getSubredditRules(sub: string): Promise<SubredditRules> {
  const data = await redditGet<RawRules>(`/r/${sub}/about/rules`);
  const rules = (data.rules ?? []).map((r) => ({
    name: r.short_name ?? "",
    description: r.description ?? "",
  }));
  const combinedText = rules.map((r) => `${r.name} ${r.description}`).join("\n").toLowerCase();
  return { rules, combinedText };
}

const DISALLOW = [
  /no self[-\s]?promo/,
  /self[-\s]?promotion is not/,
  /no advertis/,
  /no promotion/,
  /no referral/,
  /\b9\s*[:]\s*1\b/,
  /\b1\s*[:]\s*9\b/,
  /no spam/,
  /not a place to (promote|advertise)/,
  /promotion[^.]{0,30}not allowed/,
];
const ALLOW = [/self[-\s]?promotion is allowed/, /promo(tion)? allowed/, /you (may|can) self[-\s]?promote/];

/** true = explicitly allowed, false = explicitly restricted, null = unknown (treat as strict). */
export function classifySelfPromo(text: string): boolean | null {
  if (ALLOW.some((r) => r.test(text))) return true;
  if (DISALLOW.some((r) => r.test(text))) return false;
  return null;
}
