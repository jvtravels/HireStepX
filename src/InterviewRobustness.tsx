/* HireStepX — Interview robustness primitives
 *
 * Six small components that handle the interview's "around the edges"
 * UX: pace coaching, repeat-the-question, save acknowledgement, mic
 * trouble, network recovery, first-time onboarding. All editorial,
 * all small enough to read end-to-end.
 *
 * Lives separately from InterviewPanels.tsx (which holds the shipped
 * pre-rebrand chrome) so this file can be visually tweaked or
 * extracted further without touching the larger panels module.
 *
 * Public API: PaceMeter, RepeatButton, SaveToast, MicQuietBanner,
 * ReconnectingOverlay, InterviewCoachmarks. All re-exported from
 * InterviewPanels.tsx for backwards-compat with existing imports.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { e, ef } from "./interviewTokens";

/* ─── PaceMeter — sweet-spot bar shown while user is answering ─── */

export const PaceMeter = memo(function PaceMeter({ seconds, ideal = { min: 60, max: 90 }, ceiling = 150 }: {
  seconds: number;
  ideal?: { min: number; max: number };
  ceiling?: number;
}) {
  const pct = Math.min(100, (seconds / ceiling) * 100);
  const idealStartPct = (ideal.min / ceiling) * 100;
  const idealEndPct = (ideal.max / ceiling) * 100;
  const zone = seconds < ideal.min ? "early" : seconds <= ideal.max ? "ideal" : seconds <= ceiling ? "late" : "over";
  const labelMap = { early: "Take your time…", ideal: "Good pace", late: "Wrap it up", over: "Cut it short" } as const;
  const tint = zone === "ideal" ? e.success : zone === "early" ? e.inkSoft : zone === "late" ? e.copper : e.error;
  return (
    <div role="meter" aria-label="Answer length pace" aria-valuemin={0} aria-valuemax={ceiling} aria-valuenow={Math.round(seconds)} className="iv-pace-meter" style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 280 }}>
      <div style={{ position: "relative", height: 4, background: "rgba(20,17,10,0.04)", borderRadius: 999, overflow: "hidden" }}>
        <span aria-hidden style={{ position: "absolute", left: `${idealStartPct}%`, width: `${idealEndPct - idealStartPct}%`, top: 0, bottom: 0, background: "rgba(21,128,61,0.22)" }} />
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: tint, opacity: 0.9, transition: "width 240ms ease, background 240ms ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: ef.mono, fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2, color: e.inkSoft }}>
        <span>{Math.floor(seconds)}s spoken</span>
        <span style={{ color: tint }}>{labelMap[zone]}</span>
      </div>
    </div>
  );
});

/* ─── RepeatButton — small ghost · "↻ Repeat" ─── */

export const RepeatButton = memo(function RepeatButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Repeat the question"
      title="Repeat the question (Press R)"
      className="iv-repeat-btn"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "rgba(20,17,10,0.04)", border: `1px solid ${e.line}`,
        borderRadius: 999, padding: "6px 12px", minHeight: 32,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: ef.sans, fontSize: 11, fontWeight: 500, color: e.coal,
        transition: "all 0.16s ease",
      }}
      onMouseEnter={ev => { if (!disabled) { ev.currentTarget.style.background = "rgba(20,17,10,0.05)"; ev.currentTarget.style.borderColor = e.lineStrong; } }}
      onMouseLeave={ev => { ev.currentTarget.style.background = "rgba(20,17,10,0.04)"; ev.currentTarget.style.borderColor = e.line; }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      Repeat
    </button>
  );
});

/* ─── SaveToast — bottom-left "Answer saved" pulse ─── */

