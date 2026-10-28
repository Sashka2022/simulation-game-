"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpLeft,
  ArrowLeft,
  Clock3,
  Users,
  Layers3,
  Play,
  ShieldCheck,
  ChevronDown,
  DoorOpen,
  Landmark,
  Building2,
  GraduationCap,
  Scale,
  HeartHandshake,
  LoaderCircle,
} from "lucide-react";
import { publicRoles, schools } from "../lib/content";
import { responseJson } from "../lib/client-response";
import { useDialogFocus } from "../lib/use-dialog-focus";
export default function Landing() {
  const [mode, setMode] = useState<"host" | "join" | "recover" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [liveAvailable, setLiveAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        if (active) setLiveAvailable(s.liveAvailable === true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const rememberFocus = useDialogFocus(mode !== null);
  function openMode(next: "host" | "join" | "recover") {
    rememberFocus();
    setMode(next);
  }
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("join");
    if (code) {
      setJoinCode(code);
      openMode("join");
    }
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode === "host" ? "create" : mode,
          name: f.get("name"),
          code: f.get("code"),
          role: f.get("role"),
          key: f.get("key"),
        }),
      });
      const b = await responseJson(res);
      if (!res.ok) throw Error(b.error);
      if (b.projector) sessionStorage.setItem("projector_" + b.id, b.projector);
      if (b.recovery) sessionStorage.setItem("recovery_" + b.id, b.recovery);
      location.assign("/room/" + b.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <header className="site-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          <span>
            חדר המצב<span className="brand-caption">סימולציה חינוכית</span>
          </span>
        </a>
        <nav aria-label="ניווט ראשי">
          <a href="#about">על המשחק</a>
          <a href="#roles">המשלחות</a>
          <button
            className="btn-small outline"
            onClick={() => openMode("join")}
          >
            כניסה למפגש <ArrowUpLeft size={16} />
          </button>
        </nav>
      </header>
      <main id="main">
        {liveAvailable === false && (
          <div className="live-status-notice" role="status">
            המשחק החי אינו זמין כרגע.{" "}
            <a href="/room/demo">אפשר להתנסות במצב הדגמה</a>.
          </div>
        )}
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-line" /> החלטות גדולות מתחילות בשיחה
            </div>
            <h1>
              הבטחה אחת.
              <br />
              חמש נקודות מבט.
              <br />
              <span>רפורמה תחת לחץ.</span>
            </h1>
            <p className="hero-description">
              להקטין את הכיתות נשמע פשוט.
              <br />
              עד שצריך להסכים מי מחליטה, מי מתקצבת
              <br className="desktop-break" /> ומי גורמת לזה לקרות.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={() => openMode("host")}>
                פתיחת חדר מצב <ArrowLeft size={19} />
              </button>
              <a className="btn text-btn" href="/room/demo">
                <Play size={17} /> להתנסות במשחק
              </a>
            </div>
            <div className="hero-facts">
              <span>
                <Clock3 size={17} />
                60 דקות
              </span>
              <i />
              <span>
                <Users size={17} />
                10 משתתפות
              </span>
              <i />
              <span>
                <Layers3 size={17} />5 משלחות
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="הדמיה של חדר מצב: שני בתי ספר והחלטה משותפת"
          >
            <div className="visual-grid" />
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="visual-kicker">
              <span className="live-dot" /> תמונת מצב{" "}
              <span>היעד: עד 25 בכיתה</span>
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <Landmark size={20} />
              </span>
              <div>
                <small>הבטחת הממשלה</small>
                <strong>כיתה קטנה. הזדמנות גדולה.</strong>
              </div>
              <span className="note-year">2029</span>
            </div>
            <div className="visual-schools">
              {schools.map((s, i) => (
                <div className={"mini-school mini-" + i} key={s.id}>
                  <div className="mini-school-top">
                    <span className="school-icon">
                      {i ? (
                        <GraduationCap size={25} />
                      ) : (
                        <Building2 size={25} />
                      )}
                    </span>
                    <span className="mini-tag">{s.tag}</span>
                  </div>
                  <h2>{s.name}</h2>
                  <div className="big-number">
                    {s.classSize}
                    <span>תלמידים בכיתה</span>
                  </div>
                  <div className="desk-pattern">
                    {Array.from({ length: 15 }, (_, j) => (
                      <span key={j} />
                    ))}
                  </div>
                  <div className="school-barrier">
                    <span className="amber-dot" />
                    {s.barrier}
                  </div>
                </div>
              ))}
            </div>
            <div className="decision-note">
              <span className="decision-symbol">
                <HeartHandshake size={24} />
              </span>
              <div>
                <strong>ההחלטה שלכן משנה את התמונה</strong>
                <span>כל פתרון פותח אפשרות. וגם שאלה חדשה.</span>
              </div>
              <ArrowUpLeft size={21} />
            </div>
            <span className="visual-footnote">
              תרחיש בדיוני · סוגיות אמיתיות
            </span>
          </div>
        </section>
        <section className="intro-strip" id="about">
          <div className="section-label">לא עוד דיון תיאורטי</div>
          <h2>
            להיכנס לתפקיד.
            <br />
            <span>לראות את המערכת אחרת.</span>
          </h2>
          <p>
            אתן חלק מממשלה שמבטיחה כיתות קטנות יותר. בין תקציבים, מחסור במורות
            ולחץ ציבורי, תגלו למה כוונה טובה היא רק ההתחלה.
          </p>
          <a href="#journey" className="round-link" aria-label="לשלבי המשחק">
            <ChevronDown size={22} />
          </a>
        </section>
        <section className="journey-section" id="journey">
          <div className="section-heading">
            <div>
              <div className="eyebrow">איך זה עובד</div>
              <h2>שעה אחת. הרבה מעבר למשחק.</h2>
            </div>
            <span className="subtle">
              בלי ידע מוקדם. עם מקום לכל נקודת מבט.
            </span>
          </div>
          <div className="journey-grid">
            {[
              {
                n: "01",
                icon: Users,
                title: "נכנסות לנעליים אחרות",
                text: "כל זוג מייצג גוף במערכת החינוך, עם מטרות, מידע ושיקולים משלו.",
              },
              {
                n: "02",
                icon: Scale,
                title: "מחליטות תחת לחץ",
                text: "ארבעה משברים, משא ומתן והחלטות שאין להן פתרון מושלם.",
              },
              {
                n: "03",
                icon: ArrowUpLeft,
                title: "לוקחות מבט חדש לשטח",
                text: "פוגשות את השלכות ההחלטות וחוזרות לבית הספר עם שאלות טובות יותר.",
              },
            ].map((x) => (
              <article className="journey-card" key={x.n}>
                <div className="journey-top">
                  <x.icon size={24} />
                  <span>{x.n}</span>
                </div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="roles-section" id="roles">
          <div className="section-heading">
            <div>
              <div className="eyebrow">מי סביב השולחן?</div>
              <h2>חמש משלחות. מערכת אחת.</h2>
            </div>
            <button className="text-btn btn" onClick={() => openMode("host")}>
              יש מקום גם למבט שלכן <ArrowLeft size={18} />
            </button>
          </div>
          <div className="role-grid">
            {publicRoles.map((r, i) => {
              const Icon = [
                GraduationCap,
                Landmark,
                HeartHandshake,
                Building2,
                DoorOpen,
              ][i];
              return (
                <div className="role-tile" key={r.id}>
                  <span className={"role-icon role-color-" + i}>
                    <Icon size={25} />
                  </span>
                  <h3>{r.name}</h3>
                  <p>{r.goals[0]}</p>
                </div>
              );
            })}
          </div>
        </section>
        <section className="closing-banner">
          <div>
            <h2>
              אפשר להבין מערכת.
              <br />
              אפשר גם להרגיש איך היא פועלת.
            </h2>
            <p>מוכנות לפתוח את חדר המצב?</p>
          </div>
          <button className="btn light" onClick={() => openMode("host")}>
            בואו נתחיל <ArrowLeft size={18} />
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Layers3 size={19} />
          חדר המצב
        </span>
        <span>מרחב ללמידה, לשיחה ולקבלת החלטות.</span>
        <span>
          <ShieldCheck size={16} />
          בלי התקנה · בלי חשבונות למשתתפות
        </span>
      </footer>
      {mode && (
        <div
          className="dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMode(null);
          }}
        >
          <dialog
            open
            aria-modal="true"
            className="entry-dialog"
            aria-labelledby="dialog-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setMode(null);
              if (e.key === "Tab") {
                const els = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button, input, select, a[href]",
                );
                const first = els[0],
                  last = els[els.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              className="close-button"
              onClick={() => setMode(null)}
              aria-label="סגירה"
            >
              ×
            </button>
            <div className="eyebrow">מתחילות כאן</div>
            <h2 id="dialog-title">
              {mode === "host"
                ? "פותחות חדר מצב"
                : mode === "join"
                  ? "מצטרפות לשולחן"
                  : "שחזור גישת מנחה"}
            </h2>
            <p className="muted">
              {mode === "host"
                ? "מפגש אחד, חמש משלחות ומקום לשיחה אמיתית."
                : "הזינו את הפרטים שקיבלתן מהמנחה."}
            </p>
            <form onSubmit={submit}>
              {mode === "host" ? (
                <label>
                  שם המפגש
                  <input
                    autoFocus
                    name="name"
                    placeholder="למשל: צוות בית הספר — מפגש למידה"
                    maxLength={80}
                  />
                </label>
              ) : (
                <label>
                  קוד המפגש
                  <input
                    autoFocus
                    name="code"
                    defaultValue={joinCode}
                    dir="ltr"
                    required
                    maxLength={6}
                    placeholder="A1B2C3"
                    autoComplete="off"
                  />
                </label>
              )}
              {mode === "join" && (
                <label>
                  המשלחת שלנו
                  <select name="role">
                    {publicRoles.map((r) => (
                      <option value={r.id} key={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "recover" && (
                <label>
                  קוד שחזור פרטי
                  <input
                    name="key"
                    type="password"
                    required
                    autoComplete="off"
                  />
                </label>
              )}
              {error && (
                <p role="alert" className="error-message">
                  {error}
                </p>
              )}
              <button className="btn primary full-width" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <ArrowLeft size={18} />
                )}{" "}
                {busy
                  ? "רגע, מכינות הכול…"
                  : mode === "host"
                    ? "יצירת מפגש"
                    : "המשך"}
              </button>
            </form>
            <p className="dialog-footnote">
              {mode === "host"
                ? "אין צורך בחשבונות אישיים למשתתפות."
                : "המידע החסוי ייחשף רק אחרי אישור המנחה."}
            </p>
            <button
              className="link-button"
              onClick={() => {
                setMode(mode === "recover" ? "host" : "recover");
                setError("");
              }}
            >
              {" "}
              {mode === "recover"
                ? "חזרה לפתיחת מפגש"
                : "כבר פתחת מפגש? שחזור גישת מנחה"}
            </button>
          </dialog>
        </div>
      )}
    </>
  );
}
