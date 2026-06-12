import { NextResponse } from "next/server";
import { generateAndStoreDrafts } from "@/lib/draft";
import { DRAFT_TONES, type DraftTone } from "@/lib/llm/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { tone?: string; instruction?: string } | null;
  const tone = (DRAFT_TONES as readonly string[]).includes(body?.tone ?? "") ? (body?.tone as DraftTone) : undefined;
  const instruction = body?.instruction ? String(body.instruction).slice(0, 300) : undefined;
  try {
    const result = await generateAndStoreDrafts(id, { tone, instruction });
    return NextResponse.json(result, { status: result.ok ? 200 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
