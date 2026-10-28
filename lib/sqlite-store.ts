import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import {
  createGame,
  applyCommand,
  type Game,
  type Actor,
  type Action,
} from "./engine";
import { roles, type Role } from "./content";
import {
  memberName,
  settings,
  initialize,
  manage,
  managementTypes,
  authorizeTeam,
  view,
  type Member as NormalMember,
} from "./membership";
const dir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "sessions.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, code TEXT UNIQUE, state TEXT NOT NULL, host TEXT NOT NULL, projector TEXT NOT NULL, recovery TEXT NOT NULL, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS members (token TEXT PRIMARY KEY, room TEXT NOT NULL, role TEXT NOT NULL, approved INTEGER DEFAULT 0, lastseen INTEGER NOT NULL, draft TEXT DEFAULT NULL); CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);",
);
const columns = db.prepare("PRAGMA table_info(members)").all() as {
  name: string;
}[];
if (!columns.some((c) => c.name === "name"))
  db.exec("ALTER TABLE members ADD COLUMN name TEXT NOT NULL DEFAULT 'משתתפת'");
if (!columns.some((c) => c.name === "manual"))
  db.exec("ALTER TABLE members ADD COLUMN manual INTEGER NOT NULL DEFAULT 0");
if (!columns.some((c) => c.name === "draft_version"))
  db.exec(
    "ALTER TABLE members ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 0",
  );
db.exec(
  "CREATE TABLE IF NOT EXISTS receipts(room TEXT NOT NULL, command_id TEXT NOT NULL, actor TEXT NOT NULL, PRIMARY KEY(room,command_id))",
);
if (!columns.some((c) => c.name === "focus"))
  db.exec("ALTER TABLE members ADD COLUMN focus TEXT NOT NULL DEFAULT 'BOTH'");
const token = () => randomBytes(24).toString("hex");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Room = {
  id: string;
  code: string;
  state: string;
  host: string;
  projector: string;
  recovery: string;
  created: number;
};
type Member = {
  name: string;
  manual: number;
  focus: "BOTH" | "NEGOTIATION" | "POLICY";
  token: string;
  room: string;
  role: Role;
  approved: number;
  lastseen: number;
  draft: string | null;
};
export function cleanup() {
  const cutoff = Date.now() - 30 * 86400000;
  db.prepare(
    "DELETE FROM members WHERE room IN (SELECT id FROM rooms WHERE created < ?)",
  ).run(cutoff);
  db.prepare(
    "DELETE FROM receipts WHERE room IN (SELECT id FROM rooms WHERE created < ?)",
  ).run(cutoff);
  db.prepare("DELETE FROM rooms WHERE created < ?").run(cutoff);
  db.prepare("DELETE FROM limits WHERE until < ?").run(Date.now());
}
export function rateLimit(key: string, max = 60) {
  const now = Date.now();
  const r = db
    .prepare("SELECT count,until FROM limits WHERE key=?")
    .get(key) as { count: number; until: number } | undefined;
  if (!r || r.until < now) {
    db.prepare("INSERT OR REPLACE INTO limits VALUES (?,1,?)").run(
      key,
      now + 60000,
    );
    return;
  }
  if (r.count >= max) throw Error("בקשות רבות מדי. המתינו דקה ונסו שוב.");
  db.prepare("UPDATE limits SET count=count+1 WHERE key=?").run(key);
}
export function newRoom(name: string) {
  cleanup();
  const id = token().slice(0, 12),
    host = token(),
    projector = token(),
    recovery = token();
  let code = "";
  do {
    code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  } while (db.prepare("SELECT id FROM rooms WHERE code=?").get(code));
  const g = createGame(id, name.slice(0, 80) || "מפגש חדר המצב");
  db.prepare("INSERT INTO rooms VALUES (?,?,?,?,?,?,?)").run(
    id,
    code,
    JSON.stringify(g),
    hash(host),
    hash(projector),
    hash(recovery),
    Date.now(),
  );
  return { id, code, host, projector, recovery };
}
export function getRoom(id: string) {
  const r = db.prepare("SELECT * FROM rooms WHERE id=?").get(id) as
    Room | undefined;
  if (!r || r.created < Date.now() - 30 * 86400000)
    throw Error("המפגש לא נמצא או הסתיים תוקף השמירה");
  return r;
}
export function identify(
  r: Room,
  credential: string,
  projector?: string,
): Actor {
  if (projector) {
    if (hash(projector) !== r.projector) throw Error("אין הרשאה למסך ההקרנה");
    return { kind: "projector" };
  }
  if (hash(credential) === r.host) return { kind: "host" };
  const m = db
    .prepare("SELECT * FROM members WHERE token=? AND room=?")
    .get(hash(credential), r.id) as Member | undefined;
  if (!m) throw Error("אין הרשאה למפגש");
  db.prepare("UPDATE members SET lastseen=? WHERE token=?").run(
    Date.now(),
    m.token,
  );
  if (!m.approved) throw Error("PENDING");
  return { kind: "team", role: m.role };
}
export function joinRoom(
  code: string,
  role: Role,
  name = "משתתפת",
  credential = "",
) {
  name = memberName(name);
  cleanup();
  const r = db
    .prepare("SELECT * FROM rooms WHERE code=?")
    .get(code.toUpperCase()) as Room | undefined;
  if (!r) throw Error("קוד המפגש אינו תקין");
  if (!roles.some((t) => t.id === role)) throw Error("בחרו משלחת");
  const g = JSON.parse(r.state) as Game;
  if (g.phase === "COMPLETE") throw Error("המפגש הסתיים");
  if (hash(credential) === r.host) return { id: r.id, key: credential };
  const existing = db
    .prepare("SELECT token FROM members WHERE room=? AND token=?")
    .get(r.id, hash(credential));
  if (existing) return { id: r.id, key: credential };
  if (!settings(g).joinOpen) throw Error("ההצטרפות למפגש נעולה");
  const key = token();
  db.prepare(
    "INSERT INTO members(token,room,role,name,approved,lastseen) VALUES(?,?,?,?,?,?)",
  ).run(
    hash(key),
    r.id,
    role,
    name,
    settings(g).approvalRequired ? 0 : 1,
    Date.now(),
  );
  initialize(g, allMembers(r.id));
  db.prepare("UPDATE rooms SET state=? WHERE id=?").run(
    JSON.stringify(g),
    r.id,
  );
  return { id: r.id, key };
}
export function snapshot(r: Room, actor: Actor, credential: string) {
  return view(
    JSON.parse(r.state),
    allMembers(r.id),
    actor,
    hash(credential),
    r.code,
  );
}
function allMembers(id: string): NormalMember[] {
  return (
    db
      .prepare("SELECT * FROM members WHERE room=?")
      .all(id) as unknown as Member[]
  ).map((m) => ({
    ...m,
    approved: !!m.approved,
    manual: !!m.manual,
    draft: m.draft ? JSON.parse(m.draft) : null,
  }));
}

