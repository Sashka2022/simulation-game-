"use client";
import { useState } from "react";
import { publicRoles, scenes, type Role } from "../../../../lib/content";
import type { Game, Action, Actor } from "../../../../lib/engine";
export type RosterMember = {
  id: string;
  name: string;
  role: Role;
  approved: boolean;
  connected: boolean;
  manual: boolean;
  focus: "BOTH" | "NEGOTIATION" | "POLICY";
};
export type MembershipView = NonNullable<Game["membership"]> & {
  members: RosterMember[];
};
type Props = {
  membership: MembershipView;
  actor: Actor;
  busy: boolean;
  send: (action: Action) => Promise<boolean>;
};
const focusLabels = {
  BOTH: "שתי הפונקציות",
  NEGOTIATION: "משא ומתן",
  POLICY: "בדיקת מדיניות",
};
const nameOf = (r: Role) => publicRoles.find((t) => t.id === r)?.name;
export function MembersPanel({
  membership: m,
  actor,
  busy,
  send,
  code,
  qr,
}: Props & { code?: string; qr: string }) {
  return (
    <details className="panel members-panel">
      <summary>
        ניהול משתתפות · {m.members.length}
        {m.members.some((p) => !p.approved)
          ? " · " +
            m.members.filter((p) => !p.approved).length +
            " ממתינות לאישור"
          : ""}
      </summary>
      <div className="join-panel">
        <div>
          <h3>הצטרפות למפגש</h3>
          <a href={"/?join=" + code} target="_blank" rel="noopener">
            פתיחת קישור הצטרפות · {code}
          </a>
          <button
            className="btn outline"
            onClick={() =>
              navigator.clipboard
                .writeText(location.origin + "/?join=" + code)
                .catch(() => {})
            }
          >
            העתקת קישור הצטרפות
          </button>
        </div>
        {qr && (
          <img src={qr} width="140" height="140" alt="קוד QR להצטרפות למפגש" />
        )}
      </div>
      <fieldset disabled={busy}>
        <legend>הגדרות המפגש</legend>
        {(
          [
            ["joinOpen", "הצטרפות פתוחה"],
            ["switchOpen", "מעבר חופשי בין משלחות"],
            ["approvalRequired", "נדרש אישור המנחה להצטרפות"],
            ["representativeChoice", "חברות המשלחת רשאיות לבחור נציגת הגשה"],
          ] as const
        ).map(([key, label]) => (
          <label className="check-row" key={key}>
            <input
              type="checkbox"
              checked={m.settings[key]}
              onChange={(e) =>
                send({
                  type: "membershipSettings",
                  settings: { [key]: e.target.checked },
                })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      {publicRoles.map((r) => (
        <section key={r.id} className="roster-group">
          <h3>
            {r.name} ·{" "}
            {m.members.filter((p) => p.role === r.id && p.approved).length}{" "}
            משתתפות
          </h3>
          {m.members
            .filter((p) => p.role === r.id)
            .map((p) => (
              <div className="roster-row" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <span className="small muted">
                    {!p.approved
                      ? "ממתינה לאישור"
                      : p.connected
                        ? "מחוברת"
                        : "מנותקת"}
                    {p.manual ? " · נוספה ידנית" : ""}
                    {m.representatives[r.id] === p.id ? " · נציגת הגשה" : ""}
                  </span>
                </div>
                <label>
                  פונקציה של {p.name}
                  <select
                    value={p.focus || "BOTH"}
                    disabled={busy}
                    onChange={(e) =>
                      send({
                        type: "memberFocus",
                        memberId: p.id,
                        focus: e.target.value,
                      })
                    }
                  >
                    {Object.entries(focusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  משלחת של {p.name}
                  <select
                    aria-label={"העברת " + p.name}
                    value={p.role}
                    disabled={busy}
                    onChange={(e) =>
                      send({
                        type: "moveMember",
                        memberId: p.id,
                        role: e.target.value,
                      })
                    }
                  >
                    {publicRoles.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!p.approved && (
                  <button
                    className="btn-small primary"
                    disabled={busy}
                    onClick={() => send({ type: "approve", memberId: p.id })}
                  >
                    אישור {p.name}
                  </button>
                )}
                {p.approved && !p.manual && (
                  <button
                    className="btn-small outline"
                    disabled={busy || m.representatives[r.id] === p.id}
                    onClick={() =>
                      send({
                        type: "representative",
                        memberId: p.id,
                        expectedMembershipRevision: m.revision || 0,
                      })
                    }
                  >
                    מינוי {p.name} לנציגה
                  </button>
                )}
                <button
                  className="btn-small outline"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("להסיר את " + p.name + " מהמפגש?"))
                      send({ type: "removeMember", memberId: p.id });
                  }}
                >
                  הסרת {p.name}
                </button>
              </div>
            ))}
        </section>
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const data = new FormData(f);
          if (
            await send({
              type: "addMember",
              name: data.get("name"),
              role: data.get("role"),
            })
          )
            f.reset();
        }}
      >
        <h3>הוספה ידנית לרשימה</h3>
        <p className="small muted">
          לתיעוד משתתפת ללא מכשיר. לכניסה ממכשיר יש להשתמש בקישור ההצטרפות.
        </p>
        <label>
          שם או כינוי להוספה
          <input name="name" required maxLength={60} />
        </label>
        <label>
          משלחת להוספה
          <select name="role">
            {publicRoles.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy} className="btn outline">
          הוספת משתתפת
        </button>
      </form>
    </details>
  );
}
export function TeamSpace({
  membership: m,
  actor,
  busy,
  send,
  phase,
  proposals,
}: Props & Pick<Game, "phase" | "proposals">) {
  const [text, setText] = useState("");
  const rep = m.members.find((p) => p.id === m.representatives[actor.role!]);
  const official = proposals.find(
    (p) => p.team === actor.role && p.phase === phase,
  );
  const me = m.members.find((p) => p.id === actor.memberId);
  return (
    <section className="panel team-space" aria-label="מרחב המשלחת">
      <div className="section-heading">
        <h2>
          {nameOf(actor.role!)} · {m.members.length} משתתפות
        </h2>
        <span className="pill">{me?.name}</span>
      </div>
      <p className="team-mission">
        <strong>המשימה עכשיו: </strong>
        {scenes.find((s) => s.id === phase)?.task}
      </p>
      <p className="official-status">
        <strong>ההצעה הרשמית: </strong>
        {official
          ? "הוגשה לסבב הנוכחי"
          : phase.startsWith("CRISIS") && phase !== "CRISIS3"
            ? "טרם הוגשה לסבב הנוכחי"
            : "אין הגשת הצעה בסבב זה"}
      </p>
      {official && <p>{official.action}</p>}
      <p className="small">
        נציגת ההגשה: <strong>{rep?.name || "טרם נבחרה"}</strong>.{" "}
        {rep?.id === actor.memberId
          ? "את נציגת ההגשה. טופס ההגשה מופיע בהמשך."
          : "אפשר להציע כאן רעיונות; הנציגה מגישה בשם המשלחת."}
      </p>
      <form
        className="idea-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send({ type: "idea", text })) setText("");
        }}
      >
        <label>
          הרעיון שלי למשלחת
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            required
            placeholder="מה כדאי להציע, לבדוק או לשנות?"
          />
        </label>
        <button className="btn primary" disabled={busy || phase === "COMPLETE"}>
          שיתוף רעיון במשלחת
        </button>
      </form>
      <details>
        <summary>
          רעיונות המשלחת · {m.ideas.filter((i) => i.phase === phase).length}
        </summary>
        {m.ideas
          .filter((i) => i.phase === phase)
          .slice()
          .reverse()
          .map((i) => (
            <article className="team-idea" key={i.id}>
              <strong>{i.name}</strong>
              <p>{i.text}</p>
            </article>
          ))}
      </details>
      <details>
        <summary>חברות המשלחת ובחירת נציגה</summary>
        <p>
          חלקו ביניכן משא ומתן ובדיקת מדיניות. אפשר שכמה משתתפות ימלאו כל
          פונקציה; משתתפת יחידה ממלאת את שתיהן.
        </p>
        <label>
          הפונקציה שלי
          <select
            value={me?.focus || "BOTH"}
            disabled={busy}
            onChange={(e) =>
              send({ type: "memberFocus", focus: e.target.value })
            }
          >
            {Object.entries(focusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {m.members.map((p) => (
          <div className="roster-row" key={p.id}>
            <span>
              {p.name} · {focusLabels[p.focus || "BOTH"]} ·{" "}
              {p.connected ? "מחוברת" : "מנותקת"}
            </span>
            {m.settings.representativeChoice && !p.manual && (
              <button
                className="btn-small outline"
                disabled={busy || rep?.id === p.id}
                onClick={() =>
                  send({
                    type: "representative",
                    memberId: p.id,
                    expectedMembershipRevision: m.revision || 0,
                  })
                }
              >
                בחירת {p.name} לנציגה
              </button>
            )}
          </div>
        ))}
      </details>
      {m.settings.switchOpen && (
        <details>
          <summary>מעבר למשלחת אחרת</summary>
          <p className="small muted">
            לאחר המעבר לא תהיה גישה למידע החסוי של המשלחת הנוכחית.
          </p>
          <div className="delegation-cards">
            {publicRoles
              .filter((r) => r.id !== actor.role)
              .map((r) => (
                <button
                  className="btn outline"
                  disabled={busy}
                  key={r.id}
                  onClick={() => send({ type: "switchTeam", role: r.id })}
                >
                  {r.name}
                </button>
              ))}
          </div>
        </details>
      )}
    </section>
  );
}
