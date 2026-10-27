import { scenes, statuses, type Role, type Phase } from "./content";
export type Status = keyof typeof statuses;
export type Proposal = {
  id: string;
  team: Role;
  phase: Phase;
  option: string;
  action: string;
  price: string;
  condition: string;
  owner: string;
  createdAt: number;
};
export type Clause = {
  id: string;
  category: string;
  title: string;
  action: string;
  owner: string;
  requiredPartners: string;
  resources: string;
  nextStep: string;
  deadline: string;
  schoolEffects: string;
  status: Status;
  authority: boolean;
  funding: boolean;
  readiness: boolean;
  ofakim: boolean;
  shvilim: boolean;
  evidence: string;
  published: boolean;
  version: number;
  previous?: string;
  reason?: string;
};
export type Log = {
  seq: number;
  type: string;
  actor: string;
  at: number;
  text: string;
};
export type Game = {
  id: string;
  name: string;
  phase: Phase;
  revision: number;
  running: boolean;
  elapsedMs: number;
  phaseStartedMs: number;
  anchor: number;
  createdAt: number;
  proposals: Proposal[];
  clauses: Clause[];
  history: Clause[];
  consents: {
    team: Role;
    clauseId: string;
    version: number;
    position: string;
    condition: string;
  }[];
  shared: { team: Role; text: string }[];
  logs: Log[];
  processed: string[];
  budget: number[];
  counter?: {
    change: string;
    promise: string;
    reason: string;
    wait: string;
    result: string;
  };
  finalRevision?: {
    clauseId: string;
    before: string;
    after: string;
    reason: string;
  };
  reflections: { team: Role; answers: string[] }[];
  authorityMaps: { team: Role; rows: string[][] }[];
  practice: { team: Role; text: string }[];
  oral: { yael: boolean; michal: boolean };
  advisorId?: string;
  interventions: Phase[];
  revealedOptions: Phase[];
  outcome?: ReturnType<typeof selectOutcome>;
};
export type Action = { type: string; [key: string]: unknown };
export type Actor = { kind: "host" | "team" | "projector"; role?: Role };
export function createGame(id: string, name: string, now = Date.now()): Game {
  return {
    id,
    name,
    phase: "LOBBY",
    revision: 0,
    running: false,
    elapsedMs: 0,
    phaseStartedMs: 0,
    anchor: now,
    createdAt: now,
    proposals: [],
    clauses: ["כוח אדם", "חלוקת משאבים", "יישום ופדגוגיה"].map(
      (category, i) => ({
        id: String(i),
        category,
        title: category,
        action: "",
        owner: "",
        requiredPartners: "",
        resources: "",
        nextStep: "",
        deadline: "",
        schoolEffects: "",
        status: "UNRESOLVED",
        authority: false,
        funding: false,
        readiness: false,
        ofakim: false,
        shvilim: false,
        evidence: "",
        published: false,
        version: 1,
      }),
    ),
    history: [],
    consents: [],
    shared: [],
    logs: [],
    processed: [],
    budget: [2, 3, 1],
    reflections: [],
    authorityMaps: [],
    practice: [],
    oral: { yael: false, michal: false },
    interventions: [],
    revealedOptions: [],
  };
}
export function elapsed(g: Game, now = Date.now()) {
  return g.elapsedMs + (g.running ? Math.max(0, now - g.anchor) : 0);
}
export function selectOutcome(g: Pick<Game, "clauses">) {
  const pending = g.clauses.filter(
    (c) => c.status !== "APPROVED_EXECUTABLE",
  ).length;
  const readySchools = ["ofakim", "shvilim"].filter((s) =>
    g.clauses
      .filter((c) => c.status === "APPROVED_EXECUTABLE")
      .every((c) => c[s as "ofakim" | "shvilim"]),
  );
  if (pending >= 2 || readySchools.length === 0)
    return {
      id: "PROMISE_GAP",
      title: "הפער בין הבטחה לביצוע",
      reason: "לפחות שני סעיפים נותרו ללא תנאי ביצוע מלאים.",
      yael: "ההבטחה נשארה על הנייר. החדרים והמורות עדיין אינם מוכנים יחד.",
      michal: "קיבלנו הסכמות, אבל לא מסלול ביצוע שלם. עדיין חסרה לנו ודאות.",
      target: "היעד עדיין לא הובטח",
      gap: "הפערים לא קיבלו מענה מספק",
      capacity: "תלויות מרכזיות נשארו פתוחות",
    };
  if (readySchools.length === 1)
    return {
      id: "UNEQUAL_SUCCESS",
      title: "התקדמות שאינה שווה",
      reason: "הסעיפים מתארים מסלול ביצוע לבית ספר אחד בלבד.",
      yael: "התקדמנו בחלק מהצעדים, אבל לא לכל בית ספר ניתנה אותה אפשרות.",
      michal: "תמיכה מותאמת הייתה יכולה לעזור לנו להתקדם יחד.",
      target: "התקדמות חלקית",
      gap: "מסלול היישום אינו מכסה את שני בתי הספר",
      capacity: "יכולת לא אחידה",
    };
  return {
    id: "SLOW_STABLE",
    title: "לאט יותר. יציב יותר.",
    reason: "רוב הסעיפים בני־ביצוע ואין מסלול המוגדר לבית ספר אחד בלבד.",
    yael: "לא הכול קרה מיד, אבל יש צעדים ואחריות שאפשר לעקוב אחריהם.",
    michal: "בנינו תהליך יציב יותר. עדיין צריך לבדוק שהמורות והחדרים מוכנים.",
    target: "התקדמות מדורגת; אין הבטחת השגה",
    gap: "קיימת התייחסות לשני בתי הספר",
    capacity: "תהליך מתייצב",
  };
}
function str(v: unknown, max = 600) {
  if (typeof v !== "string") throw Error("חסר שדה טקסט");
  if (v.length > max) throw Error("הטקסט ארוך מדי");
  return v.trim();
}
function need(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
export function applyCommand(
  input: Game,
  a: Action,
  actor: Actor,
  commandId: string,
  expected: number,
  now = Date.now(),
): Game {
  if (input.processed.includes(commandId)) return input;
  need(
    expected === input.revision,
    "המצב השתנה. רעננו ונסו שוב; הטיוטה נשמרה.",
  );
  need(actor.kind !== "projector", "המסך הזה לקריאה בלבד");
  const g = structuredClone(input);
  let note = "";
  const host = actor.kind === "host";
  const role = actor.role;
  const hostActions = [
    "start",
    "pause",
    "resume",
    "advance",
    "budget",
    "counter",
    "oral",
    "intervention",
    "delete",
  ];
  if (hostActions.includes(a.type)) need(host, "הפעולה זמינה למנחה בלבד");
  if (!host) {
    need(role, "חסרה הרשאת משלחת");
    need(g.phase !== "COMPLETE", "המפגש הסתיים");
  }
  switch (a.type) {
    case "revealOptions":
      need(host, "חשיפת חלופות זמינה למנחה בלבד");
      need(
        scenes.find((s) => s.id === g.phase)?.options?.length,
        "אין חלופות בשלב זה",
      );
      g.revealedOptions = [...new Set([...(g.revealedOptions || []), g.phase])];
      note = "נחשפו החלופות למסך ההקרנה";
      break;
    case "start":
      need(g.phase === "LOBBY", "המפגש כבר התחיל");
      g.phase = "OPENING";
      g.running = true;
      g.anchor = now;
      note = "המפגש התחיל";
      break;
    case "pause":
      g.elapsedMs = elapsed(g, now);
      g.anchor = now;
      g.running = false;
      note = "השעון הושהה";
      break;
    case "resume":
      need(g.phase !== "LOBBY" && g.phase !== "COMPLETE", "לא ניתן להמשיך כעת");
      g.anchor = now;
      g.running = true;
      note = "השעון חודש";
      break;
    case "advance": {
      const i = scenes.findIndex((s) => s.id === g.phase);
      need(i < scenes.length - 1, "המפגש הסתיים");
      g.phaseStartedMs = elapsed(g, now);
      g.phase = scenes[i + 1].id;
      if (g.phase === "OPENING") {
        g.running = true;
        g.anchor = now;
      }
      if (g.phase === "FUTURE") g.outcome = selectOutcome(g);
      if (g.phase === "COMPLETE") {
        g.elapsedMs = elapsed(g, now);
        g.running = false;
      }
      note = "מעבר לשלב: " + scenes[i + 1].label;
      break;
    }
    case "proposal": {
      need(role, "בחרו משלחת");
      need(
        ["CRISIS1", "CRISIS2", "CRISIS4"].includes(g.phase),
        "אין בחירה פתוחה בשלב זה",
      );
      const option = str(a.option);
      need(["A", "B", "C", "MIX"].includes(option), "בחרו חלופה");
      const action = str(a.action);
      const price = str(a.price);
      const condition = str(a.condition);
      need(action && price && condition, "מלאו הצעה, מחיר ותנאי");
      g.proposals.push({
        id: commandId,
        team: role,
        phase: g.phase,
        option,
        action,
        price,
        condition,
        owner: str(a.owner),
        createdAt: now,
      });
      note = "הוגשה עמדה של " + role;
      break;
    }
    case "share":
      need(role, "בחרו משלחת");
      need(g.phase !== "LOBBY", "המפגש טרם התחיל");
      {
        const text = str(a.text);
        need(text, "כתבו מה לשתף");
        g.shared.push({ team: role, text });
        note = "שותף מידע שנבחר בידי המשלחת";
      }
      break;
    case "budget":
      need(g.phase === "CRISIS2", "חלוקת התקציב פתוחה במשבר 2");
      {
        const b = a.values;
        need(
          Array.isArray(b) &&
            b.length === 3 &&
            b.every((x) => Number.isInteger(x) && x >= 0) &&
            b.reduce((x, y) => x + y, 0) === 6,
          "יש לחלק בדיוק שש יחידות שלמות",
        );
        g.budget = b;
      }
      note = "חלוקת יחידות הסיוע עודכנה";
      break;
    case "counter":
      need(g.phase === "CRISIS2", "ההצעה פתוחה במשבר 2");
      need(!g.counter, "כבר הוגשה הצעת נגד משותפת");
      {
        const change = str(a.change),
          promise = str(a.promise),
          reason = str(a.reason),
          wait = str(a.wait);
        g.counter = {
          change,
          promise,
          reason,
          wait,
          result:
            !change || !promise || !reason || !wait
              ? "תיקון חסר"
              : a.pending === true
                ? "מותנה במימון וסמכות"
                : "מאושרת עקרונית",
        };
      }
      note = "הוגשה הצעת נגד משותפת";
      break;
    case "clause": {
      need(
        host || g.phase === "AGREEMENT" || g.phase === "CRISIS3",
        "עריכת סעיף אינה פתוחה כעת",
      );
      need(
        g.phase !== "FUTURE" && g.phase !== "COMPLETE",
        "השתמשו בתיקון הסופי",
      );
      const i = g.clauses.findIndex((c) => c.id === a.id);
      need(i >= 0, "הסעיף לא נמצא");
      const old = g.clauses[i];
      const patch = a.clause as Record<string, unknown>;
      need(patch && typeof patch === "object", "חסר סעיף");
      const c = { ...old };
      for (const k of [
        "action",
        "owner",
        "requiredPartners",
        "resources",
        "nextStep",
        "deadline",
        "schoolEffects",
      ] as const)
        c[k] = str(patch[k]);
      c.status = patch.status as Status;
      need(Object.hasOwn(statuses, c.status), "סטטוס לא תקין");
      c.authority = patch.authority === true;
      c.funding = patch.funding === true;
      c.readiness = patch.readiness === true;
      c.ofakim = patch.ofakim === true;
      c.shvilim = patch.shvilim === true;
      c.evidence = str(patch.evidence || "");
      c.published = false;
      need(
        c.action &&
          c.owner &&
          c.nextStep &&
          c.deadline &&
          c.requiredPartners &&
          c.resources &&
          c.schoolEffects,
        "מלאו פעולה, אחריות, שותפים, משאבים, צעד, מועד והשפעה",
      );
      if (c.status === "APPROVED_EXECUTABLE")
        need(
          c.authority && c.funding && c.readiness && c.evidence,
          "לסיווג בר־ביצוע נדרשים סמכות, מימון ומוכנות מתועדים בסימולציה",
        );
      g.history.push(old);
      c.previous = old.action;
      c.version++;
      g.clauses[i] = c;
      note = "נשמרה גרסה חדשה: " + c.category;
      break;
    }
    case "consent":
      need(role, "בחרו משלחת");
      {
        const c = g.clauses.find((c) => c.id === a.id);
        need(c, "הסעיף לא נמצא");
        const position = str(a.position);
        need(
          ["support", "object", "conditional"].includes(position),
          "עמדה לא תקינה",
        );
        g.consents = g.consents.filter(
          (v) =>
            !(
              v.team === role &&
              v.clauseId === c.id &&
              v.version === c.version
            ),
        );
        g.consents.push({
          team: role,
          clauseId: c.id,
          version: c.version,
          position,
          condition: position === "conditional" ? str(a.condition) : "",
        });
        if (position === "conditional")
          need(g.consents.at(-1)?.condition, "כתבו את התנאי להסכמה");
        note = "נשמרה עמדה לגרסת הסעיף";
      }
      break;
    case "publish":
      need(host, "פרסום זמין למנחה בלבד");
      {
        const c = g.clauses.find((c) => c.id === a.id);
        need(c && c.action, "נסחו התחייבות לפני פרסום");
        c.published = true;
        note = "פורסמה התחייבות למסך ההקרנה: " + c.category;
      }
      break;
    case "final":
      need(g.phase === "FUTURE", "התיקון פתוח בשלב העתיד");
      need(!g.finalRevision, "אפשר לתקן סעיף אחד בלבד");
      {
        const c = g.clauses.find((c) => c.id === a.id);
        need(c, "הסעיף לא נמצא");
        const after = str(a.after),
          reason = str(a.reason);
        need(after && reason, "כתבו תיקון ונימוק");
        g.finalRevision = { clauseId: c.id, before: c.action, after, reason };
        g.history.push({ ...c });
        c.previous = c.action;
        c.action = after;
        c.version++;
        c.status = "AGREED_PENDING";
        c.authority = false;
        c.funding = false;
        c.readiness = false;
        c.published = false;
        note = "נשמר התיקון הסופי";
      }
      break;
    case "reflection":
      need(role, "בחרו משלחת");
      need(g.phase === "TRANSFER", "הרפלקציה פתוחה בסיום");
      {
        const answers = a.answers;
        need(
          Array.isArray(answers) && answers.length === 3,
          "נדרשות שלוש תשובות",
        );
        const clean = answers.map((x) => str(x));
        need(clean.every(Boolean), "השיבו בקצרה לשלוש השאלות");
        g.reflections = g.reflections.filter((x) => x.team !== role);
        g.reflections.push({ team: role, answers: clean });
        note = "נשמרה רפלקציה";
      }
      break;
    case "authority":
      need(role && g.phase === "CRISIS3", "החקירה פתוחה במשבר 3");
      {
        const rows = a.rows;
        need(
          Array.isArray(rows) &&
            rows.length === 4 &&
            rows.every((r) => Array.isArray(r) && r.length === 4),
          "מלאו ארבע פעולות",
        );
        const clean = rows.map((r) => (r as unknown[]).map((v) => str(v, 300)));
        need(
          clean.every((r) => r.every(Boolean)),
          "אפשר לכתוב ״נדרש בירור״ בשדה שאינו ידוע",
        );
        g.authorityMaps = g.authorityMaps.filter((x) => x.team !== role);
        g.authorityMaps.push({ team: role!, rows: clean });
        note = "נשמר מיפוי סמכויות";
      }
      break;
    case "practice":
      need(role && g.phase === "CRISIS4", "המשימה פתוחה במשבר 4");
      {
        const text = str(a.text);
        need(text, "הגדירו פרקטיקה ושינוי שניתן לראות");
        g.practice = g.practice.filter((x) => x.team !== role);
        g.practice.push({ team: role!, text });
        note = "נשמרה פרקטיקת הוראה";
      }
      break;
    case "oral":
      need(a.person === "yael" || a.person === "michal", "דמות לא תקינה");
      g.oral[a.person] = true;
      note = "תועד מענה בעל פה";
      break;
    case "advisor":
      need(g.phase === "AGREEMENT", "הבדיקה פתוחה בשלב ההסכם");
      if (!g.advisorId)
        g.advisorId = (
          g.clauses.find(
            (c) =>
              c.status === "APPROVED_EXECUTABLE" &&
              (!c.authority || !c.funding || !c.readiness),
          ) ||
          g.clauses.find((c) => c.status !== "APPROVED_EXECUTABLE") ||
          g.clauses[0]
        ).id;
      note = "נבחר סעיף לבדיקת היועץ";
      break;
    case "intervention":
      need(!g.interventions.includes(g.phase), "שאלת העומק לשלב זה כבר נשאלה");
      g.interventions.push(g.phase);
      note = "שאלת עומק: מה המחיר, ומי עדיין לא נשמעה?";
      break;
    default:
      throw Error("פעולה לא מוכרת");
  }
  g.revision++;
  g.processed.push(commandId);
  g.logs.push({
    seq: g.revision,
    type: a.type,
    actor: role || "host",
    at: now,
    text: note,
  });
  return g;
}
