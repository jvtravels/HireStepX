/* DrillSessionView — controller for a 5-question drill micro-session.
 *
 * Presentational + minimal local state. Mirrors the report's editorial
 * cream/indigo surface (no new tokens). The pure `_drill-session.ts`
 * engine owns scoring + termination; this view is just the loop driver. */

import { useMemo, useState } from "react";
import { t, f, radius, space, shadows } from "../tokens";
import {
  startDrill,
  applyDrillTurn,
  summarizeDrill,
  currentQuestion,
  type DrillConfig,
  type DrillState,
  type DrillSummary,
} from "../../../server-handlers/_drill-session";
import { DrillVerdictCard } from "./DrillVerdictCard";

export function DrillSessionView({
  config,
  onExit,
}: {
  config: DrillConfig;
  onExit?: () => void;
}) {
  const [state, setState] = useState<DrillState>(() => startDrill(config));
  const [answer, setAnswer] = useState("");
  const [lastReply, setLastReply] = useState<string | null>(null);

  const question = currentQuestion(state);
  const verdict: DrillSummary | null = useMemo(
    () => (state.finished ? summarizeDrill(state) : null),
    [state],
  );

  function submit() {
    if (!answer.trim() || state.finished) return;
    const res = applyDrillTurn(state, answer);
    setState(res.state);
    setLastReply(res.recruiterReply);
    setAnswer("");
  }

  return (
    <section
      aria-label="Drill session"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding: 28,
        boxShadow: shadows.card,
      }}
    >
      <header style={{ marginBottom: space.block }}>
        <div
          style={{
            fontFamily: f.sans,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: t.copper,
            fontWeight: 600,
            marginBottom: space.xs,
          }}
        >
          Drill mode
        </div>
        <h2
          style={{
            fontFamily: f.serif,
            fontSize: 22,
            fontWeight: 400,
            color: t.coal,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {config.skill.replace("-", " ")} — 5-question drill
        </h2>
        <p
          style={{
            fontFamily: f.sans,
            fontSize: 13,
            color: t.inkSoft,
            margin: `${space.xs}px 0 0`,
          }}
        >
          Question {Math.min(state.cursor + 1, state.script.length)} of {state.script.length}
        </p>
      </header>

      {verdict ? (
        <DrillVerdictCard summary={verdict} onExit={onExit} />
      ) : (
        <>
          {lastReply && (
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 13,
                color: t.inkSoft,
                fontStyle: "italic",
                margin: `0 0 ${space.md}px`,
              }}
            >
              {lastReply}
            </p>
          )}
          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: space.panelPad,
              marginBottom: space.row,
            }}
          >
            <p
              style={{
                fontFamily: f.serif,
                fontSize: 18,
                color: t.coal,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {question}
            </p>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your response…"
            rows={4}
            aria-label="Your response"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: f.sans,
              fontSize: 14,
              color: t.coal,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: space.xl,
              resize: "vertical",
              marginBottom: space.md,
            }}
          />
          <div style={{ display: "flex", gap: space.md, alignItems: "center" }}>
            <button
              type="button"
              onClick={submit}
              disabled={!answer.trim()}
              style={{
                background: answer.trim() ? t.indigo : t.indigoTint,
                color: t.white,
                border: "none",
                borderRadius: radius.lg,
                padding: "10px 18px",
                fontFamily: f.sans,
                fontSize: 14,
                fontWeight: 600,
                cursor: answer.trim() ? "pointer" : "not-allowed",
              }}
            >
              Submit
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                style={{
                  background: "transparent",
                  border: "none",
                  color: t.inkSoft,
                  fontFamily: f.sans,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Exit drill
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
