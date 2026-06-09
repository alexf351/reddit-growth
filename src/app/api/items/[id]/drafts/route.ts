import { NextResponse } from "next/server";
import { generateAndStoreDrafts } from "@/lib/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const result = await generateAndStoreDrafts(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
