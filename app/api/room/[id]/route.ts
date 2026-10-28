import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSnapshot, command, rateLimit } from "../../../../lib/store";
import { error, originCheck } from "../../../../lib/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const credential = req.cookies.get("room_" + id)?.value || "";
    const result = await readSnapshot(
      id,
      credential,
      req.headers.get("x-projector-token") || undefined,
    );
    return NextResponse.json(result, {
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
    await rateLimit(
      "actor:" +
        id +
        ":" +
        createHash("sha256")
          .update(req.cookies.get("room_" + id)?.value || "anonymous")
          .digest("hex"),
      120,
    );
    const raw = await req.text();
    if (raw.length > 30000) throw Error("בקשה גדולה מדי");
    const b = JSON.parse(raw);
    if (
      typeof b.commandId !== "string" ||
      b.commandId.length > 100 ||
      !Number.isInteger(b.revision)
    )
      throw Error("פקודה לא תקינה");
    await command(
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
