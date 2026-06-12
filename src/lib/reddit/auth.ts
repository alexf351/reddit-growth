/**
 * Reddit OAuth — application-only by default (grant_type=client_credentials).
 *
 * App-only tokens give read access to public data at the app's rate limit and
 * CANNOT act as a user (no posting/voting/DM) — which enforces the read-only
 * rule at the protocol layer. A "password" fallback exists for the classic
 * script grant if some endpoint ever needs user context; it stays read-only on
 * our side regardless (we never call any write endpoint).
 */
import { getEnv } from "@/lib/env";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

export class MissingRedditCredsError extends Error {
  constructor() {
    super("NO DATA — needs creds (Reddit): set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET");
    this.name = "MissingRedditCredsError";
  }
}

export function hasRedditCreds(): boolean {
  return !!getEnv("REDDIT_CLIENT_ID") && !!getEnv("REDDIT_CLIENT_SECRET");
}

export function redditUserAgent(): string {
  return getEnv("REDDIT_USER_AGENT") ?? "iro-opportunity-finder/0.1 by u/Kiro_ai";
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cache: CachedToken | null = null;

export function clearTokenCache(): void {
  cache = null;
}

export async function getAccessToken(): Promise<string> {
  if (!hasRedditCreds()) throw new MissingRedditCredsError();

  const now = Date.now();
  // refresh a minute early to avoid edge expiry
  if (cache && cache.expiresAt > now + 60_000) return cache.token;

  const clientId = getEnv("REDDIT_CLIENT_ID")!;
  const clientSecret = getEnv("REDDIT_CLIENT_SECRET")!;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams();
  const mode = getEnv("REDDIT_AUTH_MODE") ?? "app_only";
  if (mode === "password") {
    const username = getEnv("REDDIT_USERNAME");
    const password = getEnv("REDDIT_PASSWORD");
    if (!username || !password) {
      throw new Error("REDDIT_AUTH_MODE=password requires REDDIT_USERNAME and REDDIT_PASSWORD");
    }
    body.set("grant_type", "password");
    body.set("username", username);
    body.set("password", password);
  } else {
    body.set("grant_type", "client_credentials");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUserAgent(),
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Reddit auth failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return cache.token;
}
