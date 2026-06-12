import { NextResponse } from "next/server";
import { runInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    return NextResponse.json(await runInsights());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
