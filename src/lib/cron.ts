/**
 * Shared guard for /api/cron/* routes. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set in the project.
 * If CRON_SECRET is unset (e.g. local dev) we allow the call so routes are
 * testable, but production should always set it.
 */
import { getEnv } from "@/lib/env";

export function authorizeCron(req: Request): boolean {
  const secret = getEnv("CRON_SECRET");
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
