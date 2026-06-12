/**
 * P9 real-time alerts: push the genuinely hot, brand-new opportunities (and any
 * subreddit volume spikes) the moment they appear, via Telegram (instant) or
 * email. Deduped so you're never pinged about the same thread twice. Run this
 * on a tight cron (e.g. every 30 min). NO DATA without Supabase + a channel.
 */
import { scoringConfig } from "@config/scoring";
import { product } from "@config/product";
import { getEnv } from "@/lib/env";
import { hasSupabaseCreds } from "@/lib/db/client";
import { hasEmail, hasTelegram, sendEmail, sendTelegram } from "@/lib/notify";
import * as repos from "@/lib/db/repos";
import type { TriageItem } from "@/lib/types";

export interface AlertResult {
  ok: boolean;
  reason?: string;
  alerted: number;
  spikes: number;
  channels: string[];
}

function alertMinScore(): number {
  const e = Number(getEnv("ALERT_MIN_SCORE"));
  return Number.isFinite(e) && e > 0 ? e : scoringConfig.thresholds.alertMinScore;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function alertHtml(items: TriageItem[], min: number): string {
  const rows = items
    .map(
      (i) =>
        `<li style="margin-bottom:10px;"><a href="${esc(i.permalink)}"><strong>${i.total}</strong> · ${esc(i.title)}</a><br><span style="color:#666;font-size:12px;">r/${esc(i.subreddit)} · ${esc(i.category ?? "")}${i.competitorCount ? " · competitor present" : ""}</span></li>`,
    )
    .join("");
  return `<div style="font-family:sans-serif;"><h3>${esc(product.name)}: ${items.length} new high-value opportunit${items.length > 1 ? "ies" : "y"} (≥${min})</h3><ul style="list-style:none;padding:0;">${rows}</ul></div>`;
}

export async function runAlerts(): Promise<AlertResult> {
  if (!hasSupabaseCreds()) return { ok: false, reason: "NO DATA — needs creds (Supabase)", alerted: 0, spikes: 0, channels: [] };

  const channels: string[] = [];
  if (hasTelegram()) channels.push("telegram");
  if (hasEmail()) channels.push("email");
  if (channels.length === 0) {
    return {
      ok: false,
      reason: "NO DATA — needs creds (alerts: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, or Resend)",
      alerted: 0,
      spikes: 0,
      channels: [],
    };
  }

  const runId = await repos.startRun("alerts");
  try {
    const min = alertMinScore();
    const queue = await repos.getTriageQueue({ limit: 200 });
    const candidates = queue.filter((i) => i.status === "new" && i.total >= min);
    const already = await repos.getAlertedPostIds(candidates.map((i) => i.postId));
    const fresh = candidates.filter((i) => !already.has(i.postId)).slice(0, 10);
    const spikes = await repos.getSpikes();

    if (fresh.length > 0) {
      if (hasTelegram()) {
        const lines = fresh
          .map((i) => `*${i.total}* ${i.title}\nr/${i.subreddit}${i.competitorCount ? " · competitor" : ""}\n${i.permalink}`)
          .join("\n\n");
        await sendTelegram(`🎯 ${fresh.length} new high-value reddit opportunit${fresh.length > 1 ? "ies" : "y"} (≥${min})\n\n${lines}`);
      } else if (hasEmail()) {
        // Only email-alert when Telegram isn't set, so the daily digest stays the main email.
        await sendEmail(`${product.name}: ${fresh.length} new high-value reddit opportunities`, alertHtml(fresh, min));
      }
      await repos.markAlerted(fresh.map((i) => i.postId));
    }

    if (spikes.length > 0 && hasTelegram()) {
      await sendTelegram(`📈 trending subs: ${spikes.slice(0, 5).map((s) => `r/${s.subreddit} (${s.today} today, ${s.ratio}x)`).join(", ")}`);
    }

    await repos.finishRun(runId, "ok", { alerted: fresh.length, spikes: spikes.length });
    return { ok: true, alerted: fresh.length, spikes: spikes.length, channels };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await repos.finishRun(runId, "error", null, message);
    throw err;
  }
}
