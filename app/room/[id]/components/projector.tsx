"use client";
import { Layers3, Monitor, WifiOff } from "lucide-react";
import { scenes, schools, statuses } from "../../../../lib/content";
import { phaseProgress, sceneSummaries } from "../../../../lib/guidance";
import { selectOutcome, type Game } from "../../../../lib/engine";
import TextSizeControl from "../../../text-size";
export default function Projector({
  game,
  time,
  connected,
  instruction,
  beatTitle,
}: {
  game: Game;
  time: string;
  connected: boolean;
  instruction: string;
  beatTitle: string;
}) {
  const scene = scenes.find((s) => s.id === game.phase)!;
  const index = scenes.indexOf(scene);
  const options =
    scene.options && game.revealedOptions?.includes(game.phase)
      ? scene.options
      : null;
  const outcome = game.outcome || selectOutcome(game);
  const agreement = game.phase === "AGREEMENT" || game.phase === "COMPLETE";
  const currentLabel =
    game.phase === "FUTURE"
      ? "בוחנות את ההשלכות"
      : agreement
        ? "בודקות את ההתחייבויות"
        : options
          ? "משוות חלופות ומנהלות משא ומתן"
          : beatTitle || scene.label;
  return (
    <main id="main" className="projector projector-focused">
      <header className="projector-top">
        <a className="brand" href="/">
          <Layers3 aria-hidden="true" />
          חדר המצב
        </a>
        <span>{phaseProgress(game.phase)}</span>
        <span className="timer" aria-label="זמן המפגש">
          {time}
        </span>
        <TextSizeControl />
        <button
          className="icon-btn no-print"
          aria-label="מסך מלא"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          <Monitor aria-hidden="true" />
        </button>
      </header>
      {!connected && (
        <p role="status" className="warning-banner">
          <WifiOff aria-hidden="true" />
          החיבור נותק — מוצגת התמונה האחרונה שנשמרה
        </p>
      )}
      <div className="projector-now">
        <span>כעת</span>
        <strong>{currentLabel}</strong>
      </div>
      <section className="projector-focus" aria-labelledby="projection-title">
        <h1 id="projection-title">{scene.title}</h1>
        {game.phase === "FUTURE" ? (
          <div className="projector-result">
            <h2>{outcome.title}</h2>
            <p>{outcome.reason}</p>
            <div className="projector-dimensions">
              {[
                ["יעד 25", outcome.target],
                ["פערים", outcome.gap],
                ["יכולת ביצוע", outcome.capacity],
              ].map(([title, text]) => (
                <div key={title}>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : agreement ? (
          <div className="projector-agreement">
            {game.clauses.filter((c) => c.published).length ? (
              game.clauses
                .filter((c) => c.published)
                .map((c) => (
                  <article key={c.id}>
                    <h2>{c.category}</h2>
                    <p>
                      {c.action.length > 150
                        ? c.action.slice(0, 147) + "…"
                        : c.action}
                    </p>
                    <span className={"status status-" + c.status}>
                      {statuses[c.status]}
                    </span>
                  </article>
                ))
            ) : (
              <p>המנחה תפרסם כאן את ההתחייבויות שנבדקו יחד.</p>
            )}
          </div>
        ) : options ? (
          <div className="projector-options">
            {options.map((o) => (
              <article key={o.id}>
                <span className="option-letter">{o.id}</span>
                <h2>{o.title}</h2>
                <p>{o.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="projector-message">{sceneSummaries[game.phase]}</p>
        )}
      </section>
      <div className="projector-school-summary">
        {schools.map((s) => (
          <p key={s.id}>
            <strong>{s.name}</strong>
            <span>
              {s.classSize} תלמידים בכיתה · {s.barrier}
            </span>
          </p>
        ))}
      </div>
      <section className="projector-prompt" aria-label="השאלה עכשיו">
        <span>הצעד הבא</span>
        <p>{options ? scene.task : instruction}</p>
      </section>
      <footer className="projector-footer">
        <div className="progress-track" aria-label="התקדמות המשחק">
          {scenes.slice(1, -1).map((s, i) => (
            <div
              key={s.id}
              aria-current={index === i + 1 ? "step" : undefined}
              className={index >= i + 1 ? "filled" : ""}
            >
              <span />
              {s.label}
            </div>
          ))}
        </div>
        <p>
          תרחיש בדיוני / נתוני משחק · הנוסחים המלאים והמקורות במכשירי המשתתפות
        </p>
      </footer>
    </main>
  );
}
