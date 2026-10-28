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
import { secrets } from "./private";
const dir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "sessions.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, code TEXT UNIQUE, state TEXT NOT NULL, host TEXT NOT NULL, projector TEXT NOT NULL, recovery TEXT NOT NULL, created INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS members (token TEXT PRIMARY KEY, room TEXT NOT NULL, role TEXT NOT NULL, approved INTEGER DEFAULT 0, lastseen INTEGER NOT NULL, draft TEXT DEFAULT NULL); CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);",
);
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
export function joinRoom(code: string, role: Role) {
  cleanup();
  const r = db
    .prepare("SELECT * FROM rooms WHERE code=?")
    .get(code.toUpperCase()) as Room | undefined;
  if (!r) throw Error("קוד המפגש אינו תקין");
  if (!roles.some((t) => t.id === role)) throw Error("בחרו משלחת");
  const g = JSON.parse(r.state) as Game;
  if (g.phase === "COMPLETE") throw Error("המפגש הסתיים");
  if (
    db
      .prepare(
        "SELECT token FROM members WHERE room=? AND role=? AND approved=1",
      )
      .get(r.id, role)
  )
    throw Error("המשלחת תפוסה. בקשו מהמנחה לאשר החלפת מכשיר.");
  const key = token();
  db.prepare(
    "INSERT INTO members (token,room,role,lastseen) VALUES (?,?,?,?)",
  ).run(hash(key), r.id, role, Date.now());
  return { id: r.id, key };
}
export function snapshot(r: Room, actor: Actor, credential: string) {
  const g = JSON.parse(r.state) as Game;
  const members = db
    .prepare("SELECT token,role,approved,lastseen FROM members WHERE room=?")
    .all(r.id) as unknown as Member[];
  const base = {
    ...g,
    processed: [],
    actor,
    serverNow: Date.now(),
    teams: roles.map((t) => ({
      role: t.id,
      connected: members.some(
        (m) => m.role === t.id && m.approved && m.lastseen > Date.now() - 12000,
      ),
      joined: members.some((m) => m.role === t.id && m.approved),
    })),
  };
  if (actor.kind === "host")
    return {
      ...base,
      code: r.code,
      requests: members
        .filter((m) => !m.approved)
        .map((m) => ({ id: m.token, role: m.role })),
      privateCards: secrets,
    };
  if (actor.kind === "team") {
    const m = db
      .prepare("SELECT draft FROM members WHERE token=?")
      .get(hash(credential)) as { draft: string | null } | undefined;
    return {
      ...base,
      privateCard: secrets[actor.role!],
      draft: m?.draft ? JSON.parse(m.draft) : null,
    };
  }
  return {
    ...base,
    clauses: g.clauses.filter((c) => c.published),
    history: [],
    proposals: [],
    authorityMaps: [],
    practice: [],
    reflections: [],
    logs: [],
    consents: [],
    shared: [],
  };
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
    if (a.type === "rotate") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      let code = "";
      do {
        code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
      } while (db.prepare("SELECT id FROM rooms WHERE code=?").get(code));
      db.prepare("UPDATE rooms SET code=? WHERE id=?").run(code, id);
    } else if (a.type === "approve" || a.type === "revoke") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      if (a.type === "approve") {
        const m = db
          .prepare("SELECT * FROM members WHERE token=? AND room=?")
          .get(String(a.memberId), id) as Member | undefined;
        if (!m) throw Error("הבקשה לא נמצאה");
        db.prepare(
          "DELETE FROM members WHERE room=? AND role=? AND token<>?",
        ).run(id, m.role, m.token);
        db.prepare("UPDATE members SET approved=1 WHERE token=?").run(m.token);
      } else
        db.prepare("DELETE FROM members WHERE room=? AND role=?").run(
          id,
          String(a.role),
        );
    } else if (a.type === "draft") {
      if (actor.kind !== "team") throw Error("למשלחת בלבד");
      const draft = JSON.stringify(a.draft);
      if (draft.length > 20000) throw Error("הטיוטה גדולה מדי");
      db.prepare("UPDATE members SET draft=? WHERE token=?").run(
        draft,
        hash(credential),
      );
    } else if (a.type === "delete") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      db.prepare("DELETE FROM members WHERE room=?").run(id);
      db.prepare("DELETE FROM rooms WHERE id=?").run(id);
    } else {
      const g = applyCommand(
        JSON.parse(r.state),
        a,
        actor,
        commandId,
        revision,
      );
      db.prepare("UPDATE rooms SET state=? WHERE id=?").run(
        JSON.stringify(g),
        id,
      );
    }
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
