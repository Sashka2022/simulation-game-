import { NextResponse } from "next/server";
import { checkDatabase } from "../../../lib/store";
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await checkDatabase();
    return NextResponse.json(
      { liveAvailable: true, demoAvailable: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { liveAvailable: false, demoAvailable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
