import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { createHash } from "node:crypto";
import { createGame } from "../lib/engine";
import { joinRoom, readSnapshot, closeDatabase } from "../lib/postgres-store";
test("legacy one-device schema upgrades without losing live phase, commitments or the existing member", async () => {
  if (!process.env.DATABASE_URL)
    throw Error("Set DATABASE_URL to an EMPTY disposable test database");
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  try {
    const [existing] = await sql`SELECT to_regclass('hd_rooms') AS existing`;
    assert.equal(
      existing.existing,
      null,
      "Refusing to seed an existing application database",
    );
    await sql`CREATE TABLE hd_rooms(id text PRIMARY KEY,code text NOT NULL UNIQUE,state jsonb NOT NULL,host text NOT NULL,projector text NOT NULL,recovery text NOT NULL,created bigint NOT NULL)`;
    await sql`CREATE TABLE hd_members(token text PRIMARY KEY,room text NOT NULL REFERENCES hd_rooms(id) ON DELETE CASCADE,role text NOT NULL,approved boolean NOT NULL DEFAULT false,lastseen bigint NOT NULL,draft jsonb,draft_version bigint NOT NULL DEFAULT 0)`;
    await sql`CREATE UNIQUE INDEX hd_one_approved_team ON hd_members(room,role) WHERE approved`;
    const g = createGame("legacy-room", "מפגש קיים");
    g.phase = "CRISIS2";
    g.revision = 9;
    g.clauses[0].action = "התחייבות שנשמרה לפני השדרוג";
    await sql`INSERT INTO hd_rooms VALUES('legacy-room','OLD123',${sql.json(g as unknown as postgres.JSONValue)},${hash("host")},${hash("projector")},${hash("recover")},${Date.now()})`;
    await sql`INSERT INTO hd_members(token,room,role,approved,lastseen) VALUES(${hash("old-member")},'legacy-room','MOE',true,${Date.now()})`;
    const additions = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        joinRoom("OLD123", "MOE", "מצטרפת " + i),
      ),
    );
    const old = await readSnapshot("legacy-room", "old-member");
    assert.equal(old.actor.role, "MOE");
    assert.equal(old.phase, "CRISIS2");
    assert.equal(old.revision, 9);
    assert.equal(old.clauses[0].action, g.clauses[0].action);
    assert.equal(
      (await readSnapshot("legacy-room", "host")).membership?.members.length,
      21,
    );
    const next = await readSnapshot("legacy-room", additions[0].key);
    assert.equal(next.phase, "CRISIS2");
    const [index] =
      await sql`SELECT to_regclass('hd_one_approved_team') AS existing`;
    assert.equal(index.existing, null);
  } finally {
    await closeDatabase();
    await sql.end();
  }
});
