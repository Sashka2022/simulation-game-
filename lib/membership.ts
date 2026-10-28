import { roles, type Role } from "./content";
import type { Action, Actor, Game } from "./engine";
import { secrets } from "./private";
export type Member = {
  token: string;
  room: string;
  role: Role;
  name: string;
  approved: boolean;
  lastseen: number;
  draft: Record<string, unknown> | null;
  manual?: boolean;
  focus?: "BOTH" | "NEGOTIATION" | "POLICY";
};
export type Settings = {
  joinOpen: boolean;
  switchOpen: boolean;
  approvalRequired: boolean;
  representativeChoice: boolean;
};
export const defaults: Settings = {
  joinOpen: true,
  switchOpen: true,
  approvalRequired: false,
  representativeChoice: true,
};
export function settings(g: Game): Settings {
  return { ...defaults, ...g.membership?.settings };
}
export function memberName(name: string) {
  const value = name.trim();
  if (!value || value.length > 60)
    throw Error("הזינו שם או כינוי, עד 60 תווים");
  return value;
}
export function validRole(role: unknown): asserts role is Role {
  if (!roles.some((r) => r.id === role)) throw Error("בחרו משלחת");
}
export function initialize(g: Game, members: Member[]) {
  g.membership ??= {
    settings: { ...defaults },
    representatives: {},
    ideas: [],
  };
  for (const r of roles) {
    const current = g.membership.representatives[r.id];
    if (
      !members.some((m) => m.token === current && m.approved && m.role === r.id)
    ) {
      const first = members.find(
        (m) => m.approved && m.role === r.id && !m.manual,
      );
      if (first) g.membership.representatives[r.id] = first.token;
      else delete g.membership.representatives[r.id];
    }
  }
}
export const managementTypes = [
  "memberFocus",
  "membershipSettings",
  "addMember",
  "removeMember",
  "moveMember",
  "switchTeam",
  "representative",
  "approve",
  "revoke",
  "idea",
];
export function manage(
  g: Game,
  members: Member[],
  a: Action,
  actor: Actor,
  self: string,
  newId: string,
) {
  initialize(g, members);
  const state = g.membership!;
  const host = actor.kind === "host";
  const me = members.find((m) => m.token === self);
  const target = members.find((m) => m.token === a.memberId);
  if (
    [
      "membershipSettings",
      "addMember",
      "removeMember",
      "moveMember",
      "approve",
      "revoke",
    ].includes(a.type) &&
    !host
  )
    throw Error("למנחה בלבד");
  switch (a.type) {
    case "memberFocus": {
      const member = host ? target : me;
      if (!member) throw Error("המשתתפת לא נמצאה");
      if (!["BOTH", "NEGOTIATION", "POLICY"].includes(String(a.focus)))
        throw Error("בחרו פונקציה");
      member.focus = a.focus as Member["focus"];
      break;
    }
    case "membershipSettings": {
      const next = a.settings as Partial<Settings>;
      if (
        !next ||
        Object.keys(next).some(
          (k) =>
            !Object.keys(defaults).includes(k) ||
            typeof next[k as keyof Settings] !== "boolean",
        )
      )
        throw Error("הגדרות לא תקינות");
      state.settings = { ...settings(g), ...next };
      break;
    }
    case "addMember":
      validRole(a.role);
      members.push({
        token: newId,
        room: g.id,
        role: a.role,
        name: memberName(String(a.name || "")),
        approved: true,
        lastseen: 0,
        draft: null,
        manual: true,
      });
      break;
    case "removeMember":
      if (!target) throw Error("המשתתפת לא נמצאה");
      members.splice(members.indexOf(target), 1);
      break;
    case "revoke":
      // Compatibility for older host clients; removes a single explicitly selected member only.
      if (!target) throw Error("בחרו משתתפת להסרה");
      members.splice(members.indexOf(target), 1);
      break;
    case "approve":
      if (!target) throw Error("המשתתפת לא נמצאה");
      target.approved = true;
      break;
    case "moveMember":
    case "switchTeam": {
      validRole(a.role);
      const member = host ? target : me;
      if (!host && (a.type !== "switchTeam" || !settings(g).switchOpen))
        throw Error("מעבר בין משלחות נעול");
      if (!member) throw Error("המשתתפת לא נמצאה");
      member.role = a.role;
      member.draft = null;
      break;
    }
    case "representative":
      if (!host && !settings(g).representativeChoice)
        throw Error("מינוי נציגה זמין למנחה בלבד");
      if (
        !target?.approved ||
        target.manual ||
        (!host && target.role !== actor.role)
      )
        throw Error("אין הרשאה למינוי נציגה");
      if (Number(a.expectedMembershipRevision) !== (state.revision || 0))
        throw Error("בחירת הנציגה השתנתה. רעננו ונסו שוב");
      state.representatives[target.role] = target.token;
      break;
    case "idea": {
      if (!me || actor.kind !== "team") throw Error("למשתתפות בלבד");
      if (g.phase === "COMPLETE") throw Error("המפגש הסתיים");
      const text = String(a.text || "").trim();
      if (!text || text.length > 1000) throw Error("כתבו רעיון עד 1000 תווים");
      state.ideas.push({
        id: newId,
        memberId: self,
        name: me.name,
        team: me.role,
        phase: g.phase,
        text,
        at: Date.now(),
      });
      break;
    }
    default:
      throw Error("פעולה לא מוכרת");
  }
  initialize(g, members);
  state.revision = (state.revision || 0) + 1;
}
export const officialActions = [
  "proposal",
  "share",
  "consent",
  "authority",
  "practice",
  "clause",
  "advisor",
  "final",
  "reflection",
];
export function authorizeTeam(g: Game, actor: Actor, self: string, a: Action) {
  if (actor.kind !== "team") return;
  if (
    [
      "start",
      "pause",
      "resume",
      "advance",
      "budget",
      "counter",
      "oral",
      "intervention",
      "delete",
      "publish",
      "rotate",
    ].includes(a.type)
  )
    throw Error("למנחה בלבד");
  if (a.type !== "switchTeam" && a.roleScope !== actor.role)
    throw Error("השיוך למשלחת השתנה. רעננו לפני פעולה נוספת");
  if (
    officialActions.includes(a.type) &&
    g.membership?.representatives[actor.role!] !== self
  )
    throw Error("הפעולה זמינה לנציגת ההגשה בלבד");
}
export function view(
  g: Game,
  members: Member[],
  actor: Actor,
  self: string,
  code: string,
) {
  initialize(g, members);
  const publicMember = (m: Member) => ({
    id: m.token,
    name: m.name,
    role: m.role,
    approved: m.approved,
    manual: !!m.manual,
    focus: m.focus || "BOTH",
    connected: m.approved && m.lastseen > Date.now() - 20000,
  });
  const base = {
    ...g,
    membership: undefined,
    processed: [],
    actor,
    serverNow: Date.now(),
    teams: roles.map((r) => ({
      role: r.id,
      count: members.filter((m) => m.role === r.id && m.approved).length,
      joined: members.some((m) => m.role === r.id && m.approved),
      connected: members.some(
        (m) => m.role === r.id && m.approved && m.lastseen > Date.now() - 20000,
      ),
    })),
  };
  if (actor.kind === "projector")
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
  const visible =
    actor.kind === "host"
      ? members
      : members.filter((m) => m.role === actor.role && m.approved);
  const membership = {
    settings: settings(g),
    revision: g.membership!.revision || 0,
    representatives:
      actor.kind === "host"
        ? g.membership!.representatives
        : { [actor.role!]: g.membership!.representatives[actor.role!] },
    ideas: g.membership!.ideas.filter(
      (i) => actor.kind === "host" || i.team === actor.role,
    ),
    members: visible.map(publicMember),
  };
  if (actor.kind === "host")
    return {
      ...base,
      membership,
      code,
      requests: members
        .filter((m) => !m.approved)
        .map((m) => ({ id: m.token, role: m.role, name: m.name })),
      privateCards: secrets,
    };
  return {
    ...base,
    membership,
    actor: { ...actor, memberId: self },
    privateCard: secrets[actor.role!],
    draft: members.find((m) => m.token === self)?.draft || null,
    authorityMaps: g.authorityMaps.filter((x) => x.team === actor.role),
    practice: g.practice.filter((x) => x.team === actor.role),
    reflections: g.reflections.filter((x) => x.team === actor.role),
  };
}
