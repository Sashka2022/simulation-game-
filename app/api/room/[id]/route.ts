import { NextRequest, NextResponse } from "next/server";
import {
  getRoom,
  identify,
  snapshot,
  command,
  rateLimit,
} from "../../../../lib/store";
import { error, originCheck } from "../../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const r = getRoom(id);
    const credential = req.cookies.get("room_" + id)?.value || "";
    const actor = identify(
      r,
      credential,
      req.headers.get("x-projector-token") || undefined,
    );
    return NextResponse.json(snapshot(r, actor, credential), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    const { id } = await params;
    rateLimit("room:" + id, 300);
    const raw = await req.text();
    if (raw.length > 30000) throw Error("בקשה גדולה מדי");
    const b = JSON.parse(raw);
    if (
      typeof b.commandId !== "string" ||
      b.commandId.length > 100 ||
      !Number.isInteger(b.revision)
    )
      throw Error("פקודה לא תקינה");
    command(
      id,
      req.cookies.get("room_" + id)?.value || "",
      b.action,
      b.commandId,
      b.revision,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e);
  }
}