export const SaveToast = memo(function SaveToast({ message = "Answer saved" }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="iv-save-toast" style={{
      position: "fixed", left: 16, bottom: "max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))",
      display: "inline-flex", alignItems: "center", gap: 8,
      background: e.coal, color: e.cream, padding: "8px 14px", borderRadius: 999,
      fontFamily: ef.sans, fontSize: 12, fontWeight: 500,
      boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
      zIndex: 90, animation: "fadeUp 0.28s ease both",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7CC289" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {message}
    </div>
  );
});

/* ─── MicQuietBanner — "I'm having trouble hearing you" ─── */

export const MicQuietBanner = memo(function MicQuietBanner({ onSwitchToText }: { onSwitchToText?: () => void }) {
  return (
    <div role="alert" className="iv-mic-quiet" style={{
      display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px",
      background: "rgba(180,83,9,0.13)", border: "1px solid rgba(180,83,9,0.25)",
      borderRadius: 12, maxWidth: 460, marginTop: 8,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={e.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
      </svg>
      <span style={{ fontFamily: ef.sans, fontSize: 12, color: e.coal }}>
        Having trouble hearing you. Move closer to your mic
        {onSwitchToText && (
          <>
            , or{" "}
            <button
              type="button"
              onClick={onSwitchToText}
              style={{ background: "transparent", border: "none", padding: 0, color: e.copper, fontWeight: 600, cursor: "pointer", fontFamily: ef.sans, fontSize: 12, textDecoration: "underline" }}
            >
              switch to typing
            </button>
          </>
        )}
        .
      </span>
    </div>
  );
});

/* ─── ReconnectingOverlay — full-screen recovery on network drop ─── */

export const ReconnectingOverlay = memo(function ReconnectingOverlay({ attempt = 1, currentQuestion, totalQuestions, onPause }: {
  attempt?: number;
  currentQuestion: number;
  totalQuestions: number;
  onPause?: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="iv-reconnecting-title" className="iv-reconnecting" style={{
      position: "fixed", inset: 0, zIndex: 220,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(14,12,8,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      padding: 24,
    }}>
      <div style={{
        maxWidth: 460, width: "100%",
        background: e.white, border: `1px solid ${e.line}`, borderRadius: 16,
        padding: "32px 28px 24px", textAlign: "center",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", background: "rgba(180,83,9,0.10)",
          display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <div style={{ width: 26, height: 26, border: `2.5px solid ${e.line}`, borderTopColor: e.copper, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
        <h2 id="iv-reconnecting-title" style={{
          margin: 0, fontFamily: ef.serif, fontSize: 22, fontWeight: 400, color: e.coal, letterSpacing: "-0.01em",
        }}>
          Reconnecting…
        </h2>
        <p style={{
          margin: "8px 0 0", fontFamily: ef.sans, fontSize: 13, color: e.coal, lineHeight: 1.55,
        }}>
          Your network blipped. We&rsquo;ve saved everything up to question{" "}
          <strong style={{ color: e.coal }}>{currentQuestion} of {totalQuestions}</strong>
          . You&rsquo;ll pick up where you left off.
        </p>
        <div style={{
          marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 12px", background: e.creamSoft, border: `1px solid ${e.line}`,
          borderRadius: 999, fontFamily: ef.mono, fontSize: 10,
          textTransform: "uppercase", letterSpacing: 1.2, color: e.inkSoft,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: e.copper }} />
          Attempt {attempt} of 5
        </div>
        {onPause && (
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={onPause}
              style={{
                background: "transparent", color: e.coal,
                border: `1px solid ${e.line}`, borderRadius: 10,
                padding: "10px 18px", fontFamily: ef.sans, fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.16s ease",
              }}
              onMouseEnter={ev => { ev.currentTarget.style.background = "rgba(20,17,10,0.04)"; ev.currentTarget.style.borderColor = e.lineStrong; }}
              onMouseLeave={ev => { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.borderColor = e.line; }}
            >
              Pause and resume later
            </button>
            <span style={{ fontFamily: ef.sans, fontSize: 11, color: e.inkSoft }}>
              We&rsquo;ll email you a link to come back.
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/* ─── InterviewCoachmarks — first-time onboarding overlay ─────────────
   Voice-first interview is unfamiliar. Shows once per user on the first
   session ever, then never again. Three short callouts cover the
   non-obvious affordances. Dismissal persists in localStorage. */

const COACHMARK_LS_KEY = "hsx-iv-coachmarks-dismissed-v1";

export const InterviewCoachmarks = memo(function InterviewCoachmarks() {
  const [open, setOpen] = useState(false);
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    try {
      if (localStorage.getItem(COACHMARK_LS_KEY) !== "true") setOpen(true);
    } catch { /* localStorage may be blocked (Safari private mode); silently skip */ }
  }, []);
  const dismiss = useCallback(() => {
    try { localStorage.setItem(COACHMARK_LS_KEY, "true"); } catch { /* ignore */ }
    setOpen(false);
  }, []);
  /* Escape-to-dismiss is bound at the document level rather than on the
     dialog div, because attaching keyboard handlers to a non-interactive
     element trips jsx-a11y/no-noninteractive-element-interactions. Focus
     the primary action on mount so keyboard users land somewhere useful
     without resorting to autoFocus (also a11y-flagged). */
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") dismiss(); };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => dismissBtnRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, dismiss]);
  if (!open) return null;
  const tips = [
    {
      kbd: "Space",
      title: "Voice or text",
      body: "Just start speaking — we&rsquo;re always listening. Press <strong>Space</strong> when you&rsquo;re done. Or type instead — both work.",
    },
    {
      kbd: "R",
      title: "Repeat the question",
      body: "Press R or tap the Repeat button if you missed what was asked. Real interviewers do it too.",
    },
    {
      kbd: "✓",
      title: "Saved automatically",
      body: "Your answers save after every question. If your network blips, you won&rsquo;t lose anything.",
    },
  ];
  /* Backdrop click-to-dismiss is a standard modal affordance; the keyboard
     equivalent (Escape) is wired at the document level in the useEffect
     above, so the no-key-events rule's underlying concern is satisfied
     even though it can't see the document listener. */
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="iv-coachmark-title"
      className="iv-coachmark-backdrop"
      onClick={(ev) => { if (ev.target === ev.currentTarget) dismiss(); }}
    >
      <div className="iv-coachmark-card iv-coachmark">
        <h2
          id="iv-coachmark-title"
          style={{
            margin: 0, fontFamily: ef.serif, fontSize: 26, fontWeight: 400,
            lineHeight: 1.2, color: e.coal, letterSpacing: "-0.015em",
          }}
        >
          A quick <em style={{ color: e.copper, fontStyle: "italic" }}>three things</em>.
        </h2>
        <p style={{
          margin: "8px 0 22px", fontFamily: ef.sans, fontSize: 13,
          color: e.inkSoft, lineHeight: 1.55,
        }}>
          Takes ten seconds. We won&rsquo;t show this again.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {tips.map((tip, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minWidth: 36, height: 28, padding: "0 8px",
                  background: e.creamSoft, border: `1px solid ${e.line}`,
                  borderRadius: 8, fontFamily: ef.mono, fontSize: 11, fontWeight: 500,
                  color: e.inkSoft, letterSpacing: 0.6,
                }}
              >
                {tip.kbd}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  fontFamily: ef.sans, fontSize: 14, fontWeight: 500, color: e.coal,
                }}>
                  {tip.title}
                </span>
                <span
                  style={{ fontFamily: ef.sans, fontSize: 13, color: e.inkSoft, lineHeight: 1.5 }}
                  // Tip body uses HTML entities for typographic apostrophes.
                  dangerouslySetInnerHTML={{ __html: tip.body }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
          <button
            ref={dismissBtnRef}
            type="button"
            onClick={dismiss}
            style={{
              background: e.indigo, color: e.cream, border: "none",
              borderRadius: 999, padding: "10px 22px",
              fontFamily: ef.sans, fontSize: 14, fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
              transition: "filter 0.16s ease",
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.filter = "brightness(1.10)"; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.filter = "brightness(1)"; }}
          >
            Got it — let&rsquo;s start
          </button>
        </div>
      </div>
    </div>
  );
});
