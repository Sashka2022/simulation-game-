import type { Game, Clause } from "./engine";
import type { Phase, Role } from "./content";
export const sceneSummaries: Record<Phase, string> = {
  LOBBY: "כל זוג מצטרף למשלחת אחרת. המנחה מאשרת את הכניסה ומתחילות יחד.",
  OPENING:
    "ההבטחה: עד 25 תלמידים בכיתה בתוך שלוש שנים. שני בתי ספר מתחילים מנקודות פתיחה שונות.",
  CRISIS1:
    "מועמדת עוברת מרצונה משבילים לאופקים. הבעיה נפתרת במקום אחד, אבל המחסור במערכת כמעט לא קטן.",
  CRISIS2:
    "יש שש יחידות סיוע בלבד. צריך להחליט מי מקבלת קודם, מה יבוצע ומי תמתין.",
  CRISIS3:
    "התקציב אושר, אבל המורות והחדרים עדיין אינם מוכנים. זה הזמן לבדוק מי מוסמך לקדם כל פעולה.",
  CRISIS4:
    "דרישה חדשה לשיפור שכר מתחרה במשאבים שכבר הובטחו לפתיחת כיתות. צריך להסביר את הפשרה ואת השינוי בהוראה.",
  AGREEMENT:
    "שלושה סעיפים בלבד: כוח אדם, חלוקת משאבים ויישום ופדגוגיה. לכל סעיף אחריות ותנאים ברורים.",
  FUTURE: "ספטמבר 2029 בסימולציה. קראו את ההשלכות ובחרו סעיף אחד לתיקון.",
  TRANSFER:
    "חסרות שעות תמיכה, אבל יש תקציב למטרה אחרת. מה כדאי לברר לפני שמציעים להעסיק עוד מורה?",
  COMPLETE:
    "ההחלטות והשאלות נשמרו. אפשר לחזור אליהן בדוח ולבחור מה לוקחות לעבודה בבית הספר.",
};
export function phaseProgress(phase: Phase) {
  if (phase.startsWith("CRISIS")) return `משבר ${phase.slice(-1)} מתוך 4`;
  return (
    (
      {
        LOBBY: "לפני שמתחילות",
        OPENING: "פתיחה · מכירות את התפקיד",
        AGREEMENT: "מגבשות הסכם",
        FUTURE: "בוחנות את העתיד",
        TRANSFER: "לוקחות לבית הספר",
        COMPLETE: "המפגש הסתיים",
      } as Partial<Record<Phase, string>>
    )[phase] || ""
  );
}
export function teamSubmission(
  g: Game,
  role: Role,
): { submitted: boolean; required: boolean; label: string } {
  const proposal = g.proposals.some(
    (p) => p.team === role && p.phase === g.phase,
  );
  switch (g.phase) {
    case "CRISIS1":
    case "CRISIS2":
      return {
        submitted: proposal,
        required: true,
        label: proposal ? "העמדה נשלחה" : "ממתינות להגשת עמדה",
      };
    case "CRISIS3": {
      const done = g.authorityMaps.some((p) => p.team === role);
      return {
        submitted: done,
        required: true,
        label: done ? "מיפוי האחריות נשמר" : "ממתינות למיפוי האחריות",
      };
    }
    case "CRISIS4": {
      const practice = g.practice.some((p) => p.team === role);
      return {
        submitted: proposal && practice,
        required: true,
        label:
          proposal && practice
            ? "העמדה ותשובת ההוראה נשמרו"
            : proposal
              ? "נדרשת תשובה על ההוראה"
              : practice
                ? "ממתינות להגשת עמדה"
                : "ממתינות לעמדה ולתשובת הוראה",
      };
    }
    case "AGREEMENT": {
      const count = g.clauses.filter((c) =>
        g.consents.some(
          (v) =>
            v.team === role && v.clauseId === c.id && v.version === c.version,
        ),
      ).length;
      return {
        submitted: count === 3,
        required: true,
        label:
          count === 3
            ? "נמסרה עמדה לשלושת הסעיפים"
            : `נמסרה עמדה ל־${count} מתוך 3 סעיפים`,
      };
    }
    case "FUTURE":
      return {
        submitted: !!g.finalRevision,
        required: true,
        label: g.finalRevision ? "התיקון המשותף נשמר" : "ממתינות לתיקון משותף",
      };
    case "TRANSFER": {
      const done = g.reflections.some((p) => p.team === role);
      return {
        submitted: done,
        required: true,
        label: done ? "המבט החדש נשמר" : "ממתינות לרפלקציה",
      };
    }
    default:
      return {
        submitted: false,
        required: false,
        label:
          g.phase === "COMPLETE"
            ? "המפגש הסתיים"
            : g.phase === "LOBBY"
              ? "ממתינות להתחלה"
              : "מכירות את התפקיד והמשימה",
      };
  }
}
export type GuideStep = { label: string; target: string };
export const guideSteps: Record<Phase, GuideStep[]> = {
  LOBBY: [
    { label: "מצטרפות למשלחת", target: "team-join" },
    { label: "מכירות את התפקיד", target: "role" },
    { label: "מתחילות יחד", target: "event" },
  ],
  OPENING: [
    { label: "מכירות את בתי הספר", target: "schools" },
    { label: "קוראות את התפקיד", target: "role" },
    { label: "מזהות מטרה ופשרה", target: "role" },
  ],
  CRISIS1: [
    { label: "משוות את החלופות", target: "options" },
    { label: "מנסחות הצעה ותנאי", target: "proposal-form" },
    { label: "שולחות את העמדה", target: "proposal-form" },
  ],
  CRISIS2: [
    { label: "בוחנות את החלוקה", target: "options" },
    { label: "מסבירות מי תמתין", target: "proposal-form" },
    { label: "שולחות עמדה", target: "proposal-form" },
  ],
  CRISIS3: [
    { label: "קוראות את המכתבים", target: "letters" },
    { label: "ממפות אחריות ואישור", target: "authority-form" },
    { label: "בודקות התחייבות קודמת", target: "ledger" },
  ],
  CRISIS4: [
    { label: "קוראות ראיות וקולות", target: "research" },
    { label: "מגדירות שינוי בהוראה", target: "practice-form" },
    { label: "שולחות עמדה", target: "proposal-form" },
  ],
  AGREEMENT: [
    { label: "קוראות שלושה סעיפים", target: "agreement" },
    { label: "מוסרות עמדה לכל סעיף", target: "agreement" },
    { label: "בודקות מה עדיין חסר", target: "advisor" },
  ],
  FUTURE: [
    { label: "בוחנות את התוצאה", target: "outcome" },
    { label: "מתקנות סעיף אחד", target: "final-form" },
    { label: "מסבירות מה למדנו", target: "final-form" },
  ],
  TRANSFER: [
    { label: "מזהות מי מעורבת", target: "reflection-form" },
    { label: "בודקות איזה מידע חסר", target: "reflection-form" },
    { label: "מציעות צעד ראשון", target: "reflection-form" },
  ],
  COMPLETE: [
    { label: "פותחות את הסיכום", target: "report" },
    { label: "שומרות החלטות ושאלות", target: "report" },
    { label: "לוקחות צעד לבית הספר", target: "report" },
  ],
};
export function missingConditions(c: Clause) {
  if (!c.action) return "נדרש ניסוח משותף";
  const missing = [
    c.status === "UNRESOLVED" && "הסכמה משותפת",
    !c.authority && "סמכות מתאימה",
    !c.funding && "מימון מאושר",
    !c.readiness && "מוכנות לביצוע",
    !c.evidence && "תיעוד התנאים",
  ].filter(Boolean);
  return (
    missing.join(" · ") ||
    (c.status === "APPROVED_EXECUTABLE"
      ? "תנאי הביצוע תועדו בסימולציה"
      : "נדרש בירור סופי של דרגת ההתחייבות")
  );
}
export function diffWords(before: string, after: string) {
  const a = before.trim().split(/\s+/u).filter(Boolean),
    b = after.trim().split(/\s+/u).filter(Boolean);
  const grid = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      grid[i][j] =
        a[i] === b[j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
  const left: { text: string; changed: boolean }[] = [],
    right: { text: string; changed: boolean }[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      left.push({ text: a[i++], changed: false });
      right.push({ text: b[j++], changed: false });
    } else if (
      i < a.length &&
      (j === b.length || grid[i + 1][j] >= grid[i][j + 1])
    )
      left.push({ text: a[i++], changed: true });
    else right.push({ text: b[j++], changed: true });
  }
  return { before: left, after: right };
}
