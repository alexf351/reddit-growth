import { hasSupabaseCreds } from "@/lib/db/client";
import { getTriageQueue } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!hasSupabaseCreds()) {
    return new Response("NO DATA — needs creds (Supabase)", { status: 200 });
  }

  const items = await getTriageQueue({ limit: 2000, includeDismissed: true });
  const header = [
    "total", "category", "sentiment", "mention_fit", "status", "subreddit",
    "num_comments", "competitor_count", "promo_replies", "self_promo_allowed",
    "why", "permalink",
  ];
  const rows = items.map((i) =>
    [
      i.total, i.category, i.sentiment, i.mentionFit, i.status, i.subreddit,
      i.numComments, i.competitorCount, i.promoReplyCount,
      i.selfPromoAllowed === null ? "unknown" : i.selfPromoAllowed,
      i.why, i.permalink,
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.map(csvCell).join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="iro-opportunities-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
