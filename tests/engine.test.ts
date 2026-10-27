import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  createGame,
  elapsed,
  selectOutcome,
  type Game,
  type Action,
  type Actor,
} from "../lib/engine";
import { scenes } from "../lib/content";
const host: Actor = { kind: "host" },
  team: Actor = { kind: "team", role: "FIN" };
const act = (
  g: Game,
  a: Action,
  actor = host,
  id = crypto.randomUUID(),
  now = 1000,
) => applyCommand(g, a, actor, id, g.revision, now);
test("the schedule totals exactly 60 minutes and phases remain ordered", () => {
  assert.equal(
    scenes.reduce((n, s) => n + s.minutes, 0),
    60,
  );
  let g = createGame("a", "test", 0);
  for (const scene of scenes.slice(1)) {
    g = act(g, { type: "advance" });
    assert.equal(g.phase, scene.id);
  }
  assert.equal(g.running, false);
  assert.ok(g.outcome);
});
test("pause/resume preserves elapsed active time and phase", () => {
  let g = act(createGame("a", "t", 0), { type: "start" }, host, "start", 1000);
  assert.equal(elapsed(g, 6000), 5000);
  g = act(g, { type: "pause" }, host, "pause", 6000);
  assert.equal(elapsed(g, 12000), 5000);
  g = act(g, { type: "resume" }, host, "resume", 15000);
  assert.equal(elapsed(g, 17000), 7000);
  assert.equal(g.phase, "OPENING");
});
test("idempotency precedes stale revision detection, stale new commands fail", () => {
  const g = createGame("a", "t");
  const next = applyCommand(g, { type: "start" }, host, "one", 0);
  assert.equal(applyCommand(next, { type: "start" }, host, "one", 0), next);
  assert.throws(
    () => applyCommand(next, { type: "pause" }, host, "two", 0),
    /המצב השתנה/,
  );
});
test("teams and projector cannot control host actions", () => {
  for (const type of [
    "start",
    "pause",
    "resume",
    "advance",
    "budget",
    "counter",
    "oral",
  ])
    assert.throws(() => act(createGame("a", "t"), { type }, team));
  assert.throws(() =>
    act(
      createGame("a", "t"),
      { type: "share", text: "t" },
      { kind: "projector" },
    ),
  );
});
test("all alternatives and combination are recorded, action/price/condition required", () => {
  let g = createGame("a", "t");
  g.phase = "CRISIS1";
  for (const option of ["A", "B", "C", "MIX"])
    g = act(
      g,
      {
        type: "proposal",
        option,
        action: "שימור",
        price: "זמן",
        condition: "מימון",
        owner: "חינוך",
      },
      team,
    );
  assert.equal(g.proposals.length, 4);
  assert.throws(() => act(g, { type: "proposal", option: "D" }, team));
  assert.throws(() =>
    act(
      g,
      { type: "proposal", option: "A", action: "", price: "", condition: "" },
      team,
    ),
  );
});
test("budget rejects over/under, fractional and negative allocation", () => {
  let g = createGame("a", "t");
  g.phase = "CRISIS2";
  for (const values of [
    [3, 3, 1],
    [2, 2, 1],
    [2.5, 2.5, 1],
    [-1, 6, 1],
  ])
    assert.throws(() => act(g, { type: "budget", values }));
  g = act(g, { type: "budget", values: [2, 3, 1] });
  assert.deepEqual(g.budget, [2, 3, 1]);
});
test("government response has three deterministic outcomes; one final submission", () => {
  const base = createGame("a", "t");
  base.phase = "CRISIS2";
  assert.equal(
    act(base, {
      type: "counter",
      change: "",
      promise: "",
      reason: "",
      wait: "",
    }).counter?.result,
    "תיקון חסר",
  );
  const a = {
    type: "counter",
    change: "מדורג",
    promise: "בקרה",
    reason: "ישימות",
    wait: "אופקים",
  };
  const g = act(base, { ...a, pending: true });
  assert.equal(g.counter?.result, "מותנה במימון וסמכות");
  assert.equal(act(base, a).counter?.result, "מאושרת עקרונית");
  assert.throws(() => act(g, a));
});
const clause = {
  action: "פיילוט בשני בתי הספר",
  owner: "חינוך",
  requiredPartners: "אוצר ורשויות",
  resources: "תקציב משחק",
  nextStep: "בדיקת גיוס",
  deadline: "ספטמבר",
  schoolEffects: "אופקים ושבילים",
  status: "APPROVED_EXECUTABLE",
  authority: true,
  funding: true,
  readiness: true,
  ofakim: true,
  shvilim: true,
  evidence: "אישור ומוכנות בדיוניים לצורך התרחיש",
};
test("execution status requires readiness and revisions preserve original", () => {
  let g = createGame("a", "t");
  g.phase = "AGREEMENT";
  assert.throws(() =>
    act(g, { type: "clause", id: "0", clause: { ...clause, funding: false } }),
  );
  g = act(g, { type: "clause", id: "0", clause });
  assert.equal(g.clauses[0].version, 2);
  assert.equal(g.history.length, 1);
  g = act(g, { type: "consent", id: "0", position: "support" }, team);
  g = act(g, {
    type: "clause",
    id: "0",
    clause: { ...clause, action: "גרסה חדשה" },
  });
  assert.equal(g.history[1].action, clause.action);
  assert.equal(
    g.consents.filter((c) => c.version === g.clauses[0].version).length,
    0,
  );
});
test("outcome priority and fictional branches are deterministic", () => {
  const g = createGame("a", "t");
  assert.equal(selectOutcome(g).id, "PROMISE_GAP");
  for (const c of g.clauses) c.status = "APPROVED_EXECUTABLE";
  for (const c of g.clauses) c.ofakim = true;
  assert.equal(selectOutcome(g).id, "UNEQUAL_SUCCESS");
  for (const c of g.clauses) c.shvilim = true;
  assert.equal(selectOutcome(g).id, "SLOW_STABLE");
});
test("one final amendment preserves version, resets readiness and is atomic", () => {
  let g = createGame("a", "t");
  g.phase = "FUTURE";
  g = act(g, {
    type: "final",
    id: "0",
    after: "התחייבות מתוקנת",
    reason: "למדנו על סמכות",
  });
  assert.equal(g.finalRevision?.after, "התחייבות מתוקנת");
  assert.equal(g.history.length, 1);
  assert.equal(g.clauses[0].status, "AGREED_PENDING");
  assert.throws(() =>
    act(g, { type: "final", id: "1", after: "עוד", reason: "עוד" }),
  );
});
test("advisor targets exactly one clause and stays on it", () => {
  let g = createGame("a", "t");
  g.phase = "AGREEMENT";
  g = act(g, { type: "advisor" });
  const id = g.advisorId;
  g = act(g, { type: "advisor" });
  assert.equal(g.advisorId, id);
});
test("reflection and investigation require current phase and complete shape", () => {
  let g = createGame("a", "t");
  assert.throws(() =>
    act(g, { type: "reflection", answers: ["a", "b", "c"] }, team),
  );
  g.phase = "CRISIS3";
  assert.throws(() => act(g, { type: "authority", rows: [] }, team));
  g = act(
    g,
    {
      type: "authority",
      rows: Array.from({ length: 4 }, () => Array(4).fill("נדרש בירור")),
    },
    team,
  );
  assert.equal(g.authorityMaps.length, 1);
  g.phase = "TRANSFER";
  g = act(g, { type: "reflection", answers: ["מעסיק", "תקן", "המנהלת"] }, team);
  assert.equal(g.reflections.length, 1);
});

test("projector alternatives require an explicit host reveal", () => {
  let g = createGame("a", "t");
  g.phase = "CRISIS1";
  assert.throws(() => act(g, { type: "revealOptions" }, team));
  g = act(g, { type: "revealOptions" });
  assert.deepEqual(g.revealedOptions, ["CRISIS1"]);
});
test("phase cue anchor tracks active time rather than paused wall time", () => {
  let g = act(createGame("a", "t", 0), { type: "start" }, host, "s", 1000);
  g = act(g, { type: "pause" }, host, "p", 61000);
  g = act(g, { type: "resume" }, host, "r", 100000);
  g = act(g, { type: "advance" }, host, "a", 130000);
  assert.equal(g.phaseStartedMs, 90000);
  assert.equal(g.phase, "CRISIS1");
});
