"use client";
import { useEffect, useState } from "react";
import { tokens as t, fonts, shadows } from "../auth/_tokens";

const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

/* Local copy of HomepageV2.tsx's reduced-motion hook — kept independent so
   this client island has no import edge back into HomepageV2.tsx (which
   would create a circular dependency now that HeroV2 lives in the
   server-rendered Hero.tsx and imports ProductMockHero from here). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* Local copy of HomepageV2.tsx's Waveform — same reasoning as above. */
function Waveform({ accent }: { accent?: string }) {
  const bars = 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 26 }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        // Round to an integer: React serializes a float like 20.7707… to a
        // truncated "20.7707px" string on the server but keeps full precision
        // on the client, which trips a hydration mismatch warning. Source is
        // deterministic, so rounding removes the warning without changing the look.
        const h = Math.round(5 + Math.abs(Math.sin(i * 0.9)) * 21);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 3,
              height: h,
              borderRadius: 2,
              background: i % 6 === 0 ? accent || t.copper : t.inkFaint,
              opacity: i > bars - 4 ? 0.4 : 1,
              animation: `wf 1.2s ${i * 0.04}s ease-in-out infinite`,
            }}
          />
        );
      })}
      <style>{`@keyframes wf {0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.4)}}`}</style>
    </div>
  );
}

