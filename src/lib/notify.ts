/** Notification channels for real-time alerts: Telegram + email (Resend). */
import { getEnv } from "@/lib/env";

export function hasTelegram(): boolean {
  return !!getEnv("TELEGRAM_BOT_TOKEN") && !!getEnv("TELEGRAM_CHAT_ID");
}

export function hasEmail(): boolean {
  return !!getEnv("RESEND_API_KEY") && !!getEnv("DIGEST_FROM") && !!getEnv("DIGEST_TO");
}

export async function sendTelegram(text: string): Promise<void> {
  const token = getEnv("TELEGRAM_BOT_TOKEN")!;
  const chatId = getEnv("TELEGRAM_CHAT_ID")!;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Telegram error ${res.status}: ${t.slice(0, 200)}`);
  }
}

export async function sendEmail(subject: string, html: string): Promise<void> {
  const apiKey = getEnv("RESEND_API_KEY")!;
  const from = getEnv("DIGEST_FROM")!;
  const to = getEnv("DIGEST_TO")!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${t.slice(0, 200)}`);
  }
}
