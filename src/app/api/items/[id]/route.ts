import { NextResponse } from "next/server";
import { updateTriageStatus } from "@/lib/db/repos";
import type { TriageStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED: TriageStatus[] = ["new", "commented", "dismissed", "saved"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { status?: string; note?: string } | null;
  const status = body?.status as TriageStatus | undefined;

  if (!status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: `invalid status; expected one of ${ALLOWED.join(", ")}` }, { status: 400 });
  }

  try {
    await updateTriageStatus(id, status, body?.note);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