export function ProductMockHero() {
  type Phase = "idle" | "listening" | "scoring" | "done";
  const scenarios = [
    {
      company: "Razorpay",
      round: "Behavioral Round",
      question:
        "Tell me about a time you led a cross-functional project under a tight deadline.",
      transcript:
        "Last quarter at Razorpay, our checkout latency spiked during a Tier-1 sale. I was asked to lead a tiger team across infra and product",
      score: "8.4",
      bars: [
        ["Situation", 92],
        ["Task", 88],
        ["Action", 71],
        ["Result", 64],
      ] as Array<[string, number]>,
      fix: 'Quantify the result. Try "checkout p95 latency from 1.4s → 380ms".',
    },
    {
      company: "Zomato",
      round: "Product Sense",
      question:
        "How would you re-design the Zomato Gold flow for tier-2 cities?",
      transcript:
        "I'd start by segmenting Gold users by frequency, then audit the funnel from search to checkout. The drop-off in tier-2 is at payment, not discovery",
      score: "9.1",
      bars: [
        ["Framework", 95],
        ["User empathy", 92],
        ["Metrics", 86],
        ["Tradeoffs", 78],
      ] as Array<[string, number]>,
      fix: "Strong frame. Add one cost tradeoff to push past a 9.5.",
    },
    {
      company: "TCS Digital",
      round: "HR Round",
      question: "Why TCS Digital and not just TCS?",
      transcript:
        "Digital is where TCS bets on the next decade: cloud, data, the modernisation work. The codebase pace matches my pace; the regular stream felt like maintenance.",
      score: "7.6",
      bars: [
        ["Honesty", 88],
        ["Specificity", 74],
        ["Brand fit", 82],
        ["Confidence", 70],
      ] as Array<[string, number]>,
      fix: 'Add one concrete project. "I want to work on Aurora rollouts" beats brand talk.',
    },
  ];
  const [idx, setIdx] = useState(0);
  const scene = scenarios[idx];
  const [phase, setPhase] = useState<Phase>("done");
  const [typed, setTyped] = useState("");
  const [displayScore, setDisplayScore] = useState(parseFloat(scenarios[0].score));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (phase !== "listening") return;
    /* Reduced-motion: skip the typewriter, jump straight to scored state */
    if (reducedMotion) {
      setTyped(scene.transcript);
      setPhase("done");
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(scene.transcript.slice(0, i));
      if (i >= scene.transcript.length) {
        clearInterval(id);
        setTimeout(() => setPhase("scoring"), 350);
        setTimeout(() => setPhase("done"), 1500);
      }
    }, 28);
    return () => clearInterval(id);
  }, [phase, scene.transcript, reducedMotion]);

  /* Score count-up on each new scored answer */
  useEffect(() => {
    if (phase !== "done") return;
    const target = parseFloat(scene.score);
    /* Reduced-motion: set final value instantly, no rAF loop */
    if (reducedMotion) {
      setDisplayScore(target);
      return;
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplayScore(Math.round(target * eased * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setDisplayScore(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, scene.score, idx, reducedMotion]);

  /* Auto-cycle scenarios — bounded + pausable per critique.
     - Bounded: stops after looping through every scenario once (autoLoops < scenarios.length).
       The previous infinite cycle competed with the H1 for attention forever.
     - Pausable: user can stop the rotation; survives until they tap "Try it" again.
     - First cycle delayed (4.5s instead of 6.2s the first tick) so the user has
       time to read the hero before the mock starts moving on its own. */
  const [autoPaused, setAutoPaused] = useState(false);
  const [autoLoops, setAutoLoops] = useState(0);
  useEffect(() => {
    if (phase !== "done" || reducedMotion || autoPaused) return;
    if (autoLoops >= scenarios.length) return;
    const delay = autoLoops === 0 ? 4500 : 6200;
    const id = setTimeout(() => {
      setIdx((i) => (i + 1) % scenarios.length);
      setAutoLoops((n) => n + 1);
      setPhase("done");
    }, delay);
    return () => clearTimeout(id);
  }, [phase, idx, scenarios.length, reducedMotion, autoPaused, autoLoops]);

  const start = () => {
    if (phase === "done") setIdx((i) => (i + 1) % scenarios.length);
    setTyped("");
    setPhase("listening");
    /* User-initiated → reset auto-cycle budget so they get fresh rotation */
    setAutoLoops(0);
    setAutoPaused(false);
  };

  const phaseLabel =
    phase === "idle"
      ? "Ready · tap Try it"
      : phase === "listening"
        ? "Live · 00:24"
        : phase === "scoring"
          ? "Scoring…"
          : "Scored · 00:31";

  const phaseColor =
    phase === "scoring" ? t.copper : phase === "done" ? t.indigo : t.success;

  /* Screen-reader narration for the silent visual phase machine */
  const liveAnnounce =
    phase === "listening"
      ? `AI is listening to your answer for ${scene.company} ${scene.round}.`
      : phase === "scoring"
        ? "Scoring your answer."
        : phase === "done"
          ? `Scored ${scene.score} out of 10. ${scene.fix}`
          : "Demo ready. Press Try it to start.";

  return (
    <div
      className="mv2-mock-card"
      role="region"
      aria-label="Live mock interview demo"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
        borderRadius: 20,
        background: t.white,
        border: `1px solid ${t.line}`,
        boxShadow: shadows.modal,
        overflow: "hidden",
      }}
    >
      {/* SR-only narration of the phase state machine (silent to sighted users) */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {liveAnnounce}
      </span>
      {/* Window chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderBottom: `1px solid ${t.line}`,
          background: t.creamSoft,
        }}
      >
        {[t.error, t.warning, t.success].map((color, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              opacity: 0.85,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 14,
            fontFamily: fonts.mono,
            fontSize: 12,
            color: t.inkFaint,
          }}
        >
          hirestepx.com/interview · {scene.round} · {scene.company}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: fonts.sans,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: t.inkFaint,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Round {String(idx + 1).padStart(2, "0")} / {String(scenarios.length).padStart(2, "0")}
        </span>
      </div>

      {/* Body */}
      <div className="mv2-hero-mock-body" style={{ display: "grid", gridTemplateColumns: "1fr 280px" }}>
        {/* Left: live transcript */}
        <div
          style={{
            padding: 32,
            borderRight: `1px solid ${t.line}`,
            background: t.white,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: fonts.sans,
                fontSize: 11,
                color: phaseColor,
                fontWeight: 600,
                padding: "4px 10px",
                background:
                  phase === "scoring"
                    ? t.copperSoft
                    : phase === "done"
                      ? t.indigo100
                      : t.success100,
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: phaseColor,
                  animation:
                    phase === "listening" ? "pulse 1s infinite" : undefined,
                }}
              />
              {phaseLabel}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
            </span>
            {phase === "listening" && <Waveform />}
            <button
              onClick={start}
              disabled={phase === "listening" || phase === "scoring"}
              style={{
                marginLeft: "auto",
                border: 0,
                cursor: phase === "idle" || phase === "done" ? "pointer" : "default",
                background: phase === "idle" || phase === "done" ? t.indigo : t.cream,
                color: phase === "idle" || phase === "done" ? t.white : t.inkFaint,
                fontFamily: fonts.sans,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                minHeight: 44,
                boxShadow:
                  phase === "idle" || phase === "done" ? shadows.cta : "none",
              }}
            >
              {phase === "done" ? "Replay" : phase === "idle" ? "Try it ▶" : "…"}
            </button>
            {/* Pause / Resume — only meaningful while auto-rotation is still
                budgeted and the user hasn't asked for reduced motion. Keeps
                the User Control & Freedom heuristic honest without adding
                chrome that does nothing 90% of the time. */}
            {!reducedMotion && phase === "done" && autoLoops < scenarios.length && (
              <button
                onClick={() => setAutoPaused((p) => !p)}
                aria-pressed={autoPaused}
                aria-label={autoPaused ? "Resume auto rotation" : "Pause auto rotation"}
                style={{
                  border: `1px solid ${t.lineStrong}`,
                  cursor: "pointer",
                  background: "transparent",
                  color: t.inkSoft,
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: 999,
                  minHeight: 44,
                }}
              >
                {autoPaused ? "Resume" : "Pause"}
              </button>
            )}
          </div>

          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.inkFaint,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              margin: 0,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            Interviewer
          </p>
          <p
            key={`question-${idx}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 18,
              color: t.coal,
              lineHeight: 1.55,
              margin: 0,
              marginBottom: 20,
              animation: `mv2-fade-up 0.55s ${ease} both`,
            }}
          >
            {scene.question}
          </p>

          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.copper,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              margin: 0,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            You
          </p>
          <p
            key={`transcript-${idx}-${phase}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 18,
              color: t.inkSoft,
              lineHeight: 1.55,
              margin: 0,
              minHeight: 80,
              animation:
                phase === "done"
                  ? `mv2-fade-up 0.6s ${ease} 80ms both`
                  : undefined,
            }}
          >
            {phase === "idle" ? (
              <span style={{ color: t.inkFaint, fontStyle: "italic" }}>
                Your answer appears here as you speak…
              </span>
            ) : (
              <>
                {phase === "done" ? scene.transcript : typed}
                {(phase === "listening" || phase === "done") && (
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 18,
                      background: t.copper,
                      verticalAlign: "text-bottom",
                      marginLeft: 2,
                      opacity: phase === "done" ? 0.5 : 1,
                      animation: "caret 1.1s steps(1) infinite",
                    }}
                  />
                )}
              </>
            )}
          </p>
          <style>{`@keyframes caret{50%{opacity:0}}`}</style>

          {phase === "done" && (
            <div style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: `1px solid ${t.line}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: `mv2-fade-up 0.5s ${ease} 600ms both`,
            }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: fonts.sans,
                fontSize: 11,
                color: t.indigo,
                fontWeight: 600,
                padding: "3px 10px",
                background: t.indigo100,
                borderRadius: 999,
              }}>
                3 follow-up questions ready
              </span>
              <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>
                Answer one to keep the round going
              </span>
            </div>
          )}
        </div>

        {/* Right: scored answer */}
        <div
          className="mv2-hero-mock-side"
          style={{
            padding: 24,
            background: t.cream,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.inkFaint,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Last answer
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              key={`score-${idx}-${phase}`}
              style={{
                fontFamily: fonts.serif,
                fontSize: 56,
                color: t.indigo,
                lineHeight: 1,
                opacity: phase === "done" ? 1 : 0.3,
                animation:
                  phase === "done"
                    ? `mv2-fade-up 0.55s ${ease} 200ms both`
                    : undefined,
              }}
            >
              {phase === "done" ? displayScore.toFixed(1) : "..."}
            </span>
            <span
              style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}
            >
              / 10
            </span>
          </div>

          {scene.bars.map(([label, val], i) => (
            <div key={label as string}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                <span>{label}</span>
                <span style={{ color: t.inkFaint }}>{val}</span>
              </div>
              <div
                style={{
                  height: 4,
                  background: t.copper100,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  key={`bar-${idx}-${i}-${phase}`}
                  style={{
                    width: `${val}%`,
                    height: "100%",
                    background:
                      (val as number) > 80
                        ? t.success
                        : (val as number) > 70
                          ? t.indigo
                          : t.copper,
                    transformOrigin: "left center",
                    animation:
                      phase === "done"
                        ? `mv2-bar-fill 0.9s ${ease} ${320 + i * 110}ms both`
                        : undefined,
                  }}
                />
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 4,
              padding: "12px 14px",
              background: t.copperSoft,
              border: `1px solid rgba(180,83,9,0.18)`,
              borderRadius: 10,
              fontFamily: fonts.sans,
              lineHeight: 1.5,
            }}
          >
            <span style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: t.copperDark,
              display: "block",
              marginBottom: 5,
            }}>Coach fix</span>
            <span style={{ fontSize: 13, color: t.coal }}>{scene.fix}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
