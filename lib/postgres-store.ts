import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { randomBytes, createHash } from "node:crypto";
import {
  applyCommand,
  createGame,
  type Action,
  type Actor,
  type Game,
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
import { ServiceError } from "./errors";

type DB = Sql | TransactionSql;
type Room = {
  id: string;
  code: string;
  state: Game;
  host: string;
  projector: string;
  recovery: string;
  created: number | string;
};
type Member = {
  name: string;
  manual: boolean;
  focus: "BOTH" | "NEGOTIATION" | "POLICY";
  token: string;
  room: string;
  role: Role;
  approved: boolean;
  lastseen: number | string;
  draft: Record<string, unknown> | null;
};
let client: Sql | undefined;
let initialized: Promise<void> | undefined;
const token = () => randomBytes(24).toString("hex");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function connection() {
  if (!client) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url)
      throw new ServiceError(
        "המשחק החי עדיין אינו מוגדר באתר. אפשר להמשיך במצב הדגמה.",
        "DATABASE_REQUIRED",
      );
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ServiceError(
        "חיבור המשחק החי דורש בדיקה בידי מנהלת האתר.",
        "DATABASE_INVALID",
      );
    }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol))
      throw new ServiceError(
        "חיבור המשחק החי דורש בדיקה בידי מנהלת האתר.",
        "DATABASE_INVALID",
      );
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    client = postgres(url, {
      max: 3,
      prepare: false,
      idle_timeout: 10,
      connect_timeout: 10,
      ssl: local ? false : { rejectUnauthorized: true },
      onnotice: () => {},
    });
  }
  return client;
}
async function ready() {
  const sql = connection();
  if (!initialized)
    initialized = (async () => {
      // All serverless instances serialize the idempotent schema bootstrap.
      await sql.begin(async (tx) => {
        await tx`SELECT pg_advisory_xact_lock(721603410)`;
        await tx`CREATE TABLE IF NOT EXISTS hd_rooms (id text PRIMARY KEY, code text NOT NULL UNIQUE, state jsonb NOT NULL, host text NOT NULL, projector text NOT NULL, recovery text NOT NULL, created bigint NOT NULL)`;
        await tx`CREATE TABLE IF NOT EXISTS hd_members (token text PRIMARY KEY, room text NOT NULL REFERENCES hd_rooms(id) ON DELETE CASCADE, role text NOT NULL CHECK(role IN ('MOE','FIN','UNION','LOCAL','PRINCIPALS')), approved boolean NOT NULL DEFAULT false, lastseen bigint NOT NULL, draft jsonb, draft_version bigint NOT NULL DEFAULT 0)`;
        await tx`DROP INDEX IF EXISTS hd_one_approved_team`;
        await tx`ALTER TABLE hd_members ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'משתתפת'`;
        await tx`ALTER TABLE hd_members ADD COLUMN IF NOT EXISTS manual boolean NOT NULL DEFAULT false`;
        await tx`ALTER TABLE hd_members ADD COLUMN IF NOT EXISTS focus text NOT NULL DEFAULT 'BOTH'`;
        await tx`CREATE INDEX IF NOT EXISTS hd_members_room ON hd_members(room)`;
        await tx`CREATE INDEX IF NOT EXISTS hd_rooms_created ON hd_rooms(created)`;
        await tx`CREATE TABLE IF NOT EXISTS hd_limits (key text PRIMARY KEY, count integer NOT NULL, until bigint NOT NULL)`;
        await tx`CREATE TABLE IF NOT EXISTS hd_receipts (room text NOT NULL REFERENCES hd_rooms(id) ON DELETE CASCADE, command_id text NOT NULL, actor text NOT NULL, created bigint NOT NULL, PRIMARY KEY(room,command_id))`;
      });
    })().catch((e) => {
      initialized = undefined;
      throw e;
    });
  await initialized;
  return sql;
}
function validRoom(room: Room | undefined): Room {
  if (!room || Number(room.created) < Date.now() - 30 * 86400000)
    throw Error("המפגש לא נמצא או הסתיים תוקף השמירה");
  return room;
}
async function identity(
  sql: DB,
  room: Room,
  credential: string,
  projector?: string,
): Promise<Actor> {
  if (projector) {
    if (hash(projector) !== room.projector)
      throw Error("אין הרשאה למסך ההקרנה");
    return { kind: "projector" };
  }
  if (hash(credential) === room.host) return { kind: "host" };
  const [m] = await sql<
    Member[]
  >`SELECT * FROM hd_members WHERE token=${hash(credential)} AND room=${room.id}`;
  if (!m) throw Error("אין הרשאה למפגש");
  await sql`UPDATE hd_members SET lastseen=${Date.now()} WHERE token=${m.token}`;
  if (!m.approved) throw Error("PENDING");
  return { kind: "team", role: m.role };
}
export async function cleanup() {
  const sql = await ready();
  await sql`DELETE FROM hd_rooms WHERE created<${Date.now() - 30 * 86400000}`;
  await sql`DELETE FROM hd_limits WHERE until<${Date.now()}`;
}
export async function checkDatabase() {
  const sql = await ready();
  await sql`SELECT 1`;
  return { storage: "postgres" as const };
}
export async function rateLimit(key: string, max = 60) {
  const sql = await ready(),
    now = Date.now();
  const [r] =
    await sql`INSERT INTO hd_limits(key,count,until) VALUES(${key},1,${now + 60000}) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN hd_limits.until<=${now} THEN 1 ELSE hd_limits.count+1 END, until=CASE WHEN hd_limits.until<=${now} THEN ${now + 60000} ELSE hd_limits.until END RETURNING count`;
  if (r.count > max) throw Error("בקשות רבות מדי. המתינו דקה ונסו שוב.");
}
export async function newRoom(name: string) {
  const sql = await ready();
  await cleanup();
  const id = token().slice(0, 12),
    host = token(),
    projector = token(),
    recovery = token();
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(721603411)`;
    let code = "";
    do {
      code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    } while ((await tx`SELECT id FROM hd_rooms WHERE code=${code}`).length);
    const game = createGame(id, name.slice(0, 80) || "מפגש חדר המצב");
    await tx`INSERT INTO hd_rooms(id,code,state,host,projector,recovery,created) VALUES(${id},${code},${tx.json(game as unknown as postgres.JSONValue)},${hash(host)},${hash(projector)},${hash(recovery)},${Date.now()})`;
    return { id, code, host, projector, recovery };
  });
}
export async function joinRoom(
  code: string,
  role: Role,
  name = "משתתפת",
  credential = "",
) {
  name = memberName(name);
  if (!roles.some((t) => t.id === role)) throw Error("בחרו משלחת");
  const sql = await ready();
  return sql.begin(async (tx) => {
    const [row] = await tx<
      Room[]
    >`SELECT * FROM hd_rooms WHERE code=${code.toUpperCase()} FOR UPDATE`;
    const room = validRoom(row);
    if (room.state.phase === "COMPLETE") throw Error("המפגש הסתיים");
    if (hash(credential) === room.host) return { id: room.id, key: credential };
    const [existing] = await tx<
      Member[]
    >`SELECT * FROM hd_members WHERE room=${room.id} AND token=${hash(credential)}`;
    if (existing) return { id: room.id, key: credential };
    if (!settings(room.state).joinOpen) throw Error("ההצטרפות למפגש נעולה");
    const key = token();
    const approved = !settings(room.state).approvalRequired;
    await tx`INSERT INTO hd_members(token,room,role,name,approved,lastseen) VALUES(${hash(key)},${room.id},${role},${name},${approved},${Date.now()})`;
    const rows = await tx<
      Member[]
    >`SELECT * FROM hd_members WHERE room=${room.id}`;
    initialize(room.state, normalize(rows));
    await tx`UPDATE hd_rooms SET state=${tx.json(room.state as unknown as postgres.JSONValue)} WHERE id=${room.id}`;
    return { id: room.id, key };
  });
}
export async function readSnapshot(
  id: string,
  credential: string,
  projector?: string,
) {
  const sql = await ready();
  return sql.begin(async (tx) => {
    const [row] = await tx<
      Room[]
    >`SELECT * FROM hd_rooms WHERE id=${id} FOR SHARE`;
    const r = validRoom(row);
    const actor = await identity(tx, r, credential, projector);
    const members = await tx<
      Member[]
    >`SELECT * FROM hd_members WHERE room=${id}`;
    return view(r.state, normalize(members), actor, hash(credential), r.code);
  });
}
export async function command(
  id: string,
  credential: string,
  a: Action,
  commandId: string,
  revision: number,
) {
  const sql = await ready();
  await sql.begin(async (tx) => {
    const [row] = await tx<
      Room[]
    >`SELECT * FROM hd_rooms WHERE id=${id} FOR UPDATE`;
    const r = validRoom(row);
    const actor = await identity(tx, r, credential);
    const [receipt] =
      await tx`SELECT actor FROM hd_receipts WHERE room=${id} AND command_id=${commandId}`;
    if (receipt) {
      if (receipt.actor !== hash(credential)) throw Error("אין הרשאה לפקודה");
      return;
    }
    const rows = await tx<Member[]>`SELECT * FROM hd_members WHERE room=${id}`;
    initialize(r.state, normalize(rows));
    authorizeTeam(r.state, actor, hash(credential), a);
    if (a.type === "rotate") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      throw Error("קישור ההצטרפות קבוע למפגש. אפשר לנעול הצטרפות בהגדרות");
    } else if (managementTypes.includes(a.type)) {
      const members = normalize(rows);
      const previous = new Map(normalize(rows).map((m) => [m.token, m]));
      initialize(r.state, members);
      authorizeTeam(r.state, actor, hash(credential), a);
      manage(r.state, members, a, actor, hash(credential), hash(token()));
      for (const old of rows)
        if (!members.some((m) => m.token === old.token))
          await tx`DELETE FROM hd_members WHERE token=${old.token}`;
      for (const m of members) {
        const old = previous.get(m.token);
        if (old && JSON.stringify(old) === JSON.stringify(m)) continue;
        await tx`INSERT INTO hd_members(token,room,role,name,approved,lastseen,draft,manual,focus) VALUES(${m.token},${id},${m.role},${m.name},${m.approved},${m.lastseen},${m.draft ? tx.json(m.draft as postgres.JSONValue) : null},${!!m.manual},${m.focus || "BOTH"}) ON CONFLICT(token) DO UPDATE SET role=EXCLUDED.role,name=EXCLUDED.name,approved=EXCLUDED.approved,draft=EXCLUDED.draft,focus=EXCLUDED.focus`;
      }
      await tx`UPDATE hd_rooms SET state=${tx.json(r.state as unknown as postgres.JSONValue)} WHERE id=${id}`;
    } else if (a.type === "draft") {
      if (actor.kind !== "team") throw Error("למשלחת בלבד");
      const text = JSON.stringify(a.draft);
      if (!text || text.length > 20000) throw Error("הטיוטה גדולה מדי");
      const version =
        typeof a.draftVersion === "number" &&
        Number.isSafeInteger(a.draftVersion)
          ? a.draftVersion
          : Date.now();
      await tx`UPDATE hd_members SET draft=${tx.json(a.draft as postgres.JSONValue)},draft_version=${version} WHERE token=${hash(credential)} AND draft_version<=${version}`;
    } else if (a.type === "delete") {
      if (actor.kind !== "host") throw Error("למנחה בלבד");
      await tx`DELETE FROM hd_rooms WHERE id=${id}`;
      return;
    } else {
      const g = applyCommand(r.state, a, actor, commandId, revision);
      await tx`UPDATE hd_rooms SET state=${tx.json(g as unknown as postgres.JSONValue)} WHERE id=${id}`;
    }
    await tx`INSERT INTO hd_receipts(room,command_id,actor,created) VALUES(${id},${commandId},${hash(credential)},${Date.now()})`;
  });
}
export async function recover(code: string, key: string) {
  const sql = await ready();
  return sql.begin(async (tx) => {
    const [row] = await tx<
      Room[]
    >`SELECT * FROM hd_rooms WHERE code=${code.toUpperCase()} AND recovery=${hash(key)} FOR UPDATE`;
    if (!row) throw Error("פרטי שחזור לא תקינים");
    const r = validRoom(row);
    const host = token(),
      recovery = token(),
      projector = token();
    await tx`UPDATE hd_rooms SET host=${hash(host)},recovery=${hash(recovery)},projector=${hash(projector)} WHERE id=${r.id}`;
    return { id: r.id, host, recovery, projector };
  });
}

// Used by maintenance commands and integration tests, never exposed to clients.
export async function closeDatabase() {
  if (client) await client.end({ timeout: 2 });
  client = undefined;
  initialized = undefined;
}

function normalize(rows: Member[]): NormalMember[] {
  return rows.map((m) => ({
    ...m,
    lastseen: Number(m.lastseen),
    name: m.name || "משתתפת",
  }));
}
export async function inspectRoom(code: string) {
  const sql = await ready();
  const [row] = await sql<
    Room[]
  >`SELECT * FROM hd_rooms WHERE code=${code.toUpperCase()}`;
  const r = validRoom(row);
  const counts =
    await sql`SELECT role,count(*)::int AS count FROM hd_members WHERE room=${r.id} AND approved GROUP BY role`;
  return {
    id: r.id,
    name: r.state.name,
    settings: settings(r.state),
    teams: roles.map((t) => ({
      role: t.id,
      count: Number(counts.find((c) => c.role === t.id)?.count || 0),
    })),
  };
}