export function command(
  id: string,
  credential: string,
  a: Action,
  commandId: string,
  revision: number,
) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = getRoom(id),
      actor = identify(r, credential);
    const receipt = db
      .prepare("SELECT actor FROM receipts WHERE room=? AND command_id=?")
      .get(id, commandId) as { actor: string } | undefined;
    if (receipt) {
      if (receipt.actor !== hash(credential)) throw Error("אין הרשאה לפקודה");
      db.exec("COMMIT");
      return;
    }
    const state = JSON.parse(r.state) as Game;
    const members = allMembers(id);
    initialize(state, members);
    authorizeTeam(state, actor, hash(credential), a);
    if (a.type === "rotate") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      throw Error("קישור ההצטרפות קבוע למפגש. אפשר לנעול הצטרפות בהגדרות");
    } else if (managementTypes.includes(a.type)) {
      manage(state, members, a, actor, hash(credential), hash(token()));
      const previous = allMembers(id);
      for (const old of previous)
        if (!members.some((m) => m.token === old.token))
          db.prepare("DELETE FROM members WHERE token=?").run(old.token);
      for (const m of members)
        db.prepare(
          "INSERT INTO members(token,room,role,name,approved,lastseen,draft,manual,focus) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET role=excluded.role,name=excluded.name,approved=excluded.approved,draft=excluded.draft,focus=excluded.focus",
        ).run(
          m.token,
          id,
          m.role,
          m.name,
          m.approved ? 1 : 0,
          m.lastseen,
          m.draft ? JSON.stringify(m.draft) : null,
          m.manual ? 1 : 0,
          m.focus || "BOTH",
        );
      db.prepare("UPDATE rooms SET state=? WHERE id=?").run(
        JSON.stringify(state),
        id,
      );
    } else if (a.type === "draft") {
      if (actor.kind !== "team") throw Error("למשלחת בלבד");
      const draft = JSON.stringify(a.draft);
      if (draft.length > 20000) throw Error("הטיוטה גדולה מדי");
      db.prepare(
        "UPDATE members SET draft=?,draft_version=? WHERE token=? AND draft_version<=?",
      ).run(
        draft,
        Number(a.draftVersion) || Date.now(),
        hash(credential),
        Number(a.draftVersion) || Date.now(),
      );
    } else if (a.type === "delete") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      db.prepare("DELETE FROM receipts WHERE room=?").run(id);
      db.prepare("DELETE FROM members WHERE room=?").run(id);
      db.prepare("DELETE FROM rooms WHERE id=?").run(id);
    } else {
      const g = applyCommand(state, a, actor, commandId, revision);
      db.prepare("UPDATE rooms SET state=? WHERE id=?").run(
        JSON.stringify(g),
        id,
      );
    }
    if (a.type !== "delete")
      db.prepare("INSERT INTO receipts VALUES(?,?,?)").run(
        id,
        commandId,
        hash(credential),
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function recover(code: string, key: string) {
  const r = db
    .prepare("SELECT * FROM rooms WHERE code=? AND recovery=?")
    .get(code.toUpperCase(), hash(key)) as Room | undefined;
  if (!r) throw Error("פרטי שחזור לא תקינים");
  const host = token(),
    recovery = token(),
    projector = token();
  db.prepare("UPDATE rooms SET host=?,recovery=?,projector=? WHERE id=?").run(
    hash(host),
    hash(recovery),
    hash(projector),
    r.id,
  );
  return { id: r.id, host, recovery, projector };
}

export function readSnapshot(
  id: string,
  credential: string,
  projector?: string,
) {
  const r = getRoom(id);
  return snapshot(r, identify(r, credential, projector), credential);
}
export function checkDatabase() {
  db.prepare("SELECT 1").get();
  return { storage: "sqlite" as const };
}

export function inspectRoom(code: string) {
  const r = db
    .prepare("SELECT * FROM rooms WHERE code=?")
    .get(code.toUpperCase()) as Room | undefined;
  if (!r) throw Error("המפגש לא נמצא");
  getRoom(r.id);
  const g = JSON.parse(r.state) as Game;
  const members = allMembers(r.id);
  return {
    id: r.id,
    name: g.name,
    settings: settings(g),
    teams: roles.map((t) => ({
      role: t.id,
      count: members.filter((m) => m.role === t.id && m.approved).length,
    })),
  };
}
