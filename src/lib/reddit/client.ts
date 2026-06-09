/**
 * Rate-limited, retrying GET wrapper for the Reddit OAuth API.
 * Honors X-Ratelimit-* headers and backs off on 429/5xx.
 * GET-only by design: there is no POST/PUT/DELETE path anywhere in this codebase.
 */
import { getAccessToken, redditUserAgent } from "./auth";

const API_BASE = "https://oauth.reddit.com";

interface RateState {
  remaining: number;
  resetAt: number;
}
const rate: RateState = { remaining: 100, resetAt: 0 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface RedditGetOptions {
  params?: Record<string, string | number | undefined>;
  retries?: number;
}

export async function redditGet<T = unknown>(
  path: string,
  opts: RedditGetOptions = {},
): Promise<T> {
  const { params = {}, retries = 3 } = opts;

  // Proactively wait if we've nearly exhausted the current rate window.
  if (rate.remaining <= 1 && rate.resetAt > Date.now()) {
    await sleep(rate.resetAt - Date.now() + 250);
  }

  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("raw_json", "1");

  let attempt = 0;
  for (;;) {
    const token = await getAccessToken();
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": redditUserAgent(),
      },
      cache: "no-store",
    });

    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining !== null) rate.remaining = Math.floor(parseFloat(remaining));
    if (reset !== null) rate.resetAt = Date.now() + parseFloat(reset) * 1000;

    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const backoff = Math.min(16_000, 2_000 * 2 ** attempt);
      await sleep(backoff);
      attempt++;
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Reddit GET ${path} failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`,
      );
    }

    return (await res.json()) as T;
  }
}
