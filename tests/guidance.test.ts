import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../lib/engine";
import { teamSubmission, diffWords, missingConditions } from "../lib/guidance";
test("connection or a previous-phase proposal does not count as a current submission", () => {
  const g = createGame("test", "test");
  g.phase = "CRISIS2";
  g.proposals.push({
    id: "old",
    team: "MOE",
    phase: "CRISIS1",
    option: "A",
    action: "שימור",
    price: "זמן",
    condition: "אישור",
    owner: "חינוך",
    createdAt: 0,
  });
  assert.equal(teamSubmission(g, "MOE").submitted, false);
  g.proposals[0].phase = "CRISIS2";
  assert.equal(teamSubmission(g, "MOE").submitted, true);
});
test("crisis four needs both an actual proposal and the teaching-practice response", () => {
  const g = createGame("test", "test");
  g.phase = "CRISIS4";
  g.proposals.push({
    id: "p",
    team: "MOE",
    phase: "CRISIS4",
    option: "A",
    action: "שימור",
    price: "זמן",
    condition: "אישור",
    owner: "חינוך",
    createdAt: 0,
  });
  assert.equal(teamSubmission(g, "MOE").submitted, false);
  g.practice.push({ team: "MOE", text: "הוראה בקבוצות ומעקב" });
  assert.equal(teamSubmission(g, "MOE").submitted, true);
});
test("agreement readiness is tied to the exact current versions", () => {
  const g = createGame("test", "test");
  g.phase = "AGREEMENT";
  g.consents = g.clauses.map((c) => ({
    team: "MOE",
    clauseId: c.id,
    version: c.version,
    position: "conditional",
    condition: "מימון",
  }));
  assert.equal(teamSubmission(g, "MOE").submitted, true);
  g.clauses[0].version++;
  assert.equal(teamSubmission(g, "MOE").submitted, false);
});
test("word differences preserve Hebrew, repeated words and both original texts", () => {
  for (const [before, after] of [
    ["נפתח שלוש כיתות", "נפתח שתי כיתות"],
    ["גם וגם וגם", "גם וגם"],
    ["", "פעולה חדשה"],
    ["ללא שינוי", "ללא שינוי"],
  ]) {
    const d = diffWords(before, after);
    assert.equal(d.before.map((w) => w.text).join(" "), before);
    assert.equal(d.after.map((w) => w.text).join(" "), after);
  }
  const d = diffWords("נפתח שלוש כיתות", "נפתח שתי כיתות");
  assert.deepEqual(
    d.before.filter((w) => w.changed).map((w) => w.text),
    ["שלוש"],
  );
  assert.deepEqual(
    d.after.filter((w) => w.changed).map((w) => w.text),
    ["שתי"],
  );
});
test("missing conditions never imply that an unresolved promise is executable", () => {
  const g = createGame("test", "test");
  const c = g.clauses[0];
  assert.match(missingConditions(c), /ניסוח/);
  c.action = "פעולה";
  c.authority = true;
  c.funding = true;
  c.readiness = true;
  c.evidence = "תיעוד במשחק";
  assert.match(missingConditions(c), /הסכמה/);
  c.status = "APPROVED_EXECUTABLE";
  assert.equal(missingConditions(c), "תנאי הביצוע תועדו בסימולציה");
});
