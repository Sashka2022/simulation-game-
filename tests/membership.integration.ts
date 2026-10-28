import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { Action } from "../lib/engine";
import type { Role } from "../lib/content";
import { secrets } from "../lib/private";
const adapterPromise =
  process.env.TEST_ADAPTER === "postgres"
    ? import("../lib/postgres-store")
    : import("../lib/sqlite-store");
const db = {
  newRoom: async (name: string) => (await adapterPromise).newRoom(name),
  joinRoom: async (
    code: string,
    role: Role,
    name: string,
    credential?: string,
  ) => (await adapterPromise).joinRoom(code, role, name, credential),
  readSnapshot: async (id: string, key: string, projector?: string) =>
    (await adapterPromise).readSnapshot(id, key, projector),
  command: async (
    id: string,
    key: string,
    a: Action,
    commandId: string,
    revision: number,
  ) => (await adapterPromise).command(id, key, a, commandId, revision),
  inspectRoom: async (code: string) => (await adapterPromise).inspectRoom(code),
};
function draft(s: Awaited<ReturnType<typeof db.readSnapshot>>) {
  return "draft" in s ? s.draft : null;
}
const rooms: { id: string; host: string }[] = [];
async function create() {
  const r = await db.newRoom("משלחות פתוחות");
  rooms.push(r);
  return r;
}
async function send(
  id: string,
  key: string,
  action: Action,
  commandId = randomUUID(),
) {
  const s = await db.readSnapshot(id, key);
  return db.command(
    id,
    key,
    { roleScope: s.actor.role, ...action },
    commandId,
    s.revision,
  );
}
after(async () => {
  for (const r of rooms)
    try {
      await send(r.id, r.host, { type: "delete" });
    } catch {}
  const adapter = await adapterPromise;
  if ("closeDatabase" in adapter) await adapter.closeDatabase();
});
for (const size of [5, 10, 20, 40, 60])
  test(`${size} participants: uneven groups, ideas, snapshots, concurrent official submissions`, async () => {
    const r = await create();
    const roles: Role[] = ["MOE", "FIN", "UNION", "LOCAL", "PRINCIPALS"];
    const start = performance.now();
    const members = await Promise.all(
      Array.from({ length: size }, (_, i) =>
        db.joinRoom(r.code, roles[i < 5 ? i : 0], `מורה ${i + 1}`),
      ),
    );
    const snapshots = await Promise.all(
      members.map((m) => db.readSnapshot(r.id, m.key)),
    );
    const host = await db.readSnapshot(r.id, r.host);
    assert.equal(host.membership?.members.length, size);
    assert.equal(host.teams.find((t) => t.role === "MOE")?.count, size - 4);
    assert.ok(snapshots.every((s) => s.actor.kind === "team"));
    assert.ok(
      snapshots.every((s) =>
        s.membership?.members.every((m) => m.role === s.actor.role),
      ),
    );
    await send(r.id, r.host, { type: "start" });
    await send(r.id, r.host, { type: "advance" });
    const ideas = await Promise.allSettled(
      members.map((m, i) =>
        send(r.id, m.key, { type: "idea", text: `רעיון ${i}` }),
      ),
    );
    assert.equal(ideas.filter((x) => x.status === "fulfilled").length, size);
    const group = members.filter((_, i) => i === 0 || i >= 5);
    const proposal = {
      type: "proposal",
      option: "A",
      action: "תוכנית שימור",
      price: "זמן",
      condition: "מימון",
      owner: "חינוך",
    };
    const attempts = await Promise.allSettled(
      group.flatMap((m) => [
        send(r.id, m.key, proposal),
        send(r.id, m.key, proposal),
      ]),
    );
    assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
    let s = await db.readSnapshot(r.id, r.host);
    assert.equal(
      s.proposals.filter((p) => p.team === "MOE" && p.phase === "CRISIS1")
        .length,
      1,
    );
    await assert.rejects(send(r.id, members[0].key, proposal), /כבר הוגשה/);
    for (const m of members.slice(1, 5)) await send(r.id, m.key, proposal);
    s = await db.readSnapshot(r.id, r.host);
    assert.equal(s.proposals.length, 5);
    const pollTimes: number[] = [];
    // 60 independent authenticated clients, repeated reads of real shared state.
    for (let round = 0; round < 3; round++)
      await Promise.all(
        members.map(async (m) => {
          const t = performance.now();
          const value = await db.readSnapshot(r.id, m.key);
          pollTimes.push(performance.now() - t);
          assert.equal(value.proposals.length, 5);
        }),
      );
    pollTimes.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        adapter: process.env.TEST_ADAPTER || "sqlite",
        participants: size,
        joinAndActionsMs: Math.round(performance.now() - start),
        snapshotP50Ms: Math.round(
          pollTimes[Math.floor(pollTimes.length * 0.5)],
        ),
        snapshotP95Ms: Math.round(
          pollTimes[Math.floor(pollTimes.length * 0.95)],
        ),
        errors: 0,
      }),
    );
  });
