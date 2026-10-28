import { ServiceError } from "./errors";
import { NextRequest, NextResponse } from "next/server";
export function error(e: unknown) {
  const databaseFailure =
    e instanceof ServiceError ||
    (e &&
      typeof e === "object" &&
      ("severity" in e ||
        ("code" in e &&
          /^(?:[0-9A-Z]{5}|ECONN|ETIMEDOUT|CONNECTION|ENOTFOUND|EAI_)/.test(
            String(e.code),
          ))));
  const message =
    e instanceof ServiceError
      ? e.message
      : databaseFailure
        ? "החיבור למשחק אינו זמין כרגע. הטיוטה נשמרה; נסו שוב בעוד רגע."
        : e instanceof Error
          ? e.message
          : "אירעה שגיאה";
  return NextResponse.json(
    { error: message },
    {
      status: databaseFailure
        ? 503
        : message === "PENDING"
          ? 202
          : message.includes("המפגש לא נמצא")
            ? 404
            : message.includes("הרשאה") || message.includes("בלבד")
              ? 403
              : 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function originCheck(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    const expected = process.env.APP_ORIGIN;
    if (
      expected
        ? origin !== expected
        : new URL(origin).host !== req.headers.get("host")
    )
      throw Error("בקשה ממקור לא מורשה");
  }
}
export function setCredential(res: NextResponse, id: string, key: string) {
  res.cookies.set("room_" + id, key, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.COOKIE_SECURE !== "false",
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}
