import { NextResponse } from "next/server";
import { createAudience, listAudiences } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, audiences: await listAudiences() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: string; subreddits?: string[] } | null;
  const name = body?.name?.trim();
  const subreddits = Array.isArray(body?.subreddits) ? body!.subreddits : [];
  if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  if (subreddits.length === 0) return NextResponse.json({ ok: false, error: "at least one subreddit required" }, { status: 400 });
  try {
    const audience = await createAudience(name, subreddits);
    return NextResponse.json({ ok: true, audience });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