test("late join, refresh/reconnect idempotence and individual drafts", async () => {
  const r = await create();
  await send(r.id, r.host, { type: "start" });
  await send(r.id, r.host, { type: "advance" });
  const a = await db.joinRoom(r.code, "MOE", "ראשונה");
  const b = await db.joinRoom(r.code, "MOE", "שנייה");
  const before = await db.readSnapshot(r.id, a.key);
  assert.equal(before.phase, "CRISIS1");
  assert.equal(before.clauses.length, 3);
  assert.equal("privateCard" in before && before.privateCard, secrets.MOE);
  const again = await db.joinRoom(r.code, "FIN", "שם אחר", a.key);
  assert.equal(again.key, a.key);
  assert.equal(
    (await db.readSnapshot(r.id, r.host)).membership?.members.length,
    2,
  );
  assert.equal((await db.readSnapshot(r.id, a.key)).actor.role, "MOE");
  await send(r.id, a.key, {
    type: "draft",
    draft: { action: "הטיוטה שלי" },
    draftVersion: 200,
  });
  await send(r.id, a.key, {
    type: "draft",
    draft: { action: "ישנה" },
    draftVersion: 100,
  });
  assert.equal(draft(await db.readSnapshot(r.id, a.key))?.action, "הטיוטה שלי");
  assert.equal(draft(await db.readSnapshot(r.id, b.key)), null);
});
test("moves immediately revoke old secrets, ideas and drafts, and reject stale queued writes", async () => {
  const r = await create();
  const a = await db.joinRoom(r.code, "MOE", "נעה");
  const b = await db.joinRoom(r.code, "FIN", "דנה");
  await send(r.id, a.key, { type: "idea", text: "רעיון חסוי לחינוך" });
  await send(r.id, b.key, { type: "idea", text: "רעיון חסוי לאוצר" });
  await send(r.id, a.key, { type: "draft", draft: { action: "טיוטה לחינוך" } });
  const old = await db.readSnapshot(r.id, a.key);
  await send(r.id, r.host, {
    type: "moveMember",
    memberId: old.actor.memberId,
    role: "FIN",
  });
  const next = await db.readSnapshot(r.id, a.key);
  assert.equal(next.actor.role, "FIN");
  assert.equal("privateCard" in next && next.privateCard, secrets.FIN);
  assert.equal(draft(next), null);
  assert.ok(!JSON.stringify(next).includes(secrets.MOE));
  assert.ok(!JSON.stringify(next).includes("רעיון חסוי לחינוך"));
  assert.ok(JSON.stringify(next).includes("רעיון חסוי לאוצר"));
  await assert.rejects(
    db.command(
      r.id,
      a.key,
      { type: "draft", roleScope: "MOE", draft: { action: "שחזור ישן" } },
      randomUUID(),
      old.revision,
    ),
    /השיוך/,
  );
  await assert.rejects(
    send(r.id, a.key, {
      type: "representative",
      memberId: old.actor.memberId,
      expectedMembershipRevision: 0,
    }),
    /השתנתה/,
  );
  await send(r.id, a.key, { type: "switchTeam", role: "LOCAL" });
  assert.equal((await db.readSnapshot(r.id, a.key)).actor.role, "LOCAL");
});
test("host locks joining and switching; approval is optional and never replaces peers", async () => {
  const r = await create();
  const a = await db.joinRoom(r.code, "MOE", "א");
  await send(r.id, r.host, {
    type: "membershipSettings",
    settings: { joinOpen: false, switchOpen: false },
  });
  await assert.rejects(db.joinRoom(r.code, "FIN", "ב"), /נעולה/);
  await assert.rejects(
    send(r.id, a.key, { type: "switchTeam", role: "FIN" }),
    /נעול/,
  );
  await assert.rejects(
    send(r.id, a.key, {
      type: "membershipSettings",
      settings: { joinOpen: true },
    }),
    /בלבד/,
  );
  await send(r.id, r.host, {
    type: "membershipSettings",
    settings: { joinOpen: true, approvalRequired: true },
  });
  const b = await db.joinRoom(r.code, "MOE", "ב");
  const c = await db.joinRoom(r.code, "MOE", "ג");
  await assert.rejects(db.readSnapshot(r.id, b.key), /PENDING/);
  let host = await db.readSnapshot(r.id, r.host);
  assert.ok("requests" in host);
  for (const request of host.requests || [])
    await send(r.id, r.host, { type: "approve", memberId: request.id });
  host = await db.readSnapshot(r.id, r.host);
  assert.equal(host.membership?.members.filter((m) => m.approved).length, 3);
  assert.equal((await db.readSnapshot(r.id, a.key)).actor.role, "MOE");
  assert.equal((await db.readSnapshot(r.id, b.key)).actor.role, "MOE");
  assert.equal((await db.readSnapshot(r.id, c.key)).actor.role, "MOE");
  assert.equal((await db.inspectRoom(r.code)).teams[0].count, 3);
  assert.equal("code" in host && host.code, r.code);
});
test("representative elections are atomic; host can replace and revoke any member; solo works", async () => {
  const r = await create();
  const a = await db.joinRoom(r.code, "MOE", "א");
  const b = await db.joinRoom(r.code, "MOE", "ב");
  const c = await db.joinRoom(r.code, "MOE", "ג");
  let s = await db.readSnapshot(r.id, r.host);
  const [ma, mb, mc] = await Promise.all(
    [a, b, c].map((m) => db.readSnapshot(r.id, m.key)),
  );
  const initial = s.membership?.revision || 0;
  const election = await Promise.allSettled([
    send(r.id, b.key, {
      type: "representative",
      memberId: mb.actor.memberId,
      expectedMembershipRevision: initial,
    }),
    send(r.id, c.key, {
      type: "representative",
      memberId: mc.actor.memberId,
      expectedMembershipRevision: initial,
    }),
  ]);
  assert.equal(election.filter((x) => x.status === "fulfilled").length, 1);
  await send(r.id, r.host, {
    type: "membershipSettings",
    settings: { representativeChoice: false },
  });
  s = await db.readSnapshot(r.id, r.host);
  await assert.rejects(
    send(r.id, a.key, {
      type: "representative",
      memberId: ma.actor.memberId,
      expectedMembershipRevision: s.membership?.revision,
    }),
    /בלבד/,
  );
  await send(r.id, r.host, {
    type: "representative",
    memberId: mb.actor.memberId,
    expectedMembershipRevision: s.membership?.revision,
  });
  await send(r.id, r.host, {
    type: "removeMember",
    memberId: ma.actor.memberId,
  });
  await assert.rejects(db.readSnapshot(r.id, a.key), /הרשאה/);
  assert.equal((await db.readSnapshot(r.id, b.key)).actor.role, "MOE");
  await send(r.id, r.host, {
    type: "addMember",
    name: "ללא מכשיר",
    role: "LOCAL",
  });
  s = await db.readSnapshot(r.id, r.host);
  assert.ok(
    s.membership?.members.some(
      (m) => m.name === "ללא מכשיר" && m.manual && !m.connected,
    ),
  );
  const solo = await db.joinRoom(r.code, "UNION", "לבד");
  const alone = await db.readSnapshot(r.id, solo.key);
  assert.equal(alone.membership?.representatives.UNION, alone.actor.memberId);
  // Projector cannot receive roster, ideas, private cards or participant names.
  const projection = await db.readSnapshot(r.id, r.host, r.projector);
  assert.equal(projection.actor.kind, "projector");
  assert.ok(!projection.membership);
  assert.ok(!JSON.stringify(projection).includes("ללא מכשיר"));
});
test("the same official command receipt is idempotent and cannot be reused by another participant", async () => {
  const r = await create();
  const a = await db.joinRoom(r.code, "MOE", "א");
  const b = await db.joinRoom(r.code, "MOE", "ב");
  await send(r.id, r.host, { type: "start" });
  await send(r.id, r.host, { type: "advance" });
  const s = await db.readSnapshot(r.id, a.key);
  const commandId = randomUUID();
  const action = {
    type: "proposal",
    roleScope: "MOE",
    option: "A",
    action: "תוכנית",
    price: "זמן",
    condition: "שעות",
    owner: "חינוך",
  };
  await db.command(r.id, a.key, action, commandId, s.revision);
  await db.command(r.id, a.key, action, commandId, s.revision);
  assert.equal((await db.readSnapshot(r.id, r.host)).proposals.length, 1);
  await assert.rejects(
    db.command(r.id, b.key, action, commandId, s.revision),
    /הרשאה/,
  );
});

