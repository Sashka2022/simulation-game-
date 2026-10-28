import { NextRequest, NextResponse } from "next/server";
import { newRoom, joinRoom, recover, rateLimit } from "../../../lib/store";
import { error, originCheck, setCredential } from "../../../lib/http";
import type { Role } from "../../../lib/content";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  try {
    originCheck(req);
    await rateLimit("entry", 100);
    if (Number(req.headers.get("content-length")) > 10000)
      throw Error("בקשה גדולה מדי");
    const b = await req.json();
    if (b.type === "join") {
      const r = await joinRoom(String(b.code || ""), b.role as Role);
      return setCredential(NextResponse.json({ id: r.id }), r.id, r.key);
    }
    if (b.type === "recover") {
      const r = await recover(String(b.code || ""), String(b.key || ""));
      return setCredential(
        NextResponse.json({
          id: r.id,
          recovery: r.recovery,
          projector: r.projector,
        }),
        r.id,
        r.host,
      );
    }
    const r = await newRoom(String(b.name || ""));
    return setCredential(
      NextResponse.json({
        id: r.id,
        projector: r.projector,
        recovery: r.recovery,
      }),
      r.id,
      r.host,
    );
  } catch (e) {
    return error(e);
  }
}
