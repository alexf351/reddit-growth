/**
 * P4 daily digest via Resend: top N opportunities + one-line why + links, plus
 * a competitor-activity section (out-answer threads + pending suggestions).
 * NO DATA if Supabase or Resend creds are missing. Never sends an empty digest.
 */
import { product } from "@config/product";
import { scoringConfig } from "@config/scoring";
import { getEnv } from "@/lib/env";
import { hasSupabaseCreds } from "@/lib/db/client";
import { getPendingSuggestions, getTriageQueue } from "@/lib/db/repos";
import type { TriageItem } from "@/lib/types";

export interface DigestResult {
  ok: boolean;
  reason?: string;
  sent: boolean;
  count: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ageHours(createdUtc: number): string {
  const h = (Date.now() / 1000 - createdUtc) / 3600;
  return h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
}

function itemRow(i: TriageItem): string {
  const flags: string[] = [];
  if (i.mentionFit === "iro_relevant") flags.push("iro-relevant");
  if (i.competitorCount > 0) flags.push(`competitor: u/${esc(i.competitors[0]?.username ?? "?")}`);
  if (i.selfPromoAllowed === false) flags.push("promo: strict");
  return `
    <tr>
      <td style="padding:8px 10px;vertical-align:top;font-weight:600;color:#111;">${i.total}</td>
      <td style="padding:8px 10px;vertical-align:top;">
        <a href="${esc(i.permalink)}" style="color:#0b69d4;text-decoration:none;font-weight:600;">${esc(i.title)}</a>
        <div style="color:#666;font-size:12px;margin-top:2px;">
          r/${esc(i.subreddit)} · ${ageHours(i.createdUtc)} old · ${i.numComments} comments${flags.length ? " · " + flags.map(esc).join(" · ") : ""}
        </div>
        ${i.why ? `<div style="color:#444;font-size:13px;margin-top:4px;">${esc(i.why)}</div>` : ""}
      </td>
    </tr>`;
}

function buildHtml(top: TriageItem[], competitor: TriageItem[], pending: { type: string; value: string }[]): string {
  const appUrl = getEnv("APP_URL");
  const inboxLink = appUrl ? `<p><a href="${esc(appUrl)}" style="color:#0b69d4;">Open the triage inbox →</a></p>` : "";

  const topRows = top.map(itemRow).join("");
  const compRows = competitor.map(itemRow).join("");
  const suggestionList = pending.length
    ? `<ul>${pending
        .slice(0, 15)
        .map((s) => `<li>${esc(s.type)}: <strong>${esc(s.value)}</strong></li>`)
        .join("")}</ul>`
    : "<p style='color:#666;'>None pending.</p>";

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#111;">
    <h2 style="margin-bottom:4px;">${esc(product.name)} — Reddit opportunities</h2>
    <p style="color:#666;margin-top:0;">Top ${top.length} threads worth a comment today. You post manually.</p>
    ${inboxLink}
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">${topRows || "<tr><td style='padding:10px;color:#666;'>Nothing above threshold today.</td></tr>"}</table>

    <h3 style="margin-top:28px;">Competitor activity</h3>
    ${
      compRows
        ? `<p style="color:#666;margin:0 0 6px;">Out-answer opportunities (a tracked competitor already commented):</p>
           <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;">${compRows}</table>`
        : "<p style='color:#666;'>No new competitor-present threads.</p>"
    }
    <p style="margin-top:14px;"><strong>Pending suggestions</strong> (approve in the app):</p>
    ${suggestionList}

    <p style="color:#999;font-size:12px;margin-top:28px;">
      Read-only, human-in-the-loop. Nothing here is auto-posted. Drafts are suggestions you edit.
    </p>
  </div>`;
}

export async function runDigest(): Promise<DigestResult> {
  if (!hasSupabaseCreds()) return { ok: false, reason: "NO DATA — needs creds (Supabase)", sent: false, count: 0 };

  const apiKey = getEnv("RESEND_API_KEY");
  const to = getEnv("DIGEST_TO");
  const from = getEnv("DIGEST_FROM");
  if (!apiKey || !to || !from) {
    return {
      ok: false,
      reason: "NO DATA — needs creds (Resend: RESEND_API_KEY / DIGEST_FROM / DIGEST_TO)",
      sent: false,
      count: 0,
    };
  }

  const queue = await getTriageQueue({ limit: 500 });
  const fresh = queue.filter((i) => i.status === "new" && i.total >= scoringConfig.thresholds.digestMinScore);
  const top = fresh.slice(0, scoringConfig.thresholds.digestTopN);
  const competitor = fresh.filter((i) => i.competitorCount > 0).slice(0, 10);
  const pending = await getPendingSuggestions();

  // Don't send a digest with nothing in it.
  if (top.length === 0 && competitor.length === 0 && pending.length === 0) {
    return { ok: true, sent: false, count: 0 };
  }

  const subject = `${product.name} Reddit digest — ${top.length} opportunities (${new Date().toLocaleDateString()})`;
  const html = buildHtml(top, competitor, pending);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${t.slice(0, 200)}`);
  }

  return { ok: true, sent: true, count: top.length };
}
