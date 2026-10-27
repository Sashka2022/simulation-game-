"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  GraduationCap,
  HelpCircle,
  Layers3,
  LockKeyhole,
  MessageCircle,
  Monitor,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  publicRoles,
  scenes,
  beats,
  schools,
  statuses,
  authorityTopics,
  explanations,
  research,
  type Role,
} from "../../../lib/content";
import {
  applyCommand,
  createGame,
  elapsed,
  selectOutcome,
  type Game,
  type Actor,
  type Action,
  type Clause,
} from "../../../lib/engine";
import QRCode from "qrcode";
import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { kindLabels } from "../../../lib/provenance";
type Snapshot = Game & {
  actor: Actor;
  serverNow: number;
  code?: string;
  requests?: { id: string; role: Role }[];
  privateCard?: string;
  privateCards?: Record<string, string>;
  draft?: Record<string, unknown>;
  teams: { role: Role; joined: boolean; connected: boolean }[];
};
type Tab = "event" | "role" | "ledger" | "help" | "report";
const uid = () => crypto.randomUUID();
const roleName = (r: string) => publicRoles.find((x) => x.id === r)?.name || r;
function format(ms: number) {
  const secs = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}
function Fiction() {
  return (
    <span className="fiction-label">
      <span />
      {kindLabels.FICTIONAL_SCENARIO}
    </span>
  );
}
export default function Room({ id }: { id: string }) {
  const demo = id === "demo";
  const [snap, setSnap] = useState<Snapshot | null>(null),
    [demoActor, setDemoActor] = useState<Actor>({ kind: "host" }),
    [tab, setTab] = useState<Tab>("event"),
    [connected, setConnected] = useState(true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [qr, setQr] = useState(""),
    [showSecret, setShowSecret] = useState(false),
    [confirm, setConfirm] = useState<"advance" | "delete" | null>(null);
  const rememberFocus = useDialogFocus(confirm !== null);
  function openConfirm(next: "advance" | "delete") {
    rememberFocus();
    setConfirm(next);
  }
  const ref = useRef<Snapshot | null>(null);
  const clockOffset = useRef(0);
  const projector = useRef("");
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoaded = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const update = useCallback((s: Snapshot) => {
    if (ref.current && s.revision < ref.current.revision) return;
    ref.current = s;
    clockOffset.current = s.serverNow - Date.now();
    setSnap(s);
  }, []);
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const r = await fetch("/api/room/" + id, {
        cache: "no-store",
        headers: projector.current
          ? { "x-projector-token": projector.current }
          : {},
      });
      const b = await r.json();
      if (r.status === 202) {
        setPending(true);
        return;
      }
      if (!r.ok) throw Error(b.error);
      setPending(false);
      setError("");
      setConnected(true);
      update(b);
    } catch (e) {
      setConnected(false);
      if (!ref.current) setError((e as Error).message);
    }
  }, [id, demo, update]);
  useEffect(() => {
    if (demo) {
      const read = () => {
        let g = createGame("demo", "התנסות בחדר המצב");
        try {
          const stored = localStorage.getItem("hadar-demo-v1");
          if (stored) g = JSON.parse(stored);
        } catch {}
        update({
          ...g,
          actor: demoActor,
          serverNow: Date.now(),
          code: "הדגמה",
          privateCard: demoActor.role
            ? "מידע לדוגמה: הבטחה אינה מבטיחה ביצוע. בחנו מה חסר למשלחת שלכן."
            : undefined,
          teams: publicRoles.map((r) => ({
            role: r.id,
            joined: true,
            connected: true,
          })),
        });
      };
      read();
      channel.current = new BroadcastChannel("hadar-demo");
      channel.current.onmessage = read;
      return () => channel.current?.close();
    }
    projector.current =
      new URLSearchParams(location.hash.slice(1)).get("projector") || "";
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [demo, demoActor, refresh, update]);
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (snap?.code && snap.actor.kind === "host" && !demo)
      QRCode.toDataURL(location.origin + "/?join=" + snap.code, {
        margin: 1,
        width: 160,
        color: { dark: "#183044", light: "#ffffff" },
      })
        .then(setQr)
        .catch(() => {});
  }, [snap?.code, snap?.actor.kind, demo]);
  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>("#proposal-form");
    if (!form || draftLoaded.current) return;
    let draft: Record<string, string> | null = null;
    try {
      const local = localStorage.getItem(
        "draft_" + id + "_" + snap?.actor.role + "_" + snap?.phase,
      );
      draft = local
        ? JSON.parse(local)
        : snap?.draft && snap.draft.phase === snap.phase
          ? (snap.draft as Record<string, string>)
          : null;
    } catch {}
    if (draft)
      for (const [k, v] of Object.entries(draft)) {
        const el = form.elements.namedItem(k) as HTMLInputElement | null;
        if (el && typeof v === "string") el.value = v;
      }
    draftLoaded.current = true;
  }, [snap, id, tab]);
  useEffect(() => {
    draftLoaded.current = false;
    setShowSecret(false);
  }, [snap?.phase, tab]);
  async function send(action: Action): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const current = ref.current;
      if (!current) throw Error("המצב עדיין נטען");
      if (demo) {
        const g = applyCommand(
          current,
          action,
          demoActor,
          uid(),
          current.revision,
        );
        localStorage.setItem("hadar-demo-v1", JSON.stringify(g));
        update({ ...current, ...g });
        channel.current?.postMessage("changed");
      } else {
        const res = await fetch("/api/room/" + id, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            commandId: uid(),
            revision: current.revision,
          }),
        });
        const b = await res.json();
        if (!res.ok) throw Error(b.error);
        if (action.type === "delete") {
          location.assign("/");
          return true;
        }
        await refresh();
      }
      setToast("ההחלטה נשמרה");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function draft(e: React.FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const s = ref.current;
    if (!s) return;
    try {
      localStorage.setItem(
        "draft_" + id + "_" + s.actor.role + "_" + s.phase,
        JSON.stringify(values),
      );
    } catch {}
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (!demo && s.actor.kind === "team")
      draftTimer.current = setTimeout(() => {
        fetch("/api/room/" + id, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: { type: "draft", draft: { ...values, phase: s.phase } },
            commandId: uid(),
            revision: s.revision,
          }),
        }).catch(() => {});
      }, 700);
  }
  if (!snap)
    return (
      <div className="loading-page">
        <Layers3 size={36} />
        <h1>
          {pending ? "המנחה מאשרת את ההצטרפות שלכן" : "מכינות את חדר המצב"}
        </h1>
        <p>
          {pending
            ? "אפשר להשאיר את המסך פתוח. המידע יופיע אוטומטית לאחר האישור."
            : error || "רק רגע, אוספות את התמונה המלאה…"}
        </p>
        {error && (
          <button className="btn primary" onClick={refresh}>
            ניסיון חוזר
          </button>
        )}
        <a href="/">חזרה לכניסה</a>
      </div>
    );
  const actor = demo ? demoActor : snap.actor,
    host = actor.kind === "host",
    team = actor.kind === "team",
    projecting = actor.kind === "projector";
  const scene = scenes.find((s) => s.id === snap.phase)!;
  const phaseIndex = scenes.indexOf(scene);
  const active = elapsed(snap, tick + clockOffset.current);
  const phaseMinutes = Math.max(
    0,
    (active - (snap.phaseStartedMs || 0)) / 60000,
  );
  const beat = (beats[snap.phase] || [])
    .filter((b) => b.at <= phaseMinutes)
    .at(-1);
  const phaseEnd = (scene.start + scene.minutes) * 60000;
  const remaining = phaseEnd - active;
  const role = publicRoles.find((r) => r.id === actor.role);
  const outcome = snap.outcome || selectOutcome(snap);
  const sceneBody = (
    <>
      <div className="scene-kicker">
        <span className="pill">{scene.label}</span>
        <Fiction />
      </div>
      <h1 className="scene-title">{scene.title}</h1>
      <p className="scene-subtitle">{scene.subtitle}</p>
      <div className="announcement">
        <span className="announcement-icon">
          <Radio size={22} />
        </span>
        <div>
          <span className="overline">עדכון מחדר המצב</span>
          <p>{scene.message}</p>
        </div>
      </div>
    </>
  );
  const schoolCards = (
    <div className="school-cards">
      {schools.map((s, i) => (
        <article className={"school-card school-card-" + i} key={s.id}>
          <div className="school-card-heading">
            <span className="school-icon">
              {i ? <GraduationCap size={24} /> : <Building2 size={24} />}
            </span>
            <span className="muted small">{s.tag}</span>
          </div>
          <h3>{s.name}</h3>
          <p>{s.description}</p>
          <div className="school-numbers">
            <strong>
              {s.classSize}
              <small>בכיתה כיום</small>
            </strong>
            <span>←</span>
            <strong className="target-number">
              25<small>היעד המשותף</small>
            </strong>
          </div>
          <div className="school-barrier">
            <span className="amber-dot" />
            {s.barrier}
          </div>
        </article>
      ))}
    </div>
  );
  const report = (
    <section className="report">
      <div className="section-heading">
        <div>
          <span className="eyebrow">מה לוקחות מהמפגש</span>
          <h1>סיכום חדר המצב</h1>
          <p>{snap.name}</p>
        </div>
        <button className="btn outline no-print" onClick={() => window.print()}>
          <Download size={18} />
          הדפסה / PDF
        </button>
      </div>
      <Fiction />
      {snap.phase !== "COMPLETE" && (
        <p className="warning-banner">
          דוח חלקי · המפגש נמצא בשלב {scene.label}
        </p>
      )}
      <h2>ההסכם שלנו</h2>
      {snap.clauses.map((c) => (
        <article className="report-clause" key={c.id}>
          <h3>
            {c.category}{" "}
            <span className={"status status-" + c.status}>
              {statuses[c.status]}
            </span>
          </h3>
          <p>{c.action || "טרם נוסחה התחייבות"}</p>
          <dl>
            <dt>אחריות</dt>
            <dd>{c.owner || "לא נקבעה"}</dd>
            <dt>שותפים ומשאבים</dt>
            <dd>
              {c.requiredPartners || "חסר"} · {c.resources || "חסר"}
            </dd>
            <dt>הצעד הבא ומועד</dt>
            <dd>
              {c.nextStep || "לא נקבע"} · {c.deadline || "לא נקבע"}
            </dd>
            <dt>השפעה על בתי הספר</dt>
            <dd>{c.schoolEffects || "טרם הוגדרה"}</dd>
          </dl>
        </article>
      ))}
      <h2>תוצאה אפשרית בסימולציה</h2>
      {snap.outcome ? (
        <>
          <h3>{snap.outcome.title}</h3>
          <p>{snap.outcome.reason}</p>
        </>
      ) : (
        <p>מסלול העתיד טרם נחשף.</p>
      )}
      {snap.finalRevision && (
        <>
          <h2>התיקון האחרון</h2>
          <p>לפני: {snap.finalRevision.before}</p>
          <p>אחרי: {snap.finalRevision.after}</p>
          <p>מה למדנו: {snap.finalRevision.reason}</p>
        </>
      )}
      <h2>החלטות ושאלות פתוחות</h2>
      {snap.logs.map((l) => (
        <p key={l.seq} className="report-log">
          {l.seq}. {l.text}
        </p>
      ))}
      <h2>היסטוריית סעיפים</h2>
      {snap.history.map((c, i) => (
        <p key={i}>
          {c.category} · גרסה {c.version}: {c.action || "טרם נוסח"} —{" "}
          {statuses[c.status]}
        </p>
      ))}
      <h2>מקורות והסתייגויות</h2>
      <p>
        המיפוי המוסדי והסיכומים המחקריים ממתינים לאימות מקצועי. אין לראות במידע
        ייעוץ משפטי או תחזית.
      </p>
      {research.map((r) => (
        <p key={r.title}>
          <a href={r.url}>
            {r.title} · {r.publisher}
          </a>{" "}
          — {r.status}
        </p>
      ))}
      <h2>מבט לעבודה בבית הספר</h2>
      {snap.reflections.map((r) => (
        <article key={r.team}>
          <h3>{roleName(r.team)}</h3>
          {r.answers.map((a, i) => (
            <p key={i}>
              {["מי מעורב?", "איזה מידע חסר?", "מי יכולה לקדם פתרון?"][i]} {a}
            </p>
          ))}
        </article>
      ))}
    </section>
  );
  if (projecting)
    return (
      <main id="main" className="projector">
        <div className="projector-top">
          <a className="brand" href="/">
            <Layers3 />
            חדר המצב
          </a>
          <span>{scene.label}</span>
          <span className="timer">{format(active)}</span>
          <button
            className="icon-btn no-print"
            aria-label="מסך מלא"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            <Monitor />
          </button>
        </div>
        {!connected && (
          <p role="status">החיבור נותק — מוצגת התמונה האחרונה שנשמרה</p>
        )}
        <div className="projector-scene">
          {scene.options && snap.revealedOptions?.includes(snap.phase) ? (
            <>
              <div className="scene-kicker">
                <span className="pill">{scene.label}</span>
                <Fiction />
              </div>
              <h1 className="scene-title">{scene.title}</h1>
              <div className="projector-options">
                {scene.options.map((o) => (
                  <article key={o.id}>
                    <span className="option-letter">{o.id}</span>
                    <h2>{o.title}</h2>
                    <p>{o.description}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            sceneBody
          )}
        </div>
        {snap.phase === "FUTURE" ? (
          <>
            <h2>{outcome.title}</h2>
            <p>{outcome.reason}</p>
          </>
        ) : snap.revealedOptions?.includes(snap.phase) ? (
          <div className="projector-school-summary">
            {schools.map((s) => (
              <p key={s.id}>
                <strong>{s.name}</strong> · {s.classSize} בכיתה · {s.barrier}
              </p>
            ))}
          </div>
        ) : (
          <div className="projector-schools">{schoolCards}</div>
        )}
        <div className="projector-bottom">
          {snap.phase === "AGREEMENT" || snap.phase === "COMPLETE" ? (
            snap.clauses.map((c) => (
              <p key={c.id}>
                {c.category}: {c.action || "טרם נוסח"} · {statuses[c.status]}
              </p>
            ))
          ) : (
            <p>{beat?.instruction || scene.task}</p>
          )}
        </div>
        <Progress index={phaseIndex} />
      </main>
    );
  return (
    <div className="workspace">
      <header className="workspace-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={21} />
          </span>
          <span>
            חדר המצב<span className="brand-caption">רפורמה תחת לחץ</span>
          </span>
        </a>
        <div className="workspace-title">
          {snap.name}
          <span className="small muted">{host ? "ממשק מנחה" : role?.name}</span>
        </div>
        <div className="connection">
          <span className={connected ? "live-dot" : "offline-dot"} />
          {connected ? "מחוברות" : "החיבור נותק"}
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
        </div>
        <a href="/" className="icon-btn" aria-label="חזרה לדף הבית">
          <X size={20} />
        </a>
      </header>
      {demo && (
        <div className="demo-bar" role="region" aria-label="בקרת הדגמה">
          <span>
            <Play size={14} /> מצב הדגמה · נשמר בדפדפן בלבד
          </span>
          <label>
            נקודת מבט
            <select
              aria-label="נקודת מבט בהדגמה"
              value={
                demoActor.kind === "team" ? demoActor.role : demoActor.kind
              }
              onChange={(e) => {
                const v = e.target.value;
                setDemoActor(
                  v === "host" || v === "projector"
                    ? { kind: v }
                    : { kind: "team", role: v as Role },
                );
                setTab("event");
              }}
            >
              <option value="host">מנחה</option>
              {publicRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="projector">מסך הקרנה</option>
            </select>
          </label>
          <button
            className="link-button"
            onClick={() => {
              if (window.confirm("לאפס את ההדגמה?")) {
                localStorage.removeItem("hadar-demo-v1");
                location.reload();
              }
            }}
          >
            <RotateCcw size={14} />
            איפוס
          </button>
        </div>
      )}
      <div className="workspace-layout">
        <aside className="sidebar no-print" aria-label="שלבים וניווט">
          <div className="sidebar-caption">
            {host ? "ניהול המפגש" : "המרחב שלכן"}
          </div>
          <nav aria-label="ניווט מפגש">
            {(
              [
                {
                  id: "event",
                  icon: Radio,
                  label: host ? "חדר המצב" : "האירוע הנוכחי",
                },
                {
                  id: "role",
                  icon: Users,
                  label: host ? "משלחות ותפקידים" : "התפקיד שלנו",
                },
                { id: "ledger", icon: FileText, label: "התחייבויות" },
                { id: "help", icon: BookOpen, label: "עזרה ומקורות" },
                { id: "report", icon: Download, label: "סיכום המפגש" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "nav-item active" : "nav-item"}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
              >
                <t.icon size={19} />
                {t.label}
                {t.id === "ledger" && (
                  <span className="count">
                    {snap.clauses.filter((c) => c.action).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="timeline">
            <div className="sidebar-caption">הדרך שלנו · 60 דקות</div>
            {scenes.slice(1, -1).map((s, i) => (
              <div
                key={s.id}
                className={
                  "timeline-step " +
                  (phaseIndex === i + 1
                    ? "current"
                    : phaseIndex > i + 1
                      ? "done"
                      : "")
                }
              >
                <span>
                  {phaseIndex > i + 1 ? (
                    <Check size={12} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  {s.label}
                  <small>
                    {String(s.start).padStart(2, "0")}–
                    {String(s.start + s.minutes).padStart(2, "0")} דקות
                  </small>
                </div>
              </div>
            ))}
          </div>
          <div className="sidebar-bottom">
            <ShieldCheck size={18} />
            <p>
              אין פתרון מושלם.
              <br />
              יש החלטה שאפשר להסביר.
            </p>
          </div>
        </aside>
        <main id="main" className="workspace-main">
          <p className="sr-only" aria-live="polite">
            השלב הנוכחי: {scene.label}
          </p>
          <div className="workspace-breadcrumb no-print">
            המפגש שלנו <ChevronLeft size={14} />
            <span>
              {tab === "event"
                ? scene.label
                : tab === "role"
                  ? "תפקידים"
                  : tab === "ledger"
                    ? "התחייבויות"
                    : tab === "help"
                      ? "עזרה ומקורות"
                      : "סיכום"}
            </span>
          </div>
          {!connected && (
            <div role="status" className="warning-banner">
              <WifiOff size={18} />
              החיבור נותק. הטיוטה במכשיר נשמרת; החלטות לא ייחשבו מוגשות עד אישור
              השרת.
            </div>
          )}
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button
                aria-label="סגירת הודעה"
                className="icon-btn"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {tab === "event" && (
            <>
              <div className="event-heading">
                <div>{sceneBody}</div>
                <div className="clock-card">
                  <Clock3 size={20} />
                  <strong dir="ltr">{format(active)}</strong>
                  <span>מתוך 60 דקות</span>
                  <span className="clock-state">
                    {snap.running
                      ? "המפגש בתנועה"
                      : snap.phase === "LOBBY"
                        ? "מתחילות בקרוב"
                        : "השעון מושהה"}
                  </span>
                </div>
              </div>
              {host && (
                <div className="host-controls no-print">
                  <div>
                    <button
                      className="btn primary"
                      disabled={busy || snap.phase === "COMPLETE"}
                      onClick={() =>
                        snap.phase === "LOBBY"
                          ? send({ type: "start" })
                          : openConfirm("advance")
                      }
                    >
                      {snap.phase === "LOBBY" ? (
                        <Play size={17} />
                      ) : (
                        <ArrowLeft size={17} />
                      )}{" "}
                      {snap.phase === "LOBBY" ? "מתחילות את המשחק" : "לשלב הבא"}
                    </button>
                    {snap.phase !== "LOBBY" && snap.phase !== "COMPLETE" && (
                      <button
                        className="btn outline"
                        disabled={busy}
                        onClick={() =>
                          send({ type: snap.running ? "pause" : "resume" })
                        }
                      >
                        {snap.running ? (
                          <Pause size={17} />
                        ) : (
                          <Play size={17} />
                        )}{" "}
                        {snap.running ? "השהיה" : "המשך השעון"}
                      </button>
                    )}
                  </div>
                  <button
                    className="text-btn btn"
                    disabled={busy || snap.interventions.includes(snap.phase)}
                    onClick={() => send({ type: "intervention" })}
                  >
                    <MessageCircle size={17} />
                    שאלת עומק
                  </button>
                </div>
              )}
              {remaining <= 0 && scene.minutes > 0 && host && (
                <p className="warning-banner">
                  <Clock3 size={18} />
                  הזמן המתוכנן לשלב הסתיים. אפשר להמשיך לשוחח או לעבור הלאה; אין
                  מחיקה של תשובות.
                </p>
              )}
              {snap.interventions.includes(snap.phase) && (
                <div className="quote-card">
                  <MessageCircle size={21} />
                  <p>מה המחיר של ההצעה שלכן, ומי עדיין לא נשמעה?</p>
                </div>
              )}
              {snap.phase === "LOBBY" && (
                <>
                  <div className="section-heading">
                    <h2>מי סביב השולחן?</h2>
                    <span className="muted small">
                      {snap.teams.filter((t) => t.joined).length} מתוך 5 משלחות
                      הצטרפו
                    </span>
                  </div>
                  <div className="team-readiness">
                    {snap.teams.map((t) => (
                      <div className="readiness-card" key={t.role}>
                        <span className="role-avatar">
                          {publicRoles.find((r) => r.id === t.role)?.initial}
                        </span>
                        <strong>{roleName(t.role)}</strong>
                        <span
                          className={t.joined ? "ready-label" : "muted small"}
                        >
                          {t.joined ? (
                            <>
                              <CheckCircle2 size={14} /> מוכנות
                            </>
                          ) : (
                            "ממתינות להצטרפות"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {host && !demo && (
                    <div className="join-panel">
                      {qr && (
                        <img
                          src={qr}
                          width={140}
                          height={140}
                          alt="קוד QR להצטרפות למפגש"
                        />
                      )}
                      <div>
                        <h3>מזמינות את המשלחות</h3>
                        <p>
                          סרקו את הקוד או היכנסו לעמוד הבית ובחרו ״כניסה למפגש״.
                        </p>
                        <button
                          className="link-button"
                          onClick={() => send({ type: "rotate" })}
                        >
                          החלפת קוד כניסה
                        </button>
                        <br />
                        <span className="room-code" dir="ltr">
                          {snap.code}
                        </span>
                        <button
                          className="icon-btn"
                          aria-label="העתקת קוד"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(snap.code || "")
                              .then(() => setToast("הקוד הועתק"))
                              .catch(() =>
                                setError(
                                  "לא ניתן להעתיק. אפשר לסמן את הקוד ידנית.",
                                ),
                              )
                          }
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {["OPENING", "LOBBY"].includes(snap.phase) && (
                <>
                  <div className="section-heading">
                    <h2>שני בתי ספר. יעד משותף.</h2>
                    <Fiction />
                  </div>
                  {schoolCards}
                  <p className="small muted">
                    בכל בית ספר נדרשת כיתה שלישית לפחות. זהו חשבון תלמידים בלבד,
                    לא אומדן תקנים או עלויות.
                  </p>
                </>
              )}
              {!["LOBBY", "COMPLETE", "FUTURE"].includes(snap.phase) && (
                <div className="task-banner">
                  <Flag size={21} />
                  <div>
                    <strong>{beat?.title || "המשימה עכשיו"}</strong>
                    <p>{beat?.instruction || scene.task}</p>
                  </div>
                </div>
              )}
              {snap.phase === "CRISIS3" && (
                <>
                  <div className="letters-grid">
                    <div className="letter-card">
                      <span className="overline">מיכל · שבילים</span>
                      <h3>״יש תקציב לחונכות. אין מורות.״</h3>
                      <p>
                        התקציב ייעודי. האם אפשר לשנות את ייעודו, ומי מוסמך לאשר
                        זאת?
                      </p>
                    </div>
                    <div className="letter-card">
                      <span className="overline">יעל · אופקים</span>
                      <h3>״הבינוי אושר. החדר עדיין לא מוכן.״</h3>
                      <p>הכשרת החדרים, הבדיקות והאישורים עדיין לא הסתיימו.</p>
                    </div>
                  </div>
                  <div className="warning-banner">
                    <Users size={20} />
                    החליפו תפקידים בזוג: נציגת המשא ומתן ↔ יועצת המדיניות.
                  </div>
                  {team && (
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        send({
                          type: "authority",
                          rows: authorityTopics.map((_, i) =>
                            [0, 1, 2, 3].map((j) => f.get(`${i}-${j}`)),
                          ),
                        });
                      }}
                    >
                      <h2>מי יכולה להזיז את זה?</h2>
                      <p className="muted">
                        לא בטוחות? כתבו ״נדרש בירור״ ופתחו את העזרה.
                      </p>
                      {authorityTopics.map((topic, i) => (
                        <fieldset key={topic}>
                          <legend>{topic}</legend>
                          <div className="form-grid">
                            {[
                              "מי מוביל?",
                              "מי מאשר?",
                              "מי מבצע?",
                              "מה חסר?",
                            ].map((label, j) => (
                              <label key={j}>
                                {label}
                                <input
                                  name={`${i}-${j}`}
                                  required
                                  maxLength={300}
                                  defaultValue={
                                    snap.authorityMaps.find(
                                      (x) => x.team === actor.role,
                                    )?.rows[i][j]
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                      <button className="btn primary" disabled={busy}>
                        שמירת המיפוי
                      </button>
                    </form>
                  )}
                  <button
                    className="btn outline"
                    onClick={() => setTab("ledger")}
                  >
                    <FileText size={18} />
                    בדיקה ותיקון של התחייבות קודמת
                  </button>
                </>
              )}
              {snap.phase === "CRISIS4" && (
                <>
                  <Research />
                  <div className="letters-grid">
                    <div className="letter-card">
                      <span className="overline">
                        נועה · מורה בשבילים · דמות בדיונית
                      </span>
                      <h3>״אני צריכה זמן לחונכות, לא רק הבטחה.״</h3>
                      <p>
                        העומס נשאר גם כשהשכר משתנה. איך אתן מתכוונות לשנות את
                        יום העבודה?
                      </p>
                    </div>
                    <div className="letter-card">
                      <span className="overline">
                        דניאל · אב באופקים · דמות בדיונית
                      </span>
                      <h3>״הבת שלי לא יכולה לחכות עוד שלוש שנים.״</h3>
                      <p>
                        אם שוב דוחים את הפתיחה, מי מוודא שהיא לא תפספס את
                        ההזדמנות?
                      </p>
                    </div>
                  </div>
                  {team && (
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send({
                          type: "practice",
                          text: new FormData(e.currentTarget).get("practice"),
                        });
                      }}
                    >
                      <h3>מה ייראה אחרת בכיתה?</h3>
                      <label>
                        התייחסו לשני הקולות והגדירו פרקטיקה וסימן לשינוי
                        <textarea
                          name="practice"
                          required
                          maxLength={600}
                          placeholder="למשל: הוראה בקבוצה קטנה פעמיים בשבוע; נבדוק שהיא אכן מתקיימת."
                          defaultValue={
                            snap.practice.find((p) => p.team === actor.role)
                              ?.text
                          }
                        />
                      </label>
                      <button className="btn outline" disabled={busy}>
                        שמירת התשובה
                      </button>
                    </form>
                  )}
                </>
              )}
              {scene.options && (
                <>
                  <div className="section-heading">
                    <h2>שלושה כיוונים. מה הכיוון שלכן?</h2>
                    {host && (
                      <button
                        className="btn-small outline"
                        disabled={
                          busy || snap.revealedOptions?.includes(snap.phase)
                        }
                        onClick={() => send({ type: "revealOptions" })}
                      >
                        <Monitor size={16} />
                        {snap.revealedOptions?.includes(snap.phase)
                          ? "החלופות מוצגות במקרן"
                          : "חשיפת חלופות למקרן"}
                      </button>
                    )}
                    <span className="muted small">אפשר גם לשלב ולהתאים</span>
                  </div>
                  <div className="option-grid">
                    {scene.options.map((o) => (
                      <article className="option-card" key={o.id}>
                        <span className="option-letter">{o.id}</span>
                        <h3>{o.title}</h3>
                        <p>{o.description}</p>
                        <div className="option-price">
                          <span>המחיר שצריך לזכור</span>
                          {o.price}
                        </div>
                      </article>
                    ))}
                  </div>
                  {team && (
                    <form
                      key={snap.phase}
                      id="proposal-form"
                      className="panel proposal-form"
                      onChange={draft}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        if (await send({ type: "proposal", ...f }))
                          setToast("העמדה נשלחה ונשמרה במפגש");
                      }}
                    >
                      <div className="section-heading">
                        <h2>העמדה שלנו</h2>
                        <span className="small muted">הטיוטה נשמרת במכשיר</span>
                      </div>
                      <label>
                        הכיוון שנבחר
                        <select name="option">
                          {scene.options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.id} · {o.title}
                            </option>
                          ))}
                          <option value="MIX">שילוב / התאמה</option>
                        </select>
                      </label>
                      <div className="form-grid">
                        <label>
                          מה אתן מציעות?
                          <textarea name="action" required maxLength={600} />
                        </label>
                        <label>
                          מה המחיר ומי מושפעת?
                          <textarea name="price" required maxLength={600} />
                        </label>
                        <label>
                          מה התנאי להסכמה?
                          <input name="condition" required maxLength={600} />
                        </label>
                        <label>
                          מי אחראי?
                          <select name="owner">
                            {publicRoles.map((r) => (
                              <option key={r.id} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button
                        className="btn primary"
                        disabled={busy || !connected}
                      >
                        <Send size={17} />
                        שליחת העמדה
                      </button>
                    </form>
                  )}
                </>
              )}
              {snap.phase === "CRISIS2" && host && (
                <div className="panel">
                  <h2>שש יחידות סיוע</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      send({
                        type: "budget",
                        values: ["ofakim", "shvilim", "reserve"].map((k) =>
                          Number(f.get(k)),
                        ),
                      });
                    }}
                  >
                    <div className="budget-inputs">
                      {["אופקים", "שבילים", "עתודה"].map((label, i) => (
                        <label key={i}>
                          {label}
                          <input
                            type="number"
                            name={["ofakim", "shvilim", "reserve"][i]}
                            min="0"
                            max="6"
                            required
                            defaultValue={snap.budget[i]}
                          />
                        </label>
                      ))}
                    </div>
                    <button className="btn outline" disabled={busy}>
                      עדכון החלוקה
                    </button>
                  </form>
                  <h3>הצעת הנגד המשותפת</h3>
                  {snap.counter ? (
                    <div className="success-note">
                      <strong>{snap.counter.result}</strong>
                      <p>{snap.counter.change}</p>
                      <p>בתמורה: {snap.counter.promise}</p>
                      <p>מי תמתין: {snap.counter.wait}</p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = Object.fromEntries(
                          new FormData(e.currentTarget),
                        );
                        send({
                          type: "counter",
                          ...f,
                          pending: f.pending === "on",
                        });
                      }}
                    >
                      <div className="form-grid">
                        {[
                          ["change", "מה מבקשות לשנות?"],
                          ["promise", "מה מתחייבות בתמורה?"],
                          ["reason", "למה הפשרה אפשרית?"],
                          ["wait", "מי תיאלץ להמתין?"],
                        ].map(([name, label]) => (
                          <label key={name}>
                            {label}
                            <input name={name} required maxLength={600} />
                          </label>
                        ))}
                      </div>
                      <label className="checkbox-label">
                        <input type="checkbox" name="pending" defaultChecked />
                        נותרה תלות במימון או בסמכות
                      </label>
                      <p className="small muted">
                        יש להגיש פעם אחת בלבד, לאחר שהמשלחות גיבשו נוסח.
                      </p>
                      <button className="btn primary" disabled={busy}>
                        הגשת הצעת נגד משותפת
                      </button>
                    </form>
                  )}
                </div>
              )}
              {(snap.phase === "CRISIS2" || snap.phase === "CRISIS4") && (
                <div className="quote-card">
                  <MessageCircle size={24} />
                  <div>
                    <span className="overline">
                      {snap.phase === "CRISIS2" ? "יעל שואלת" : "מיכל שואלת"}
                    </span>
                    <h3>
                      {snap.phase === "CRISIS2"
                        ? "״למה הילדים שלי צריכים להמתין?״"
                        : "״השכר השתנה בפועל, או שרק הבטחתן לבחון אותו? מי דואגת למורות בספטמבר?״"}
                    </h3>
                    <p>נציגה עונה בעל פה, בקצרה ובאופן קונקרטי.</p>
                    {host && (
                      <button
                        className="btn outline"
                        disabled={
                          busy ||
                          snap.oral[
                            snap.phase === "CRISIS2" ? "yael" : "michal"
                          ]
                        }
                        onClick={() =>
                          send({
                            type: "oral",
                            person:
                              snap.phase === "CRISIS2" ? "yael" : "michal",
                          })
                        }
                      >
                        {snap.oral[snap.phase === "CRISIS2" ? "yael" : "michal"]
                          ? "המענה תועד"
                          : "תיעוד מענה בעל פה"}
                      </button>
                    )}
                  </div>
                </div>
              )}
              {snap.phase === "CRISIS1" && snap.proposals.length > 0 && (
                <div className="quote-card">
                  <MessageCircle size={22} />
                  <div>
                    <span className="overline">
                      תגובה להחלטה האחרונה · דמות בדיונית
                    </span>
                    <h3>
                      {
                        (
                          {
                            A: "מיכל: ״ומה יקרה לעומס שלא נפתר בכסף?״",
                            B: "יעל: ״מתי התלמידים שלנו ירגישו את השינוי?״",
                            C: "מיכל: ״איך תבטיחו שלא נהיה תמיד אחרונות?״",
                            MIX: "יעל ומיכל: ״מה כאן מובטח, ומה עדיין מותנה?״",
                          } as Record<string, string>
                        )[
                          snap.proposals
                            .filter((p) => p.phase === "CRISIS1")
                            .at(-1)?.option || "MIX"
                        ]
                      }
                    </h3>
                  </div>
                </div>
              )}
              {snap.phase === "AGREEMENT" && (
                <>
                  <Ledger snap={snap} send={send} busy={busy} editable />
                  <div className="advisor-panel">
                    <BookOpen size={24} />
                    <div>
                      <h3>בדיקה אחת. שלוש שאלות.</h3>
                      {snap.advisorId ? (
                        <>
                          <p>
                            הסעיף שנבחר:{" "}
                            {
                              snap.clauses.find((c) => c.id === snap.advisorId)
                                ?.category
                            }
                          </p>
                          <ol>
                            <li>מי מוסמך לבצע?</li>
                            <li>האם המימון אושר?</li>
                            <li>איזה אישור או הסכם עוד חסר?</li>
                          </ol>
                          <p>
                            בדקו ותקנו את הסעיף בעצמכן. היועץ אינו מעניק אישור.
                          </p>
                        </>
                      ) : (
                        <>
                          <p>היועץ יבחר סעיף אחד שיש בו תלות פתוחה.</p>
                          <button
                            className="btn outline"
                            disabled={busy}
                            onClick={() => send({ type: "advisor" })}
                          >
                            בדיקת סעיף אחד
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
              {snap.phase === "FUTURE" && (
                <>
                  <div className="outcome-heading">
                    <span className="eyebrow">תוצאה אפשרית בסימולציה</span>
                    <h2>{outcome.title}</h2>
                    <p>{outcome.reason}</p>
                  </div>
                  <div className="letters-grid">
                    <div className="letter-card">
                      <span className="overline">יעל · אופקים</span>
                      <h3>״{outcome.yael}״</h3>
                    </div>
                    <div className="letter-card">
                      <span className="overline">מיכל · שבילים</span>
                      <h3>״{outcome.michal}״</h3>
                    </div>
                  </div>
                  <div className="outcome-metrics">
                    {[
                      ["יעד 25", outcome.target],
                      ["פערים", outcome.gap],
                      ["יציבות הביצוע", outcome.capacity],
                    ].map(([a, b]) => (
                      <article key={a}>
                        <span>{a}</span>
                        <strong>{b}</strong>
                      </article>
                    ))}
                  </div>
                  {snap.finalRevision ? (
                    <div className="panel">
                      <h3>התיקון שלנו</h3>
                      <p>
                        <del>
                          {snap.finalRevision.before || "לא נוסח סעיף קודם"}
                        </del>
                      </p>
                      <p>{snap.finalRevision.after}</p>
                      <p className="muted">
                        מה למדנו: {snap.finalRevision.reason}
                      </p>
                      <div className="letters-grid">
                        <div className="success-note">
                          <strong>אפשרות לשיפור</strong>
                          <p>
                            הצעד המתוקן עשוי לאפשר תמיכה ממוקדת יותר בבית הספר
                            שהושפע.
                          </p>
                        </div>
                        <div className="warning-note">
                          <strong>מחיר אפשרי</strong>
                          <p>
                            הקצאה חדשה עשויה לעכב צעד אחר או לדרוש משאבים
                            ואישורים נוספים.
                          </p>
                        </div>
                      </div>
                      <p className="small muted">
                        אלו אפשרויות בדיוניות, לא תחזיות סיבתיות.
                      </p>
                    </div>
                  ) : (
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        send({
                          type: "final",
                          ...Object.fromEntries(new FormData(e.currentTarget)),
                        });
                      }}
                    >
                      <h3>משנות סעיף אחד, מתוך מה שלמדנו</h3>
                      <label>
                        איזה סעיף?
                        <select name="id">
                          {snap.clauses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        הנוסח החדש
                        <textarea name="after" required maxLength={600} />
                      </label>
                      <label>
                        מה למדנו, ומה המחיר של התיקון?
                        <textarea name="reason" required maxLength={600} />
                      </label>
                      <button className="btn primary" disabled={busy}>
                        שמירת התיקון היחיד
                      </button>
                    </form>
                  )}
                </>
              )}
              {snap.phase === "TRANSFER" && (
                <>
                  {team ? (
                    <form
                      className="panel"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        send({
                          type: "reflection",
                          answers: ["0", "1", "2"].map((k) => f.get(k)),
                        });
                      }}
                    >
                      {[
                        "מי מעורב בהחלטה?",
                        "איזה מידע עדיין חסר?",
                        "מי יכולה לקדם פתרון, ומה הצעד הראשון?",
                      ].map((q, i) => (
                        <label key={i}>
                          {q}
                          <textarea
                            name={String(i)}
                            required
                            maxLength={600}
                            defaultValue={
                              snap.reflections.find(
                                (r) => r.team === actor.role,
                              )?.answers[i]
                            }
                          />
                        </label>
                      ))}
                      <button className="btn primary" disabled={busy}>
                        שמירת המבט החדש שלנו
                      </button>
                    </form>
                  ) : (
                    <div className="panel">
                      <h2>שלוש שאלות לשיחה</h2>
                      <ol>
                        <li>מי מעורב בהחלטה?</li>
                        <li>איזה מידע עדיין חסר?</li>
                        <li>מי יכולה לקדם פתרון?</li>
                      </ol>
                      <p>{snap.reflections.length} משלחות שיתפו רפלקציה.</p>
                    </div>
                  )}
                </>
              )}
              {snap.phase === "COMPLETE" && (
                <div className="closing-panel">
                  <CheckCircle2 size={40} />
                  <h2>ההחלטות נשמרו. המבט השתנה.</h2>
                  <p>קחו איתכן את ההסכם, ההסתייגויות והשאלות שעדיין פתוחות.</p>
                  <button
                    className="btn primary"
                    onClick={() => setTab("report")}
                  >
                    <Download size={18} />
                    לסיכום המפגש
                  </button>
                </div>
              )}
              {snap.proposals.some((p) => p.phase === snap.phase) && (
                <section className="panel">
                  <h2>העמדות שעל השולחן</h2>
                  {publicRoles.map((r) => {
                    const p = snap.proposals
                      .filter((p) => p.phase === snap.phase && p.team === r.id)
                      .at(-1);
                    return p ? (
                      <article className="proposal-summary" key={r.id}>
                        <span className="role-avatar">{r.initial}</span>
                        <div>
                          <strong>{r.name}</strong>
                          <p>{p.action}</p>
                          <span className="small muted">
                            המחיר: {p.price} · התנאי: {p.condition}
                          </span>
                        </div>
                        <span className="pill">
                          {p.option === "MIX" ? "שילוב" : p.option}
                        </span>
                      </article>
                    ) : null;
                  })}
                </section>
              )}
              {snap.shared.length > 0 && (
                <section className="panel">
                  <h3>מידע שהמשלחות בחרו לשתף</h3>
                  {snap.shared.map((s, i) => (
                    <p key={i}>
                      <strong>{roleName(s.team)}:</strong> {s.text}
                    </p>
                  ))}
                </section>
              )}
            </>
          )}
          {tab === "role" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">נקודות המבט סביב השולחן</span>
                <h1>{team ? "התפקיד שלנו" : "חמש משלחות. חמש אחריויות."}</h1>
              </div>
              {(team
                ? publicRoles.filter((r) => r.id === actor.role)
                : publicRoles
              ).map((r) => (
                <article className="panel role-detail" key={r.id}>
                  <div className="role-title">
                    <span className="role-avatar large">{r.initial}</span>
                    <div>
                      <h2>{r.name}</h2>
                      <span className="muted">
                        זוג אחד · שתי נקודות מבט משלימות
                      </span>
                    </div>
                  </div>
                  <div className="pair-roles">
                    <span>
                      {phaseIndex >= 4 ? "משתתפת ב׳" : "משתתפת א׳"} · נציגת משא
                      ומתן
                    </span>
                    <span>
                      {phaseIndex >= 4 ? "משתתפת א׳" : "משתתפת ב׳"} · יועצת
                      מדיניות
                    </span>
                  </div>
                  <h3>שתי המטרות שלכן</h3>
                  {r.goals.map((g) => (
                    <p key={g} className="goal">
                      <CheckCircle2 size={18} />
                      {g}
                    </p>
                  ))}
                  <div className="concession">
                    <strong>המרחב לפשרה</strong>
                    <p>{r.concession}</p>
                  </div>
                  {(host || team) && (
                    <div className="secret-panel">
                      <button
                        onClick={() => setShowSecret(!showSecret)}
                        aria-expanded={showSecret}
                      >
                        <LockKeyhole size={19} />
                        {showSecret ? "סגירת מידע חסוי" : "מידע למשלחת בלבד"}
                        <Eye size={17} />
                      </button>
                      {showSecret && (
                        <p>
                          {host
                            ? snap.privateCards?.[r.id] ||
                              "מידע לדוגמה בלבד בהדגמה"
                            : snap.privateCard}
                        </p>
                      )}
                    </div>
                  )}
                </article>
              ))}
              {team && (
                <form
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    send({ type: "share", text: f.get("text") });
                  }}
                >
                  <h3>מה נבחר לשתף?</h3>
                  <p className="muted">
                    רק הטקסט שתכתבו כאן יהיה ציבורי. אין שיתוף אוטומטי של
                    הכרטיס.
                  </p>
                  <label>
                    המידע שתרצו לחשוף
                    <textarea name="text" required maxLength={600} />
                  </label>
                  <button className="btn outline" disabled={busy}>
                    פרסום המידע שנבחר
                  </button>
                </form>
              )}
            </>
          )}
          {tab === "ledger" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">ממילים לאחריות</span>
                <h1>מה הבטחנו, ומה עדיין חסר?</h1>
                <p className="muted">
                  תיקון יוצר גרסה חדשה. אף החלטה קודמת לא נמחקת.
                </p>
              </div>
              <Ledger
                snap={snap}
                send={send}
                busy={busy}
                editable={
                  host || snap.phase === "CRISIS3" || snap.phase === "AGREEMENT"
                }
              />
            </>
          )}
          {tab === "help" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">לומדות מתוך ההתרחשות</span>
                <h1>קצת הקשר. מבט רחב יותר.</h1>
              </div>
              <div className="warning-banner">
                <ShieldCheck size={20} />
                גרסת התנסות: המיפוי המוסדי והסיכומים המחקריים ממתינים לאימות
                מקצועי לפני שימוש בהפקה.
              </div>
              {explanations.map((x) => (
                <article className="panel" key={x.title}>
                  <span className="pill">פרשנות פדגוגית</span>
                  <h2>{x.title}</h2>
                  <p>{x.text}</p>
                  <p className="small muted">{x.source}</p>
                  <button
                    className="link-button"
                    onClick={() => setTab("event")}
                  >
                    חזרה להחלטה <ArrowLeft size={16} />
                  </button>
                </article>
              ))}
              <Research />
              <div className="panel">
                <h3>עמדות מפלגתיות</h3>
                <span className="pill">ממתין לאימות</span>
                <p>
                  לא מוצג ציטוט מפלגתי שלא אומת מול מקור מקורי ותאריך. הדרישות
                  הפוליטיות במשחק בדיוניות ואינן מיוחסות למפלגה.
                </p>
              </div>
            </>
          )}
          {tab === "report" && report}
        </main>
        <aside className="context-panel no-print" aria-label="תמונת מצב משותפת">
          <div className="context-heading">
            <span className="live-dot" /> התמונה המשותפת
          </div>
          <div className="context-target">
            <span>הבטחת הממשלה</span>
            <strong>
              25<span>תלמידים בכיתה</span>
            </strong>
            <small>בתוך שלוש שנים</small>
          </div>
          <div className="context-schools">
            {schools.map((s) => (
              <div key={s.id}>
                <span className="school-letter">{s.initial}</span>
                <div>
                  <strong>{s.name}</strong>
                  <span>{s.students} תלמידים · 2 כיתות</span>
                </div>
                <span className="context-size">{s.classSize}</span>
              </div>
            ))}
          </div>
          <div className="context-divider" />
          <h3>סביב השולחן</h3>
          {snap.teams.map((t) => (
            <div className="context-team" key={t.role}>
              <span className={t.connected ? "live-dot" : "gray-dot"} />
              <span>{roleName(t.role)}</span>
              <small>
                {t.connected ? "מחוברות" : t.joined ? "מנותקות" : "טרם הצטרפו"}
              </small>
              {host && t.joined && !demo && (
                <button
                  className="icon-btn tiny"
                  title="ביטול שיוך מכשיר"
                  onClick={() => {
                    if (window.confirm("לבטל את שיוך המכשיר למשלחת?"))
                      send({ type: "revoke", role: t.role });
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {host && snap.requests && snap.requests.length > 0 && (
            <div className="requests">
              <h3>בקשות הצטרפות</h3>
              {snap.requests.map((r) => (
                <div key={r.id}>
                  <span>{roleName(r.role)}</span>
                  <button
                    className="btn-small primary"
                    disabled={busy}
                    onClick={() => send({ type: "approve", memberId: r.id })}
                  >
                    אישור
                  </button>
                </div>
              ))}
            </div>
          )}
          {host && !demo && (
            <>
              <div className="context-divider" />
              <button
                className="btn outline full-width"
                onClick={() => {
                  const key = sessionStorage.getItem("projector_" + id);
                  if (!key) {
                    setError("קישור ההקרנה זמין בדפדפן שיצר את המפגש.");
                    return;
                  }
                  window.open(
                    "/room/" + id + "#projector=" + key,
                    "_blank",
                    "noopener",
                  );
                }}
              >
                <Monitor size={17} />
                פתיחת מסך הקרנה
              </button>
              <details className="recovery-box">
                <summary>
                  <LockKeyhole size={15} />
                  שחזור גישת מנחה
                </summary>
                <p>שמרי את הקוד במקום פרטי. הוא אינו מיועד להקרנה.</p>
                <code>
                  {typeof window !== "undefined"
                    ? sessionStorage.getItem("recovery_" + id) ||
                      "הקוד נשמר בעת יצירת המפגש"
                    : ""}
                </code>
              </details>
              <button
                className="link-button danger-link"
                onClick={() => openConfirm("delete")}
              >
                מחיקת המפגש
              </button>
            </>
          )}
          <div className="context-tip">
            <HelpCircle size={19} />
            <p>
              הסכמה בחדר אינה אישור ביצוע.
              <br />
              שאלו תמיד: מי מוסמך, ומה חסר?
            </p>
          </div>
          <Fiction />
        </aside>
      </div>
      <nav className="mobile-nav no-print" aria-label="ניווט מהיר">
        {(
          [
            { id: "event", label: "האירוע", icon: Radio },
            { id: "role", label: "התפקיד", icon: Users },
            { id: "ledger", label: "התחייבויות", icon: FileText },
            { id: "help", label: "עזרה", icon: BookOpen },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={20} />
            {t.label}
          </button>
        ))}
      </nav>
      <div className="toast" role="status" aria-live="polite">
        {toast && (
          <>
            <CheckCircle2 size={18} />
            {toast}
          </>
        )}
      </div>
      {confirm && (
        <div className="dialog-backdrop">
          <dialog
            open
            aria-modal="true"
            className="entry-dialog"
            aria-labelledby="confirm-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setConfirm(null);
              if (e.key === "Tab") {
                const els =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                if (e.shiftKey && document.activeElement === els[0]) {
                  e.preventDefault();
                  els[els.length - 1].focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === els[els.length - 1]
                ) {
                  e.preventDefault();
                  els[0].focus();
                }
              }
            }}
          >
            <h2 id="confirm-title">
              {confirm === "delete" ? "למחוק את המפגש?" : "ממשיכות לשלב הבא?"}
            </h2>
            <p>
              {confirm === "delete"
                ? "המידע יימחק לצמיתות. מומלץ להדפיס את הדוח לפני המחיקה."
                : "ההחלטות והטיוטות יישמרו. נושאים שטרם הוכרעו יישארו פתוחים."}
            </p>
            <div className="hero-actions">
              <button
                autoFocus
                className="btn outline"
                onClick={() => setConfirm(null)}
              >
                חזרה
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await send({
                      type: confirm === "delete" ? "delete" : "advance",
                    })
                  )
                    setConfirm(null);
                }}
              >
                {" "}
                {confirm === "delete" ? "מחיקה לצמיתות" : "כן, לשלב הבא"}
                <ArrowLeft size={16} />
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
function Progress({ index }: { index: number }) {
  return (
    <div className="progress-track" aria-label="התקדמות המשחק">
      {scenes.slice(1, -1).map((s, i) => (
        <div key={s.id} className={index >= i + 1 ? "filled" : ""}>
          <span />
          {s.label}
        </div>
      ))}
    </div>
  );
}
function Research() {
  return (
    <section>
      <div className="section-heading">
        <h2>שתי ראיות. שאלה אחת טובה יותר.</h2>
        <span className="pill">סיכומים ממתינים לאימות</span>
      </div>
      <div className="research-grid">
        {research.map((r, i) => (
          <article className="research-card" key={r.title}>
            <span className="overline">{r.type}</span>
            <h3>{r.title}</h3>
            <h4>{r.subtitle}</h4>
            <p>{r.text}</p>
            <div className="research-limits">
              <strong>מה עדיין לא יודעים?</strong>
              <p>{r.limits}</p>
            </div>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.publisher}
              <ExternalLink size={14} />
            </a>
            <span className="small muted">
              {r.date} · {r.status}
            </span>
          </article>
        ))}
      </div>
      <p className="small muted">
        אין כאן סתירה פשוטה: גודל ההפחתה, האוכלוסיות וההקשרים שונים. אלו סיכומים
        ראשוניים, לא טענות שאומתו לשימוש בהפקה.
      </p>
    </section>
  );
}
function Ledger({
  snap,
  send,
  busy,
  editable,
}: {
  snap: Snapshot;
  send: (a: Action) => Promise<boolean>;
  busy: boolean;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Record<string, string>>({});
  return (
    <div className="ledger-list">
      {snap.clauses.map((c) => (
        <article className="ledger-card" key={c.id}>
          <div className="ledger-header">
            <div>
              <span className="overline">גרסה {c.version}</span>
              <h2>{c.category}</h2>
            </div>
            <span className={"status status-" + c.status}>
              {c.status === "APPROVED_EXECUTABLE" ? (
                <CheckCircle2 size={14} />
              ) : c.status === "AGREED_PENDING" ? (
                <Clock3 size={14} />
              ) : (
                <HelpCircle size={14} />
              )}{" "}
              {statuses[c.status]}
            </span>
          </div>
          <p className={!c.action ? "muted" : ""}>
            {c.action || "הסעיף עדיין פתוח. כאן תופיע ההתחייבות המשותפת."}
          </p>
          {c.action && (
            <dl className="clause-details">
              <div>
                <dt>אחריות</dt>
                <dd>{c.owner}</dd>
              </div>
              <div>
                <dt>הצעד הבא</dt>
                <dd>{c.nextStep}</dd>
              </div>
              <div>
                <dt>עד מתי</dt>
                <dd>{c.deadline}</dd>
              </div>
              <div>
                <dt>מה נדרש</dt>
                <dd>
                  {[
                    !c.authority && "סמכות",
                    !c.funding && "מימון",
                    !c.readiness && "מוכנות",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "תנאי הביצוע תועדו בסימולציה"}
                </dd>
              </div>
            </dl>
          )}
          {c.previous && (
            <details className="history-details">
              <summary>מה השתנה מהגרסה הקודמת?</summary>
              <p>
                <strong>לפני:</strong> {c.previous}
              </p>
              <p>
                <strong>אחרי:</strong> {c.action}
              </p>
            </details>
          )}
          {editable && (
            <button
              className="link-button"
              onClick={() => setEditing(editing === c.id ? null : c.id)}
            >
              <Plus size={16} />
              {editing === c.id
                ? "סגירת עריכה"
                : c.action
                  ? "יצירת גרסה מתוקנת"
                  : "ניסוח התחייבות"}
            </button>
          )}
          {editing === c.id && (
            <form
              className="clause-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                if (
                  await send({
                    type: "clause",
                    id: c.id,
                    clause: {
                      ...f,
                      authority: f.authority === "on",
                      funding: f.funding === "on",
                      readiness: f.readiness === "on",
                      ofakim: f.ofakim === "on",
                      shvilim: f.shvilim === "on",
                    },
                  })
                )
                  setEditing(null);
              }}
            >
              <label>
                מה נעשה?
                <textarea
                  name="action"
                  required
                  maxLength={600}
                  defaultValue={c.action}
                />
              </label>
              <div className="form-grid">
                {(
                  [
                    ["owner", "מי אחראי?"],
                    ["requiredPartners", "מי צריך להשתתף ולאשר?"],
                    ["resources", "אילו משאבים?"],
                    ["nextStep", "מה הצעד הבא?"],
                    ["deadline", "עד מתי?"],
                    ["schoolEffects", "השפעה על אופקים ועל שבילים"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k}>
                    {label}
                    <input
                      name={k}
                      required
                      maxLength={600}
                      defaultValue={c[k]}
                    />
                  </label>
                ))}
              </div>
              <fieldset>
                <legend>לאילו בתי ספר מוסדר מסלול הביצוע?</legend>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="ofakim"
                    defaultChecked={c.ofakim}
                  />
                  אופקים
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="shvilim"
                    defaultChecked={c.shvilim}
                  />
                  שבילים
                </label>
              </fieldset>
              <label>
                דרגת התחייבות
                <select name="status" defaultValue={c.status}>
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>אילו תנאים מומשו בסימולציה?</legend>
                {(
                  [
                    ["authority", "תועדה סמכות מתאימה"],
                    ["funding", "תועד מימון מאושר"],
                    ["readiness", "תועדו מוכנות ואישורים נדרשים"],
                  ] as const
                ).map(([k, label]) => (
                  <label className="checkbox-label" key={k}>
                    <input type="checkbox" name={k} defaultChecked={c[k]} />
                    {label}
                  </label>
                ))}
                <label>
                  מה מתעד את התנאים בסימולציה?
                  <textarea
                    name="evidence"
                    maxLength={600}
                    defaultValue={c.evidence}
                    placeholder="איזה אישור, הקצאה או שלב מוכנות תועדו במשחק?"
                  />
                </label>
                <p className="small muted">
                  סימון במשחק אינו אישור משפטי. יש לנמק את התנאים בשדות הסעיף.
                </p>
              </fieldset>
              <button className="btn primary" disabled={busy}>
                שמירת גרסה חדשה
              </button>
            </form>
          )}
          {snap.actor.kind === "host" && c.action && (
            <button
              className="btn outline"
              disabled={busy || c.published}
              onClick={() => send({ type: "publish", id: c.id })}
            >
              <Monitor size={16} />
              {c.published ? "פורסם למסך ההקרנה" : "פרסום ההתחייבות להקרנה"}
            </button>
          )}
          {snap.actor.kind === "team" && c.action && (
            <div className="consent-row">
              <label className="consent-condition">
                תנאי להסכמה (אם נדרש)
                <input
                  maxLength={600}
                  value={conditions[c.id] || ""}
                  onChange={(e) =>
                    setConditions({ ...conditions, [c.id]: e.target.value })
                  }
                />
              </label>
              <span className="small">העמדה שלנו לגרסה {c.version}</span>
              {[
                ["support", "מסכימות"],
                ["conditional", "בתנאי"],
                ["object", "מתנגדות"],
              ].map(([p, label]) => (
                <button
                  className={
                    "btn-small " +
                    (snap.consents.some(
                      (v) =>
                        v.team === snap.actor.role &&
                        v.clauseId === c.id &&
                        v.version === c.version &&
                        v.position === p,
                    )
                      ? "primary"
                      : "outline")
                  }
                  disabled={busy}
                  key={p}
                  onClick={() =>
                    send({
                      type: "consent",
                      id: c.id,
                      position: p,
                      condition: conditions[c.id] || "",
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <p className="small muted">
            {
              snap.consents.filter(
                (v) => v.clauseId === c.id && v.version === c.version,
              ).length
            }{" "}
            משלחות מסרו עמדה לגרסה זו · הסכמה אינה סמכות
          </p>
        </article>
      ))}
    </div>
  );
}
