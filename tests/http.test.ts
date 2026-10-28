import { test } from "node:test";
import assert from "node:assert/strict";
import { error } from "../lib/http";
import { responseJson } from "../lib/client-response";
import { ServiceError } from "../lib/errors";
test("database errors never send connection strings or provider diagnostics to browsers", async () => {
  const response = error(
    Object.assign(new Error("postgres://user:secret@private-host/database"), {
      code: "ECONNREFUSED",
    }),
  );
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes("secret"));
  assert.ok(!JSON.stringify(body).includes("private-host"));
});
test("missing database configuration is recoverable and removed rooms are 404", async () => {
  assert.equal(
    error(new ServiceError("המשחק החי עדיין אינו מוגדר", "DATABASE_REQUIRED"))
      .status,
    503,
  );
  assert.equal(
    error(new Error("המפגש לא נמצא או הסתיים תוקף השמירה")).status,
    404,
  );
  assert.equal(error(new Error("אין הרשאה למפגש")).status, 403);
});
test("hosting gateway HTML becomes an understandable connection message", async () => {
  await assert.rejects(
    responseJson(new Response("<html>Gateway timeout</html>", { status: 504 })),
    /החיבור למשחק אינו זמין/,
  );
});
