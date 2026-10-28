"use client";
import { useId, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  HelpCircle,
  WifiOff,
  Users,
} from "lucide-react";
import { publicRoles, type Phase, type Role } from "../../../../lib/content";
import {
  guideSteps,
  phaseProgress,
  teamSubmission,
  diffWords,
} from "../../../../lib/guidance";
import type { Game } from "../../../../lib/engine";
export function TaskGuide({
  game,
  role,
  onNavigate,
  activeStep,
  setActiveStep,
}: {
  game: Game;
  role?: Role;
  onNavigate: (target: string) => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
}) {
  const progress = role ? teamSubmission(game, role) : null;
  const done = progress?.submitted && game.phase !== "CRISIS3";
  return (
    <section
      className={"task-guide " + (done ? "task-guide-done" : "")}
      aria-labelledby="task-guide-title"
    >
      <div className="task-guide-top">
        <span className="guide-eyebrow">{phaseProgress(game.phase)}</span>
        <span className="guide-audience">
          {role
            ? publicRoles.find((r) => r.id === role)?.name
            : "מלוות את המשלחות"}
        </span>
      </div>
      <h2 id="task-guide-title">
        {done ? "נשמר — אפשר להמשיך בדיון" : "עכשיו תורכן"}
      </h2>
      {(done || (game.phase === "CRISIS3" && progress?.submitted)) && (
        <p className="guide-confirmation" role="status">
          <CheckCircle2 size={20} />
          {game.phase === "CRISIS3"
            ? "המיפוי נשמר. עכשיו בדקו התחייבות קודמת."
            : progress?.label}
        </p>
      )}
      <ol className="guide-steps">
        {guideSteps[game.phase].map((step, i) => (
          <li key={i}>
            <button
              type="button"
              className={
                done ? "step-done" : activeStep === i ? "step-current" : ""
              }
              aria-current={!done && activeStep === i ? "step" : undefined}
              onClick={() => {
                setActiveStep(i);
                onNavigate(step.target);
              }}
            >
              <span className="step-index" aria-hidden="true">
                {done ? <Check size={16} /> : i + 1}
              </span>
              <span>{step.label}</span>
              <ChevronLeft
                size={16}
                className="step-arrow"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ol>
      <p className="guide-hint">
        {done
          ? "אפשר לעיין מחדש ולתקן; אין צורך לשלוח שוב אם הנוסח לא השתנה."
          : "לחצו על צעד כדי להגיע אליו. שליחה תיחשב רק אחרי אישור שמירה."}
      </p>
    </section>
  );
}
export function ReadinessPanel({
  game,
  teams,
}: {
  game: Game;
  teams: { role: Role; joined: boolean; connected: boolean }[];
}) {
  const results = teams.map((t) => ({ ...t, ...teamSubmission(game, t.role) }));
  const required = results.some((t) => t.required);
  const submitted = results.filter((t) => t.joined && t.submitted).length;
  const joined = results.filter((t) => t.joined).length;
  return (
    <section className="readiness-panel" aria-labelledby="readiness-heading">
      <div className="readiness-heading">
        <div>
          <span className="guide-eyebrow">במבט אחד למנחה</span>
          <h2 id="readiness-heading">
            {required
              ? `${submitted} מתוך 5 משלחות הגישו`
              : `${joined} מתוך 5 משלחות הצטרפו`}
          </h2>
        </div>
        <Users size={25} aria-hidden="true" />
      </div>
      <p className="readiness-note">
        {required
          ? "המצב מתייחס להגשה בשלב הנוכחי. חיבור למפגש אינו הגשת תשובה."
          : "אפשר להתחיל גם כשנותרו משלחות להצטרפות, לפי שיקול המנחה."}
      </p>
      <ul className="readiness-list">
        {results.map((t) => (
          <li key={t.role}>
            <span className="role-avatar" aria-hidden="true">
              {publicRoles.find((r) => r.id === t.role)?.initial}
            </span>
            <div>
              <strong>{publicRoles.find((r) => r.id === t.role)?.name}</strong>
              <span
                className={
                  t.submitted ? "submission-complete" : "submission-waiting"
                }
              >
                {!t.joined ? (
                  "טרם הצטרפו"
                ) : t.submitted ? (
                  <>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {t.label}
                  </>
                ) : (
                  t.label
                )}
              </span>
            </div>
            <span
              className={
                "presence-label " + (!t.connected ? "presence-offline" : "")
              }
            >
              {!t.joined ? (
                "ממתינות"
              ) : t.connected ? (
                <>
                  <span className="live-dot" />
                  מחוברות
                </>
              ) : (
                <>
                  <WifiOff size={15} aria-hidden="true" />
                  מנותקות
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
const glossary = {
  תקן: {
    title: "מה פירוש תקן שעות?",
    text: "היקף שעות הוראה שאושר. במשחק, אישור שעות אינו מבטיח שכבר נמצאה מורה מתאימה.",
  },
  "ייעוד תקציב": {
    title: "מה פירוש ייעוד תקציב?",
    text: "המטרה שלשמה הוקצה התקציב. כדי לברר אם אפשר להשתמש בו למטרה אחרת, צריך לבדוק את הכללים ואת הגורם המאשר.",
  },
  סמכות: {
    title: "מה פירוש סמכות?",
    text: "מי רשאי לקבל או לאשר את ההחלטה המסוימת. הסכמה בין המשלחות אינה מחליפה את האישור הנדרש.",
  },
};
export type Term = keyof typeof glossary;
export function TermHelp({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="term-help">
      <button
        type="button"
        className="term-button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={"הסבר: " + term}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {term}
        <HelpCircle size={15} aria-hidden="true" />
      </button>
      {open && (
        <span id={id} role="note" className="term-note">
          <strong>{glossary[term].title}</strong>
          <span>{glossary[term].text}</span>
          <small>הסבר פדגוגי למשחק; לא קביעה מוסדית מאומתת.</small>
        </span>
      )}
    </span>
  );
}
export function GlossaryStrip() {
  return (
    <div className="glossary-strip">
      <span>מה זה אומר כאן?</span>
      {(Object.keys(glossary) as Term[]).map((term) => (
        <TermHelp key={term} term={term} />
      ))}
    </div>
  );
}
export function ExplainedText({ text }: { text: string }) {
  const chunks = text.split(/(ייעוד תקציב|סמכות|תקן)/u);
  return (
    <>
      {chunks.map((chunk, i) =>
        Object.hasOwn(glossary, chunk) ? (
          <TermHelp key={i} term={chunk as Term} />
        ) : (
          chunk
        ),
      )}
    </>
  );
}
export function RevisionComparison({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const diff = diffWords(before, after);
  return (
    <div className="revision-comparison">
      <div>
        <h3>לפני</h3>
        <p>
          {diff.before.length
            ? diff.before.map((word, i) => (
                <span key={i}>
                  {word.changed ? <del>{word.text}</del> : word.text}{" "}
                </span>
              ))
            : "טרם נוסח סעיף"}
        </p>
      </div>
      <div>
        <h3>אחרי</h3>
        <p>
          {diff.after.map((word, i) => (
            <span key={i}>
              {word.changed ? <mark>{word.text}</mark> : word.text}{" "}
            </span>
          ))}
        </p>
      </div>
      <p className="diff-key">
        תוספות מסומנות ברקע ובסימון הדגשה; מילים שהוסרו מסומנות בקו חוצה.
      </p>
    </div>
  );
}
