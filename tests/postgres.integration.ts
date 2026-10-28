import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import {
  newRoom,
  joinRoom,
  readSnapshot,
  command,
  recover,
  rateLimit,
  cleanup,
  closeDatabase,
} from "../lib/postgres-store";
import { randomUUID } from "node:crypto";
const rooms: string[] = [];
async function room() {
  const r = await newRoom("בדיקת סנכרון");
  rooms.push(r.id);
  return r;
}
after(async () => {
  await closeDatabase();
});
function worker(
  data: Record<string, unknown>,
): Promise<{ ok: boolean; revision?: number; phase?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const child = fork(new URL("./postgres-worker.ts", import.meta.url), [], {
      execArgv: ["--conditions=react-server", "--import", "tsx"],
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("worker timeout"));
    }, 15000);
    child.once("message", (m) => {
      clearTimeout(timer);
      resolve(m as { ok: boolean });
    });
    child.once("error", reject);
    child.send(data);
  });
}
test("PostgreSQL isolates teams, rooms and projector, including a host cookie", async () => {
  const r = await room(),
    other = await room();
  const moe = await joinRoom(r.code, "MOE"),
    fin = await joinRoom(r.code, "FIN");
  await assert.rejects(readSnapshot(r.id, moe.key), /PENDING/);
  const host = await readSnapshot(r.id, r.host);
  assert.ok("requests" in host);
  for (const request of host.requests || [])
    await command(
      r.id,
      r.host,
      { type: "approve", memberId: request.id },
      randomUUID(),
      0,
    );
  const f = await readSnapshot(r.id, fin.key),
    m = await readSnapshot(r.id, moe.key);
  assert.ok("privateCard" in f && f.privateCard);
  assert.ok(
    !JSON.stringify(m).includes(
      String("privateCard" in f ? f.privateCard : ""),
    ),
  );
  const p = await readSnapshot(r.id, r.host, r.projector);
  assert.equal(p.actor.kind, "projector");
  assert.ok(!("privateCards" in p));
  await assert.rejects(readSnapshot(other.id, moe.key), /הרשאה/);
  await assert.rejects(
    command(r.id, moe.key, { type: "start" }, randomUUID(), 0),
    /בלבד/,
  );
  await command(r.id, r.host, { type: "revoke", role: "MOE" }, randomUUID(), 0);
  await assert.rejects(readSnapshot(r.id, moe.key), /הרשאה/);
});
test("independent server processes deliver a retried command exactly once", async () => {
  const r = await room();
  const data = {
    id: r.id,
    credential: r.host,
    commandId: randomUUID(),
    revision: 0,
    action: { type: "start" },
  };
  const results = await Promise.all([worker(data), worker(data)]);
  assert.ok(results.every((x) => x.ok));
  const s = await readSnapshot(r.id, r.host);
  assert.equal(s.revision, 1);
  assert.equal(s.logs.filter((x) => x.type === "start").length, 1);
  const afterRestart = await worker({
    id: r.id,
    credential: r.host,
    commandId: "",
    revision: 1,
  });
  assert.equal(afterRestart.phase, "OPENING");
  assert.equal(afterRestart.revision, 1);
});
test("independent concurrent writes cannot overwrite a newer revision", async () => {
  const r = await room();
  await command(r.id, r.host, { type: "start" }, randomUUID(), 0);
  const results = await Promise.all([
    worker({
      id: r.id,
      credential: r.host,
      commandId: randomUUID(),
      revision: 1,
      action: { type: "advance" },
    }),
    worker({
      id: r.id,
      credential: r.host,
      commandId: randomUUID(),
      revision: 1,
      action: { type: "pause" },
    }),
  ]);
  assert.equal(results.filter((x) => x.ok).length, 1);
  assert.ok(results.some((x) => x.error?.includes("המצב השתנה")));
  assert.equal((await readSnapshot(r.id, r.host)).revision, 2);
});
test("two independent final amendments preserve exactly one amendment", async () => {
  const r = await room();
  let s = await readSnapshot(r.id, r.host);
  while (s.phase !== "FUTURE") {
    await command(r.id, r.host, { type: "advance" }, randomUUID(), s.revision);
    s = await readSnapshot(r.id, r.host);
  }
  const data = {
    id: r.id,
    credential: r.host,
    revision: s.revision,
    action: {
      type: "final",
      id: "0",
      after: "תוכנית שימור מדורגת",
      reason: "למדנו על תלויות",
    },
  };
  const results = await Promise.all([
    worker({ ...data, commandId: randomUUID() }),
    worker({ ...data, commandId: randomUUID() }),
  ]);
  assert.equal(results.filter((x) => x.ok).length, 1);
  s = await readSnapshot(r.id, r.host);
  assert.equal(s.history.length, 1);
  assert.ok(s.finalRevision);
});
test("draft ordering and host recovery survive process boundaries", async () => {
  const r = await room(),
    team = await joinRoom(r.code, "LOCAL");
  const s = await readSnapshot(r.id, r.host);
  await command(
    r.id,
    r.host,
    {
      type: "approve",
      memberId: "requests" in s ? s.requests?.[0].id : undefined,
    },
    randomUUID(),
    0,
  );
  await command(
    r.id,
    team.key,
    { type: "draft", draft: { action: "new" }, draftVersion: 200 },
    randomUUID(),
    0,
  );
  await command(
    r.id,
    team.key,
    { type: "draft", draft: { action: "old" }, draftVersion: 100 },
    randomUUID(),
    0,
  );
  const t = await readSnapshot(r.id, team.key);
  assert.equal("draft" in t && t.draft?.action, "new");
  const restored = await recover(r.code, r.recovery);
  await assert.rejects(readSnapshot(r.id, r.host), /הרשאה/);
  await assert.rejects(readSnapshot(r.id, "", r.projector), /הרשאה/);
  assert.equal((await readSnapshot(r.id, restored.host)).actor.kind, "host");
  assert.equal(
    (await readSnapshot(r.id, "", restored.projector)).actor.kind,
    "projector",
  );
  await command(r.id, restored.host, { type: "delete" }, randomUUID(), 0);
  await assert.rejects(readSnapshot(r.id, team.key), /לא נמצא/);
});
test("the shared rate limiter counts concurrent calls atomically", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      rateLimit("integration-" + process.pid, 3),
    ),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  await cleanup();
});