test("functions can be shared by many members; solo members can perform both without permission barriers", async () => {
  const r = await create();
  const a = await db.joinRoom(r.code, "MOE", "א");
  const b = await db.joinRoom(r.code, "MOE", "ב");
  const solo = await db.joinRoom(r.code, "FIN", "לבד");
  await send(r.id, a.key, { type: "memberFocus", focus: "POLICY" });
  await send(r.id, b.key, { type: "memberFocus", focus: "POLICY" });
  let s = await db.readSnapshot(r.id, a.key);
  assert.equal(
    s.membership?.members.filter((m) => m.focus === "POLICY").length,
    2,
  );
  const bId = (await db.readSnapshot(r.id, b.key)).actor.memberId;
  await send(r.id, r.host, {
    type: "memberFocus",
    memberId: bId,
    focus: "NEGOTIATION",
  });
  s = await db.readSnapshot(r.id, b.key);
  assert.equal(
    s.membership?.members.find((m) => m.id === bId)?.focus,
    "NEGOTIATION",
  );
  const ss = await db.readSnapshot(r.id, solo.key);
  assert.equal(ss.membership?.members[0].focus, "BOTH");
  await send(r.id, solo.key, { type: "memberFocus", focus: "POLICY" });
  await send(r.id, r.host, { type: "start" });
  await send(r.id, r.host, { type: "advance" });
  await send(r.id, solo.key, {
    type: "proposal",
    option: "A",
    action: "גם משא ומתן",
    price: "זמן",
    condition: "תקציב",
    owner: "אוצר",
  });
  assert.equal((await db.readSnapshot(r.id, r.host)).proposals[0].team, "FIN");
  await assert.rejects(
    send(r.id, a.key, { type: "memberFocus", focus: "ADMIN" }),
    /פונקציה/,
  );
  const hostAgain = await db.joinRoom(r.code, "FIN", "מנחה", r.host);
  assert.equal(hostAgain.key, r.host);
  assert.equal((await db.readSnapshot(r.id, r.host)).actor.kind, "host");
});
