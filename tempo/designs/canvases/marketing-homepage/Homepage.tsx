/* HireStepX Homepage — full marketing landing.
   12-act story, editorial premium, motion-rich, India-first. */
import React, { useEffect, useRef, useState } from "react";
import { useInView, useCountUp, useScrollProgress, usePrefersReducedMotion } from "./motion";

/* ─────────────────────────  Shared keyframes  ───────────────────────── */
const KEYFRAMES = `
@keyframes hsx-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes hsx-word-in { from { opacity: 0; transform: translateY(40%); } to { opacity: 1; transform: none; } }
@keyframes hsx-pulse-dot { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: .55; } }
@keyframes hsx-heartbeat { 0%,28%,100% { transform: scale(1); opacity: .35; } 14% { transform: scale(1.08); opacity: .8; } }
@keyframes hsx-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(220%); } }
@keyframes hsx-wave { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
@keyframes hsx-shine { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
@keyframes hsx-flame { 0%,100% { transform: scale(1) rotate(-2deg); } 50% { transform: scale(1.08) rotate(3deg); } }
@keyframes hsx-spin { to { transform: rotate(360deg); } }
@keyframes hsx-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; }
}
`;

/* ─────────────────────────  Tokens  ───────────────────────── */
const T = {
  cream: "var(--cream, #FAF7F0)",
  creamSoft: "var(--cream-soft, #F4EFE3)",
  ink: "var(--coal, #0E0C08)",
  inkSoft: "var(--ink-soft, #6E6759)",
  inkFaint: "var(--ink-faint, #A39C8B)",
  indigo: "var(--indigo, #312E81)",
  indigoDeep: "var(--indigo-deep, #1E1B4B)",
  indigo100: "var(--indigo-100, #E5E2F2)",
  ring: "var(--indigo-ring, rgba(49,46,129,0.20))",
  copper: "var(--copper, #B45309)",
  copper100: "var(--copper-100, #F4E5D8)",
  success: "var(--success, #15803D)",
  success100: "var(--success-100, #DCFCE7)",
  error: "var(--error, #B91C1C)",
  line: "var(--line, #EBE5D2)",
  serif: '"Fraunces", "Playfair Display", "Source Serif Pro", Georgia, serif',
};

/* ─────────────────────────  Reveal wrapper  ───────────────────────── */
function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  ...rest
}: { children: React.ReactNode; delay?: number; as?: any } & React.HTMLAttributes<HTMLElement>) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      ref={ref as any}
      {...rest}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : "translateY(14px)",
        transition: `opacity 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms, transform 700ms cubic-bezier(.2,.7,.2,1) ${delay}ms`,
        ...(rest.style || {}),
      }}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────  Top nav + live bar  ───────────────────────── */
function TopBar() {
  const [practicing, setPracticing] = useState(523);
  const [crore, setCrore] = useState(47.2);
  useEffect(() => {
    const i = setInterval(() => {
      setPracticing((v) => v + (Math.random() > 0.55 ? 1 : -1));
      if (Math.random() > 0.85) setCrore((v) => +(v + 0.1).toFixed(1));
    }, 2200);
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(10px)", background: "rgba(250,247,240,0.85)", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", justifyContent: "center", padding: "8px 24px", borderBottom: `1px solid ${T.line}`, fontSize: 12, color: T.inkSoft }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.success, animation: "hsx-pulse-dot 2s ease-in-out infinite" }} />
          <strong style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{practicing}</strong> practicing right now
          <span style={{ margin: "0 10px", color: T.inkFaint }}>·</span>
          <strong style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>₹{crore.toFixed(1)} Cr</strong> in offers landed
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, letterSpacing: -0.3, color: T.ink }}>
          HireStep<span style={{ color: T.indigo, fontWeight: 800 }}>X</span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14, color: T.inkSoft }}>
          <a style={navLink}>Pricing</a>
          <a style={navLink}>Company guides</a>
          <a style={navLink}>Why HireStepX</a>
          <a style={navLink}>Login</a>
          <button style={primaryBtn}>Start free</button>
        </nav>
      </div>
    </div>
  );
}
const navLink: React.CSSProperties = { cursor: "pointer", textDecoration: "none", color: "inherit" };
const primaryBtn: React.CSSProperties = {
  background: T.indigo, color: "white", border: "none", padding: "10px 18px",
  borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
  boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 20px -12px rgba(49,46,129,0.55)",
  transition: "transform 180ms ease, box-shadow 180ms ease",
};

/* ─────────────────────────  Hero  ───────────────────────── */
function Hero() {
  const reduced = usePrefersReducedMotion();
  const words1 = ["Nail", "your", "next", "interview."];
  const words2 = ["Every", "single", "time."];
  const [audioPlaying, setAudioPlaying] = useState<"orig" | "coached" | null>(null);
  return (
    <section style={{ position: "relative", padding: "72px 32px 120px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: T.serif, fontSize: 84, lineHeight: 0.98, letterSpacing: -2, color: T.ink, margin: 0, fontWeight: 500 }}>
            <span style={{ display: "block", overflow: "hidden" }}>
              {words1.map((w, i) => (
                <span key={i} style={{ display: "inline-block", marginRight: 14, animation: reduced ? "none" : `hsx-word-in 600ms ${80 + i * 60}ms cubic-bezier(.2,.7,.2,1) both` }}>{w}</span>
              ))}
            </span>
            <span style={{ display: "block", color: T.inkSoft, overflow: "hidden" }}>
              {words2.map((w, i) => (
                <span key={i} style={{ display: "inline-block", marginRight: 14, animation: reduced ? "none" : `hsx-word-in 600ms ${360 + i * 60}ms cubic-bezier(.2,.7,.2,1) both` }}>
                  {w}{i === words2.length - 1 ? <span style={{ color: T.indigo }}>.</span> : null}
                </span>
              ))}
            </span>
          </h1>
          <Reveal delay={620}>
            <p style={{ fontSize: 19, color: T.inkSoft, marginTop: 22, maxWidth: 520 }}>
              Practice. Score. Improve. Built for Indian candidates — for ₹10 a session.
            </p>
          </Reveal>

          <Reveal delay={760}>
            <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
              <ProofPill icon="⭐">4.8/5 · 12,847 reviews</ProofPill>
              <ProofPill icon="📈">+31 avg score in 3 mocks</ProofPill>
              <ProofPill icon="🎯">67% land offers in 30 days</ProofPill>
            </div>
          </Reveal>

          <Reveal delay={900}>
            <div style={{ display: "flex", gap: 14, marginTop: 32, alignItems: "center", flexWrap: "wrap" }}>
              <button style={{ ...primaryBtn, padding: "16px 26px", fontSize: 15, borderRadius: 12 }}>
                Start free — 3 mocks included →
              </button>
              <button
                onClick={() => setAudioPlaying(audioPlaying === "orig" ? null : "orig")}
                style={ghostBtn}
              >
                <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: "50%", background: T.indigo, color: "white", alignItems: "center", justifyContent: "center", fontSize: 9 }}>▶</span>
                Hear a real coached answer (15s)
              </button>
            </div>
          </Reveal>

          {audioPlaying && (
            <Reveal>
              <AudioDiffPreview onClose={() => setAudioPlaying(null)} active={audioPlaying} setActive={setAudioPlaying} />
            </Reveal>
          )}

          <Reveal delay={1040}>
            <div style={{ marginTop: 22, fontSize: 13, color: T.inkSoft, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span>🔒 ISO 27001</span>
              <span>🇮🇳 DPDPA-compliant</span>
              <span>🚫 Your resume never trains a model</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={520}>
          <ProductMock />
        </Reveal>
      </div>
    </section>
  );
}

function ProofPill({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px",
      background: "white", border: `1px solid ${T.line}`, borderRadius: 999,
      fontSize: 13, color: T.ink, boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
    }}>
      <span>{icon}</span>{children}
    </span>
  );
}

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 10,
  background: "transparent", border: `1px solid ${T.line}`, padding: "14px 18px",
  borderRadius: 12, fontSize: 14, fontWeight: 500, color: T.ink, cursor: "pointer",
};

function AudioDiffPreview({ onClose, active, setActive }: { onClose: () => void; active: "orig" | "coached"; setActive: (v: "orig" | "coached") => void }) {
  return (
    <div style={{ marginTop: 18, padding: 18, background: "white", border: `1px solid ${T.line}`, borderRadius: 14, maxWidth: 520, boxShadow: "0 18px 40px -22px rgba(14,12,8,0.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, color: T.inkSoft, textTransform: "uppercase" }}>A/B audio diff</span>
        <button onClick={onClose} style={{ background: "none", border: 0, color: T.inkFaint, cursor: "pointer", fontSize: 18 }}>×</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button onClick={() => setActive("orig")} style={{ ...audioToggle, background: active === "orig" ? T.error + "12" : T.cream, borderColor: active === "orig" ? T.error : T.line, color: active === "orig" ? T.error : T.ink }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, opacity: 0.7 }}>ORIGINAL</span>
          <Waveform color={T.error} active={active === "orig"} jagged />
          <span style={{ fontSize: 12 }}>"Uh… so basically we worked on this thing…"</span>
        </button>
        <button onClick={() => setActive("coached")} style={{ ...audioToggle, background: active === "coached" ? T.success + "12" : T.cream, borderColor: active === "coached" ? T.success : T.line, color: active === "coached" ? T.success : T.ink }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, opacity: 0.7 }}>COACHED</span>
          <Waveform color={T.success} active={active === "coached"} />
          <span style={{ fontSize: 12 }}>"I led a 4-engineer team that cut deploy time 43%."</span>
        </button>
      </div>
    </div>
  );
}
const audioToggle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 10,
  border: `1px solid ${T.line}`, cursor: "pointer", textAlign: "left",
  transition: "all 200ms ease",
};

function Waveform({ color, active, jagged }: { color: string; active: boolean; jagged?: boolean }) {
  const bars = jagged ? [0.4, 0.9, 0.3, 0.7, 0.2, 0.85, 0.35, 0.6, 0.25, 0.8, 0.4, 0.65] : [0.6, 0.8, 0.5, 0.9, 0.55, 0.85, 0.6, 0.95, 0.5, 0.8, 0.6, 0.75];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {bars.map((h, i) => (
        <span key={i} style={{
          width: 3, background: color, borderRadius: 2, height: `${h * 100}%`,
          transformOrigin: "center", animation: active ? `hsx-wave 1.1s ease-in-out ${i * 60}ms infinite` : "none",
          opacity: active ? 1 : 0.55,
        }} />
      ))}
    </div>
  );
}

/* ─────────────────────────  Product mock (right column of hero)  ───────────────────────── */
function ProductMock() {
  const [stage, setStage] = useState(0); // 0 parse, 1 picker, 2 mock, 3 score
  useEffect(() => {
    const i = setInterval(() => setStage((s) => (s + 1) % 4), 2200);
    return () => clearInterval(i);
  }, []);
  return (
    <div style={{
      position: "relative", borderRadius: 18, background: "white",
      border: `1px solid ${T.line}`, boxShadow: "0 30px 80px -30px rgba(14,12,8,0.25), 0 8px 18px -8px rgba(14,12,8,0.08)",
      overflow: "hidden", aspectRatio: "1.18", transform: "rotate(0.4deg)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderBottom: `1px solid ${T.line}`, background: T.creamSoft }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
        <span style={{ marginLeft: 10, fontSize: 11, color: T.inkFaint }}>app.hirestepx.com/interview</span>
      </div>
      <div style={{ position: "relative", height: "calc(100% - 32px)", padding: 22 }}>
        {stage === 0 && <MockResume />}
        {stage === 1 && <MockPicker />}
        {stage === 2 && <MockInterview />}
        {stage === 3 && <MockScore />}
        <div style={{ position: "absolute", left: 22, right: 22, bottom: 18, display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === stage ? T.indigo : T.line, transition: "background 300ms" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MockResume() {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>Parsing your resume…</div>
      <div style={{ position: "relative", padding: 14, background: T.creamSoft, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ height: 8, background: T.line, borderRadius: 4, marginBottom: 8, width: "65%" }} />
        <div style={{ height: 6, background: T.line, borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 6, background: T.line, borderRadius: 4, marginBottom: 6, width: "85%" }} />
        <div style={{ height: 6, background: T.line, borderRadius: 4, marginBottom: 14, width: "70%" }} />
        <div style={{ height: 6, background: T.line, borderRadius: 4, marginBottom: 6, width: "92%" }} />
        <div style={{ height: 6, background: T.line, borderRadius: 4, marginBottom: 6, width: "78%" }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 24, background: `linear-gradient(180deg, transparent, ${T.indigo}30, transparent)`, animation: "hsx-scan 1.8s ease-in-out infinite" }} />
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["React", "TypeScript", "AWS", "Cut deploy 43%", "Razorpay"].map((t) => (
          <span key={t} style={{ fontSize: 11, padding: "4px 10px", background: T.indigo100, color: T.indigo, borderRadius: 999, fontWeight: 500 }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function MockPicker() {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>Pick your target</div>
      <div style={{ padding: 14, border: `1px solid ${T.line}`, borderRadius: 10, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: T.inkFaint }}>Role</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>SDE-2</div>
        </div>
        <span style={{ fontSize: 11, color: T.indigo }}>Change</span>
      </div>
      <div style={{ padding: 14, border: `1px solid ${T.indigo}`, borderRadius: 10, background: T.indigo100, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: T.inkFaint }}>Company</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.indigo }}>Flipkart</div>
        </div>
        <span style={{ fontSize: 11, color: T.indigo }}>Bangalore</span>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: T.inkSoft }}>~12 questions tailored · 45 min · ₹10</div>
    </div>
  );
}

function MockInterview() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, ${T.indigo}, ${T.indigoDeep})`, position: "relative" }}>
          <div style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px solid ${T.indigo}40`, animation: "hsx-pulse-dot 1.6s ease-in-out infinite" }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>AI Interviewer</div>
          <div style={{ fontSize: 10, color: T.inkSoft }}>Speaking…</div>
        </div>
      </div>
      <div style={{ padding: 12, background: T.creamSoft, borderRadius: 10, fontSize: 12, color: T.ink }}>
        "Walk me through how you'd design Big Billion Day cart for 10× traffic."
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 3, height: 32, alignItems: "center" }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={{ width: 3, height: `${30 + Math.sin(i) * 50 + 30}%`, background: T.indigo, borderRadius: 2, animation: `hsx-wave 1s ease-in-out ${i * 50}ms infinite` }} />
        ))}
      </div>
    </div>
  );
}

function MockScore() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const score = useCountUp(87, 1400, inView);
  return (
    <div ref={ref}>
      <div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 10 }}>Your score</div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ position: "relative", width: 92, height: 92 }}>
          <svg viewBox="0 0 100 100" width="92" height="92">
            <circle cx="50" cy="50" r="42" fill="none" stroke={T.line} strokeWidth="6" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={T.indigo} strokeWidth="6"
              strokeDasharray={`${(2 * Math.PI * 42 * score) / 100} ${2 * Math.PI * 42}`}
              strokeLinecap="round" transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dasharray 300ms ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.serif, fontSize: 28, fontWeight: 600 }}>
            {Math.round(score)}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {[
            ["Communication", 0.86],
            ["Structure", 0.92],
            ["Depth", 0.78],
            ["Confidence", 0.81],
          ].map(([label, v], i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.inkSoft, marginBottom: 2 }}>
                <span>{label}</span><span>{Math.round((v as number) * 100)}</span>
              </div>
              <div style={{ height: 4, background: T.line, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: inView ? `${(v as number) * 100}%` : 0, height: "100%", background: T.indigo, transition: `width 800ms ${i * 100}ms cubic-bezier(.2,.7,.2,1)` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  Pinned story (Acts 2.1–2.4)  ───────────────────────── */
function PinnedStory() {
  const { ref, p } = useScrollProgress<HTMLDivElement>();
  // p in 0..1 — split into 4 scenes
  const scene = Math.min(3, Math.floor(p * 4));
  return (
    <section ref={ref} style={{ position: "relative", height: "320vh", background: T.indigoDeep, color: "white" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, overflow: "hidden" }}>
        {/* Progress dots */}
        <div style={{ position: "absolute", top: 32, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{
              width: i === scene ? 32 : 8, height: 8, borderRadius: 999,
              background: i <= scene ? "white" : "rgba(255,255,255,0.25)",
              transition: "all 400ms cubic-bezier(.2,.7,.2,1)",
            }} />
          ))}
        </div>
        <div style={{ maxWidth: 920, width: "100%" }}>
          {scene === 0 && <SceneFear />}
          {scene === 1 && <SceneMirror />}
          {scene === 2 && <SceneCoach />}
          {scene === 3 && <SceneTransform />}
        </div>
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 2, textTransform: "uppercase" }}>
          Scroll to continue
        </div>
      </div>
    </section>
  );
}

function SceneFear() {
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 480, height: 480, background: "radial-gradient(circle, rgba(220,38,38,0.25), transparent 60%)", animation: "hsx-heartbeat 1.4s ease-in-out infinite", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ fontFamily: "ui-monospace, SF Mono, Menlo, monospace", fontSize: 28, color: "rgba(255,255,255,0.85)", position: "relative" }}>
        Your next interview is in <span style={{ color: "#FF8A8A" }}>6 days</span>.
      </div>
      <div style={{ marginTop: 22, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>You know the tech. The question is whether you can say it.</div>
    </div>
  );
}

function SceneMirror() {
  return (
    <div>
      <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>The mirror</div>
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>Interviewer: <em>"Tell me about a time you led a project."</em></div>
        <div style={{ fontFamily: T.serif, fontSize: 26, lineHeight: 1.45, fontStyle: "italic" }}>
          "Uh… so <Underline>basically</Underline> we worked on this <Underline>thing</Underline>… <Underline>we</Underline> had a deadline… <Underline>we</Underline> shipped it."
        </div>
      </div>
      <div style={{ marginTop: 18, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>This is how 80% of answers sound. Recruiters disengage in 14 seconds.</div>
    </div>
  );
}
function Underline({ children }: { children: React.ReactNode }) {
  return <span style={{ background: "linear-gradient(180deg, transparent 70%, rgba(220,38,38,0.55) 70%)" }}>{children}</span>;
}

function SceneCoach() {
  const [active, setActive] = useState<"orig" | "coached">("coached");
  return (
    <div>
      <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>The coach appears</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {(["orig", "coached"] as const).map((k) => {
          const isOrig = k === "orig";
          const c = isOrig ? "#F87171" : "#86EFAC";
          return (
            <button key={k} onClick={() => setActive(k)} style={{
              background: active === k ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${active === k ? c : "rgba(255,255,255,0.12)"}`,
              borderRadius: 14, padding: 18, color: "white", textAlign: "left", cursor: "pointer",
              transition: "all 250ms ease",
            }}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: c, fontWeight: 600, marginBottom: 10 }}>{isOrig ? "ORIGINAL" : "COACHED"}</div>
              <Waveform color={c} active={active === k} jagged={isOrig} />
              <div style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                {isOrig ? `"Uh… basically we shipped it."` : `"I led a 4-engineer team that cut deploy time by 43%."`}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 18, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
        <strong style={{ color: "white" }}>STAR rewrite:</strong> Situation → Task → Action → <strong style={{ color: "#86EFAC" }}>Result: 43%</strong>.
      </div>
    </div>
  );
}

function SceneTransform() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const score = useCountUp(87, 1600, inView);
  const start = 42;
  return (
    <div ref={ref} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>The transformation</div>
        <div style={{ fontFamily: T.serif, fontSize: 56, lineHeight: 1, fontWeight: 500 }}>
          {Math.round(start + (score - start) / (87 / (87 - start)) * 0)}{/* placeholder */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "#F87171", textDecoration: "line-through", opacity: 0.6 }}>{start}</span>
            <span style={{ fontSize: 32, color: "rgba(255,255,255,0.5)" }}>→</span>
            <span style={{ color: "#86EFAC" }}>{Math.round(score)}</span>
          </span>
        </div>
        <div style={{ marginTop: 18, fontSize: 14, color: "rgba(255,255,255,0.65)" }}>
          Median SDE-2 in <strong style={{ color: "white" }}>Bangalore</strong>: ₹28-34 LPA.<br/>
          Your coached answer adds ~<strong style={{ color: "#86EFAC" }}>₹3.2 LPA</strong> in salary signal.
        </div>
        <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(180,83,9,0.18)", border: "1px solid rgba(180,83,9,0.4)", borderRadius: 999 }}>
          <span style={{ fontSize: 18, animation: "hsx-flame 1.4s ease-in-out infinite", display: "inline-block" }}>🔥</span>
          <span style={{ fontSize: 13 }}>Day 7 streak — keep it going</span>
        </div>
      </div>
      <SkillRadar inView={inView} />
    </div>
  );
}

function SkillRadar({ inView }: { inView: boolean }) {
  const axes = ["Comm", "Structure", "Depth", "Confidence", "Specificity", "Pace"];
  const values = [0.88, 0.92, 0.78, 0.82, 0.86, 0.74];
  const cx = 140, cy = 140, r = 100;
  const points = values.map((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    const rr = inView ? r * v : 0;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  return (
    <svg viewBox="0 0 280 280" width="100%" style={{ maxWidth: 320 }}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon key={s} points={axes.map((_, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
          return `${cx + Math.cos(a) * r * s},${cy + Math.sin(a) * r * s}`;
        }).join(" ")} fill="none" stroke="rgba(255,255,255,0.12)" />
      ))}
      <polygon points={points.map((p) => p.join(",")).join(" ")} fill="rgba(134,239,172,0.25)" stroke="#86EFAC" strokeWidth="2" style={{ transition: "all 1200ms cubic-bezier(.2,.7,.2,1)" }} />
      {axes.map((a, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
        return <text key={a} x={cx + Math.cos(ang) * (r + 18)} y={cy + Math.sin(ang) * (r + 18)} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle" dominantBaseline="middle">{a}</text>;
      })}
    </svg>
  );
}

/* ─────────────────────────  Intent router (Act 3)  ───────────────────────── */
function IntentRouter() {
  const cards = [
    { icon: "🎓", title: "Campus Placement", line: "Final year, first job. TCS, Infosys, Flipkart.", stat: "4,200+ TCS NQT clears · 38% offer rate" },
    { icon: "💼", title: "Switching Jobs", line: "Senior IC, targeting Google / Amazon / Razorpay.", stat: "Avg ₹6.4 LPA jump · 21-day median prep" },
    { icon: "🔁", title: "Career Change", line: "Pivoting roles. Make recruiters believe you.", stat: "73% land within 2 months · 14 pivot tracks" },
    { icon: "💰", title: "Salary Negotiation", line: "Got the offer. Now get paid what you're worth.", stat: "Avg ₹4.1 LPA negotiated up · 12,000+ sessions" },
  ];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>Choose your path</div>
        <h2 style={h2}>Tell us where you are.<br /><span style={{ color: T.inkSoft }}>We'll show you the path.</span></h2>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 48 }}>
        {cards.map((c, i) => (
          <Reveal key={c.title} delay={i * 80}>
            <button style={intentCard} onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-6px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
              <div style={{ fontSize: 36 }}>{c.icon}</div>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, marginTop: 14 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 8, lineHeight: 1.55 }}>{c.line}</div>
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.indigo, fontWeight: 600 }}>{c.stat}</div>
            </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
const intentCard: React.CSSProperties = {
  background: "white", border: `1px solid ${T.line}`, borderRadius: 16, padding: 24,
  textAlign: "left", cursor: "pointer", transition: "all 280ms cubic-bezier(.2,.7,.2,1)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
};
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: 2, color: T.copper, textTransform: "uppercase" };
const h2: React.CSSProperties = { fontFamily: T.serif, fontSize: 56, lineHeight: 1.05, letterSpacing: -1.5, color: T.ink, fontWeight: 500, margin: "16px 0 0" };

/* ─────────────────────────  Bento grid (Act 4)  ───────────────────────── */
function Bento() {
  const tiles: { title: string; sub: string; tag: "Free" | "Pro"; span?: string; visual: React.ReactNode }[] = [
    { title: "Resume → real questions in 30s", sub: "AI asks about your projects, not generic ones.", tag: "Free", span: "1 / span 2", visual: <BentoVisualResume /> },
    { title: "Pick any company, any role", sub: "50+ companies, role-specific rubrics.", tag: "Free", visual: <BentoVisualPicker /> },
    { title: "Listens, scores, remembers", sub: "Voice mock with skill radar + history.", tag: "Pro", visual: <BentoVisualMock /> },
    { title: "STAR coaching, side-by-side", sub: "Hear your answer. Then hear the rewrite.", tag: "Pro", span: "span 2", visual: <BentoVisualSTAR /> },
    { title: "Skill decay tracker", sub: "Practice the skill that's slipping today.", tag: "Pro", visual: <BentoVisualDecay /> },
    { title: "Hindi · English · Hinglish", sub: "Switch mid-interview. Real bilingual feedback.", tag: "Free", visual: <BentoVisualLang /> },
  ];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>What you actually get</div>
        <h2 style={h2}>Real product. Real feedback.<br /><span style={{ color: T.inkSoft }}>No "magic" — just rubrics + voice + memory.</span></h2>
      </Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "minmax(280px, auto)", gap: 16, marginTop: 48 }}>
        {tiles.map((t, i) => (
          <Reveal key={t.title} delay={i * 60} style={{ gridColumn: t.span }}>
            <BentoTile {...t} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
function BentoTile({ title, sub, tag, visual }: { title: string; sub: string; tag: "Free" | "Pro"; visual: React.ReactNode }) {
  return (
    <div style={{
      background: "white", border: `1px solid ${T.line}`, borderRadius: 18, padding: 22,
      display: "flex", flexDirection: "column", gap: 12, height: "100%",
      transition: "transform 280ms ease, box-shadow 280ms ease", cursor: "pointer",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 30px 60px -30px rgba(14,12,8,0.18)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 22, lineHeight: 1.2, fontWeight: 600, color: T.ink, letterSpacing: -0.4 }}>{title}</div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>{sub}</div>
        </div>
        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, background: tag === "Free" ? T.success100 : T.indigo100, color: tag === "Free" ? T.success : T.indigo, fontWeight: 600, letterSpacing: 0.5 }}>{tag}</span>
      </div>
      <div style={{ flex: 1, background: T.creamSoft, borderRadius: 12, overflow: "hidden", position: "relative", padding: 16 }}>
        {visual}
      </div>
    </div>
  );
}
function BentoVisualResume() {
  return (
    <div>
      <div style={{ fontSize: 11, color: T.inkFaint }}>Resume.pdf</div>
      <div style={{ marginTop: 8, padding: 10, background: "white", borderRadius: 8, position: "relative", overflow: "hidden" }}>
        {[0.7, 0.4, 0.85, 0.6].map((w, i) => (
          <div key={i} style={{ height: 5, background: T.line, borderRadius: 3, marginBottom: 5, width: `${w * 100}%` }} />
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, height: 18, background: `linear-gradient(180deg, transparent, ${T.indigo}30, transparent)`, animation: "hsx-scan 2.6s ease-in-out infinite" }} />
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Cut deploy 43%", "React 19", "Razorpay", "+ 12 more"].map((t) => (
          <span key={t} style={{ fontSize: 10, padding: "3px 8px", background: T.indigo100, color: T.indigo, borderRadius: 6, fontWeight: 500 }}>{t}</span>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: 10, background: T.indigo, color: "white", borderRadius: 8, fontSize: 12 }}>
        Q1: <em>"Walk me through how you cut deploy time by 43%."</em>
      </div>
    </div>
  );
}
function BentoVisualPicker() {
  const [pick, setPick] = useState(0);
  const opts = ["Flipkart", "Google", "TCS", "Razorpay"];
  useEffect(() => { const i = setInterval(() => setPick((v) => (v + 1) % opts.length), 1600); return () => clearInterval(i); }, []);
  return (
    <div>
      <div style={{ fontSize: 11, color: T.inkFaint, marginBottom: 8 }}>Target company</div>
      {opts.map((o, i) => (
        <div key={o} style={{
          padding: "10px 12px", marginBottom: 6, borderRadius: 8,
          border: `1px solid ${pick === i ? T.indigo : T.line}`,
          background: pick === i ? T.indigo100 : "white",
          color: pick === i ? T.indigo : T.ink, fontSize: 13, fontWeight: pick === i ? 600 : 400,
          transition: "all 300ms ease",
          display: "flex", justifyContent: "space-between",
        }}>
          <span>{o}</span>{pick === i && <span>✓</span>}
        </div>
      ))}
    </div>
  );
}
function BentoVisualMock() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", height: "100%" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, ${T.indigo}, ${T.indigoDeep})`, position: "relative" }}>
        <div style={{ position: "absolute", inset: -6, borderRadius: "50%", border: `2px solid ${T.indigo}30`, animation: "hsx-pulse-dot 1.6s ease-in-out infinite" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 2, height: 36, alignItems: "center" }}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} style={{ width: 3, background: T.indigo, borderRadius: 2, height: `${30 + (i * 13) % 70}%`, animation: `hsx-wave 1s ease-in-out ${i * 70}ms infinite` }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 8 }}>"Tell me about a tradeoff you made…"</div>
      </div>
    </div>
  );
}
function BentoVisualSTAR() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, height: "100%" }}>
      <div style={{ padding: 12, background: "white", borderRadius: 8, border: `1px solid ${T.error}30` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.error, letterSpacing: 1 }}>ORIGINAL</div>
        <Waveform color={T.error} active jagged />
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 6 }}>"basically we shipped it…"</div>
      </div>
      <div style={{ padding: 12, background: "white", borderRadius: 8, border: `1px solid ${T.success}30` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.success, letterSpacing: 1 }}>COACHED</div>
        <Waveform color={T.success} active />
        <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 6 }}>"Cut deploy time by 43%."</div>
      </div>
    </div>
  );
}
function BentoVisualDecay() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>
        <span>Behavioral score</span><span style={{ color: T.error }}>−12% / week</span>
      </div>
      <svg viewBox="0 0 200 60" width="100%" height="60">
        <path d="M 0 10 Q 50 12, 80 25 T 140 38 T 200 50" stroke={T.indigo} strokeWidth="2" fill="none" />
        <path d="M 0 10 Q 50 12, 80 25 T 140 38 T 200 50 L 200 60 L 0 60 Z" fill={T.indigo} fillOpacity="0.1" />
      </svg>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: T.copper100, borderRadius: 8 }}>
        <span style={{ animation: "hsx-flame 1.4s ease-in-out infinite", display: "inline-block" }}>🔥</span>
        <span style={{ fontSize: 11, color: T.copper, fontWeight: 600 }}>Practice today to keep the streak</span>
      </div>
    </div>
  );
}
function BentoVisualLang() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["EN", "हिं", "Hinglish"].map((l, i) => (
          <span key={l} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: i === 2 ? T.indigo : "white", color: i === 2 ? "white" : T.ink, border: `1px solid ${T.line}` }}>{l}</span>
        ))}
      </div>
      <div style={{ padding: 10, background: "white", borderRadius: 8, fontSize: 12 }}>"Mujhe lagta hai <strong style={{ color: T.indigo }}>scalability</strong> ka issue tha…"</div>
      <div style={{ padding: 10, background: T.success100, borderRadius: 8, fontSize: 11, color: T.success }}>✓ Bilingual feedback ready</div>
    </div>
  );
}

/* ─────────────────────────  Company-aware preview (Act 5)  ───────────────────────── */
function CompanyPreview() {
  const companies = ["TCS", "Flipkart", "Google", "Razorpay", "Amazon", "Goldman", "Deloitte"];
  const [active, setActive] = useState(1);
  const [city, setCity] = useState(0);
  const cities = ["Bangalore", "Pune", "Hyderabad", "Mumbai"];
  const data = [
    { q: '"Walk me through TCS NQT verbal section strategy."', tags: ["Aptitude", "30 min", "Fresher"], salary: "₹3.5–7 LPA", look: ["Quant speed", "Coding basics", "English clarity"] },
    { q: '"Walk me through how you\'d design Big Billion Day cart for 10× traffic."', tags: ["System design", "45 min", "L4 SDE"], salary: "₹28–34 LPA", look: ["Tradeoff articulation", "Write-amplification mention", "Cost vs latency framing"] },
    { q: '"Design a URL shortener that handles 100M URLs/day."', tags: ["System design", "45 min", "L4"], salary: "₹45–60 LPA", look: ["Capacity estimation", "DB partitioning choice", "Cache invalidation"] },
    { q: '"How would you scale UPI payments for festival traffic?"', tags: ["System design", "45 min", "Sr SDE"], salary: "₹30–42 LPA", look: ["Idempotency", "Reconciliation", "Webhook reliability"] },
    { q: '"LP question: Tell me about a time you raised the bar."', tags: ["Behavioral", "30 min", "L5"], salary: "$130K base", look: ["LP mapping", "Quant impact", "Counterfactual"] },
    { q: '"Walk me through pricing a complex derivatives book."', tags: ["Quant + Behavioral", "60 min", "Analyst"], salary: "₹22–35 LPA", look: ["Math precision", "Risk awareness", "Communication"] },
    { q: '"Estimate market size for EVs in Tier-2 cities."', tags: ["Case", "45 min", "Consultant"], salary: "₹16–22 LPA", look: ["Structured framework", "Number sense", "Hypothesis testing"] },
  ];
  const d = data[active];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>Built for Indian recruiters</div>
        <h2 style={h2}>See exactly what they ask.<br /><span style={{ color: T.inkSoft }}>And what they grade you on.</span></h2>
      </Reveal>
      <Reveal delay={120}>
        <div style={{ marginTop: 36, display: "inline-flex", padding: 4, background: T.creamSoft, border: `1px solid ${T.line}`, borderRadius: 999, position: "relative" }}>
          {companies.map((c, i) => (
            <button key={c} onClick={() => setActive(i)} style={{
              padding: "10px 18px", borderRadius: 999, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: active === i ? "white" : "transparent", color: active === i ? T.indigo : T.inkSoft,
              boxShadow: active === i ? "0 4px 14px -4px rgba(14,12,8,0.15)" : "none",
              transition: "all 280ms cubic-bezier(.2,.7,.2,1)",
            }}>{c}</button>
          ))}
        </div>
      </Reveal>
      <Reveal delay={200}>
        <div style={{ marginTop: 28, padding: 32, background: "white", border: `1px solid ${T.line}`, borderRadius: 18, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: T.copper, textTransform: "uppercase" }}>Sample question</div>
            <div style={{ fontFamily: T.serif, fontSize: 28, lineHeight: 1.3, marginTop: 12, color: T.ink }}>{d.q}</div>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {d.tags.map((t) => <span key={t} style={pillTag}>{t}</span>)}
            </div>
            <div style={{ marginTop: 28, paddingTop: 22, borderTop: `1px solid ${T.line}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: T.copper, textTransform: "uppercase", marginBottom: 10 }}>What recruiters look for</div>
              {d.look.map((l) => (
                <div key={l} style={{ display: "flex", gap: 10, padding: "8px 0", fontSize: 14, color: T.ink }}>
                  <span style={{ color: T.success }}>✓</span>{l}
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: T.creamSoft, borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: T.copper, textTransform: "uppercase" }}>Median CTC at this role</div>
            <div style={{ fontFamily: T.serif, fontSize: 36, marginTop: 8, color: T.indigo, fontWeight: 600 }}>{d.salary}</div>
            <div style={{ marginTop: 18, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {cities.map((c, i) => (
                <button key={c} onClick={() => setCity(i)} style={{
                  padding: "6px 12px", borderRadius: 999, border: `1px solid ${city === i ? T.indigo : T.line}`,
                  background: city === i ? T.indigo : "white", color: city === i ? "white" : T.ink,
                  fontSize: 12, cursor: "pointer", fontWeight: 500,
                }}>{c}</button>
              ))}
            </div>
            <div style={{ marginTop: 22, padding: 14, background: "white", borderRadius: 10, fontSize: 12, color: T.inkSoft }}>
              <strong style={{ color: T.ink }}>Hiring window:</strong> Sep–Nov peak.<br/>
              <strong style={{ color: T.ink }}>Format:</strong> 4 rounds, 1 bar-raiser.
            </div>
            <button style={{ marginTop: 22, ...primaryBtn, width: "100%", justifyContent: "center", display: "flex" }}>See 12 more questions →</button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
const pillTag: React.CSSProperties = { fontSize: 11, padding: "5px 12px", background: T.indigo100, color: T.indigo, borderRadius: 999, fontWeight: 600 };

/* ─────────────────────────  Comparison band (Act 6)  ───────────────────────── */
function Comparison() {
  const rows = [
    ["Hears your voice", "✗", "partial", "✓", "✓"],
    ["Times you, scores you", "✗", "✓", "✓", "✓"],
    ["Remembers your weaknesses", "✗", "✗", "partial", "✓ skill decay"],
    ["Indian companies (TCS / Flipkart)", "generic", "weak", "varies", "✓ deep"],
    ["Hindi / Hinglish", "partial", "✗", "varies", "✓"],
    ["Price", "₹1,800/mo", "~₹2,400/mo", "₹3-8K / hr", "₹149/mo"],
  ];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1080, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>The honest comparison</div>
        <h2 style={h2}>Why not just use ChatGPT?</h2>
      </Reveal>
      <Reveal delay={120}>
        <div style={{ marginTop: 40, background: "white", border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4, 1fr)", padding: "16px 22px", borderBottom: `1px solid ${T.line}`, background: T.creamSoft, fontSize: 12, fontWeight: 600, color: T.inkSoft, letterSpacing: 0.5 }}>
            <span></span><span>ChatGPT</span><span>Final Round AI</span><span>Human Coach</span>
            <span style={{ color: T.indigo }}>HireStepX</span>
          </div>
          {rows.map((r, i) => (
            <Reveal key={i} delay={i * 70}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4, 1fr)", padding: "18px 22px", borderBottom: i < rows.length - 1 ? `1px solid ${T.line}` : "none", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: T.ink, fontWeight: 500 }}>{r[0]}</span>
                {r.slice(1, 5).map((cell, j) => {
                  const isUs = j === 3;
                  const isCheck = cell === "✓" || cell.startsWith("✓");
                  const color = isUs ? T.indigo : isCheck ? T.success : cell === "✗" ? T.error : T.inkSoft;
                  return (
                    <span key={j} style={{
                      color, fontWeight: isUs ? 600 : 400,
                      background: isUs ? T.indigo100 : "transparent",
                      padding: isUs ? "8px 12px" : 0, borderRadius: 8,
                    }}>{cell}</span>
                  );
                })}
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────  Founder moment (Act 7)  ───────────────────────── */
function Founder() {
  return (
    <section style={{ padding: "120px 32px", background: T.creamSoft, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 56, alignItems: "center" }}>
        <Reveal>
          <div style={{ position: "relative", aspectRatio: "1", borderRadius: 14, overflow: "hidden", background: `linear-gradient(135deg, ${T.indigo}, ${T.indigoDeep})`, boxShadow: "0 30px 60px -30px rgba(14,12,8,0.4)" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)", fontSize: 80, fontFamily: T.serif }}>JV</div>
            <button style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 64, height: 64, borderRadius: "50%", border: 0, background: "rgba(255,255,255,0.95)", color: T.indigo, fontSize: 22, cursor: "pointer", boxShadow: "0 12px 30px -6px rgba(0,0,0,0.3)" }}>▶</button>
          </div>
        </Reveal>
        <Reveal delay={140}>
          <div style={eyebrow}>Why we built this</div>
          <p style={{ fontFamily: T.serif, fontSize: 26, lineHeight: 1.45, color: T.ink, marginTop: 18, fontWeight: 400 }}>
            "I bombed <strong>4 Google interviews</strong> in 2022. Knew the answers, choked anyway. The thing nobody tells you: <em>interviewing is a separate skill from your job.</em> So we built a place to practice it the way pilots practice in simulators — boring, repeatable, with feedback."
          </p>
          <div style={{ marginTop: 22, fontSize: 13, color: T.inkSoft, display: "flex", alignItems: "center", gap: 12 }}>
            <span>— Jay V.</span><span style={{ color: T.inkFaint }}>·</span>
            <span>Built in Bengaluru · ~14 people · ex-Razorpay, Cred, Swiggy</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  Testimonials (Act 8)  ───────────────────────── */
function Testimonials() {
  const tests = [
    { name: "Rahul M.", tier: "Tier-2 college", outcome: "Cleared TCS NQT on first attempt", quote: "I didn't even know how interviews flowed. After 5 mocks, the format felt natural.", initials: "RM", color: "#312E81" },
    { name: "Aisha J.", tier: "NIT Trichy", outcome: "Flipkart SDE-2 after 3 rejections", quote: "The Flipkart-specific questions were almost the same as my real loop. I knew what to expect.", initials: "AJ", color: "#7C2D12" },
    { name: "Vikram S.", tier: "IIIT Hyderabad", outcome: "Razorpay Backend, ₹38 LPA", quote: "System design feedback caught my hand-waving. Real coach voice — not a chatbot.", initials: "VS", color: "#15803D" },
    { name: "Sneha P.", tier: "4-yr exp", outcome: "Deloitte offer, +40% salary jump", quote: "The negotiation simulator gave me lines I actually used. Got 14 lakh more.", initials: "SP", color: "#B45309" },
    { name: "Priya K.", tier: "Tier-3 college", outcome: "First job, ₹6.5 LPA", quote: "First in my family to land a corporate job. The Hindi-Hinglish toggle was everything.", initials: "PK", color: "#7E22CE" },
    { name: "Marcus T.", tier: "5-yr exp", outcome: "Google L4", quote: "Two weeks of structured prep. The skill radar told me where to focus, daily.", initials: "MT", color: "#1E40AF" },
  ];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1280, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>Real candidates. Real offers.</div>
        <h2 style={h2}>Names you can verify.<br /><span style={{ color: T.inkSoft }}>No paid testimonials.</span></h2>
      </Reveal>
      <Reveal delay={120}>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {tests.map((t, i) => (
            <div key={t.name} style={{
              background: "white", border: `1px solid ${T.line}`, borderRadius: 14, padding: 22,
              display: "flex", flexDirection: "column", gap: 12,
              transition: "transform 250ms ease",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: t.color, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: T.inkSoft }}>{t.tier}</div>
                </div>
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 17, color: T.indigo, fontWeight: 600, lineHeight: 1.3 }}>{t.outcome}</div>
              <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.55 }}>"{t.quote}"</div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={200}>
        <div style={{ marginTop: 56, paddingTop: 36, borderTop: `1px solid ${T.line}` }}>
          <div style={{ fontSize: 11, color: T.inkFaint, letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 24 }}>Offers landed at</div>
          <div style={{ overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)" }}>
            <div style={{ display: "flex", gap: 56, animation: "hsx-marquee 30s linear infinite", width: "fit-content" }}>
              {[..."Google · Microsoft · Amazon · Meta · Flipkart · Razorpay · TCS · Infosys · McKinsey · Deloitte · Goldman · Swiggy · Zomato · Cred".split(" · "), ..."Google · Microsoft · Amazon · Meta · Flipkart · Razorpay · TCS · Infosys · McKinsey · Deloitte · Goldman · Swiggy · Zomato · Cred".split(" · ")].map((c, i) => (
                <span key={i} style={{ fontFamily: T.serif, fontSize: 22, color: T.inkFaint, whiteSpace: "nowrap" }}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────  Pricing (Act 9)  ───────────────────────── */
function Pricing() {
  const [yearly, setYearly] = useState(false);
  const monthly = 149;
  const yearlyPrice = 1430;
  const display = yearly ? Math.round(yearlyPrice / 12) : monthly;
  const perDay = (display / 30).toFixed(2);
  const tiers = [
    { name: "Free", price: 0, items: ["3 mocks", "STAR coaching", "Basic feedback"], cta: "Start free" },
    { name: "Pro", price: display, items: ["Unlimited mocks", "All interview types", "Skill decay tracker", "Audio A/B diff", "Hindi · Hinglish", "GST invoice"], cta: "Get Pro", highlight: true },
    { name: "Teams", price: null, items: ["For colleges & TPOs", "Bulk seats", "Placement dashboard", "Custom rubrics"], cta: "Contact us" },
  ];
  return (
    <section style={{ padding: "120px 32px", maxWidth: 1180, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>Less than a cup of chai</div>
        <h2 style={h2}>₹{perDay} a day.<br/><span style={{ color: T.inkSoft }}>That's the price of one practice.</span></h2>
      </Reveal>
      <Reveal delay={120}>
        <div style={{ marginTop: 32, display: "inline-flex", alignItems: "center", gap: 12, padding: 4, background: T.creamSoft, border: `1px solid ${T.line}`, borderRadius: 999 }}>
          {(["Monthly", "Yearly"] as const).map((m, i) => (
            <button key={m} onClick={() => setYearly(i === 1)} style={{
              padding: "9px 18px", borderRadius: 999, border: 0, cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: (yearly ? 1 : 0) === i ? "white" : "transparent", color: (yearly ? 1 : 0) === i ? T.indigo : T.inkSoft,
              boxShadow: (yearly ? 1 : 0) === i ? "0 4px 14px -4px rgba(14,12,8,0.15)" : "none",
            }}>{m}{i === 1 && <span style={{ marginLeft: 6, fontSize: 10, color: T.copper }}>Save ₹358</span>}</button>
          ))}
        </div>
      </Reveal>
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "stretch" }}>
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * 80}>
            <div style={{
              background: t.highlight ? T.indigoDeep : "white",
              color: t.highlight ? "white" : T.ink,
              border: `1px solid ${t.highlight ? T.indigoDeep : T.line}`,
              borderRadius: 18, padding: 28, height: "100%",
              display: "flex", flexDirection: "column", gap: 16,
              boxShadow: t.highlight ? "0 30px 60px -20px rgba(30,27,75,0.4)" : "none",
            }}>
              <div style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: 600, color: t.highlight ? "rgba(255,255,255,0.7)" : T.inkSoft }}>{t.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {t.price === null ? (
                  <span style={{ fontFamily: T.serif, fontSize: 38, fontWeight: 600 }}>Custom</span>
                ) : (
                  <>
                    <span style={{ fontFamily: T.serif, fontSize: 56, fontWeight: 600, letterSpacing: -2 }}>₹{t.price}</span>
                    {t.price > 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>/mo {yearly && t.highlight ? "(billed yearly)" : ""}</span>}
                  </>
                )}
              </div>
              {t.highlight && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>That's <strong style={{ color: "white" }}>₹{perDay}/day</strong>. ☕</div>
              )}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {t.items.map((it) => (
                  <li key={it} style={{ display: "flex", gap: 10, fontSize: 14 }}>
                    <span style={{ color: t.highlight ? "#86EFAC" : T.success }}>✓</span>{it}
                  </li>
                ))}
              </ul>
              <button style={{
                ...primaryBtn,
                background: t.highlight ? "white" : T.indigo, color: t.highlight ? T.indigoDeep : "white",
                padding: "14px 18px", fontSize: 14,
              }}>{t.cta}</button>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={300}>
        <div style={{ marginTop: 32, textAlign: "center", fontSize: 13, color: T.inkSoft, display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <span>UPI · GPay · PhonePe · Paytm</span>
          <span>·</span>
          <span>7-day refund, no questions</span>
          <span>·</span>
          <span>Festival pricing during placement season</span>
        </div>
      </Reveal>
    </section>
  );
}

/* ─────────────────────────  Privacy band (Act 10)  ───────────────────────── */
function Privacy() {
  const items = [
    { icon: "🔒", title: "AES-256 at rest", body: "Resumes encrypted on disk." },
    { icon: "🇮🇳", title: "Hosted in India", body: "Mumbai region · DPDPA-compliant." },
    { icon: "🚫", title: "Never trains models", body: "We use frozen Groq / Gemini APIs." },
    { icon: "🗑️", title: "One-click delete", body: "Account, audio, transcripts — gone in 24h." },
  ];
  return (
    <section style={{ padding: "80px 32px", background: T.cream, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
        {items.map((it, i) => (
          <Reveal key={it.title} delay={i * 70}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 26 }}>{it.icon}</div>
              <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink }}>{it.title}</div>
              <div style={{ fontSize: 13, color: T.inkSoft }}>{it.body}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────  FAQ (Act 11)  ───────────────────────── */
function FAQ() {
  const items = [
    { q: "Why not just use ChatGPT?", a: "No voice, no timer, no rubric, no memory. ChatGPT is a tutor; HireStepX is a simulator." },
    { q: "Is this for freshers?", a: "Yes. Campus placement (TCS NQT, Infosys, Wipro) is one of four core flows." },
    { q: "System design, coding, behavioral, HR, salary — all of these?", a: "All. Plus case study, panel, and govt/PSU." },
    { q: "Hindi or Hinglish supported?", a: "Yes. Speak in either, get feedback in either, switch mid-interview." },
    { q: "What if the AI feedback is wrong?", a: "Every score has a flag button. Wrong feedback gets a free re-mock + manual review within 24h." },
    { q: "Is my resume used to train models?", a: "No. We use frozen APIs (Groq, Gemini). Your data is yours. Delete anytime." },
    { q: "Does it work on slow internet / older phones?", a: "Yes. Audio-only mode works at 100kbps. No webcam required." },
    { q: "Refund policy?", a: "7 days, no questions, full refund via UPI/card to source." },
    { q: "GST invoice for company reimbursement?", a: "Auto-generated. We're a registered Indian entity." },
    { q: "What about non-tech roles — PM, sales, design, consulting?", a: "All supported. McKinsey, Deloitte, BCG case prep included." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section style={{ padding: "120px 32px", maxWidth: 760, margin: "0 auto" }}>
      <Reveal>
        <div style={eyebrow}>Questions you actually have</div>
        <h2 style={h2}>Frequently asked.</h2>
      </Reveal>
      <div style={{ marginTop: 40, borderTop: `1px solid ${T.line}` }}>
        {items.map((it, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
            <button onClick={() => setOpen(open === i ? null : i)} style={{
              width: "100%", padding: "20px 0", background: "none", border: 0, cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15, fontWeight: 600, color: T.ink, textAlign: "left",
            }}>
              {it.q}
              <span style={{ fontSize: 20, color: T.indigo, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 250ms ease" }}>+</span>
            </button>
            <div style={{ maxHeight: open === i ? 200 : 0, overflow: "hidden", transition: "max-height 350ms cubic-bezier(.2,.7,.2,1)" }}>
              <div style={{ padding: "0 0 22px", fontSize: 14, color: T.inkSoft, lineHeight: 1.65 }}>{it.a}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────  Final push (Act 12)  ───────────────────────── */
function FinalPush() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const mocks = useCountUp(1247, 1600, inView);
  const offers = useCountUp(38, 1200, inView);
  return (
    <section ref={ref} style={{ padding: "140px 32px", background: `linear-gradient(180deg, ${T.cream}, ${T.indigo})`, color: "white", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at center top, transparent, ${T.indigoDeep} 80%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 760, margin: "0 auto" }}>
        <Reveal>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.65)", marginBottom: 20 }}>
            Last 24 hours · <strong style={{ color: "white" }}>{Math.round(mocks)}</strong> mocks completed · <strong style={{ color: "white" }}>{Math.round(offers)}</strong> offers reported
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 style={{ fontFamily: T.serif, fontSize: 72, lineHeight: 1, letterSpacing: -2, color: "white", margin: 0, fontWeight: 500 }}>
            Your next interview<br/>is closer than you think.
          </h2>
        </Reveal>
        <Reveal delay={260}>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", marginTop: 22 }}>Practice the skill. Land the offer.</p>
        </Reveal>
        <Reveal delay={400}>
          <button style={{ ...primaryBtn, marginTop: 36, padding: "18px 32px", fontSize: 16, background: "white", color: T.indigoDeep, borderRadius: 14 }}>
            Start free — 3 mocks included →
          </button>
        </Reveal>
        <Reveal delay={520}>
          <div style={{ marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>No card needed · Hindi & Hinglish · UPI ₹10 sessions</div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  Footer  ───────────────────────── */
function Footer() {
  return (
    <footer style={{ padding: "56px 32px 36px", background: T.indigoDeep, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 48 }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: "white" }}>HireStep<span style={{ color: "#86EFAC" }}>X</span></div>
          <div style={{ marginTop: 14, lineHeight: 1.65, maxWidth: 280, color: "rgba(255,255,255,0.55)" }}>
            AI mock interview practice for Indian candidates. Practice. Score. Improve.
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Made in India 🇮🇳 · ₹ INR · GST 29ABCDE1234F1Z5</div>
        </div>
        {[
          { h: "Product", links: ["Pricing", "Interview types", "Company guides", "Resume builder", "Status page"] },
          { h: "Company", links: ["About", "Careers", "Blog", "Press"] },
          { h: "Legal", links: ["Privacy", "Terms", "Refund", "DPDPA / Grievance Officer"] },
        ].map((c) => (
          <div key={c.h}>
            <div style={{ color: "white", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{c.h}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {c.links.map((l) => <li key={l} style={{ cursor: "pointer" }}>{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

/* ─────────────────────────  Sticky mobile CTA  ───────────────────────── */
function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div style={{
      position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 60,
      transform: visible ? "translateY(0)" : "translateY(120%)",
      opacity: visible ? 1 : 0,
      transition: "all 350ms cubic-bezier(.2,.7,.2,1)",
      display: "none", // hidden by default; shown on mobile via media query inline
    }} className="hsx-sticky-mobile-cta">
      <button style={{ ...primaryBtn, width: "100%", padding: "16px", fontSize: 15, borderRadius: 14, boxShadow: "0 18px 40px -10px rgba(49,46,129,0.5)" }}>
        Start free — 3 mocks included →
      </button>
    </div>
  );
}

/* ─────────────────────────  Compose  ───────────────────────── */
export default function Homepage() {
  return (
    <>
      <style>{KEYFRAMES + `
        @media (max-width: 768px) {
          .hsx-sticky-mobile-cta { display: block !important; }
        }
      `}</style>
      <div style={{ background: T.cream, color: T.ink, fontFamily: "inherit" }}>
        <TopBar />
        <Hero />
        <PinnedStory />
        <IntentRouter />
        <Bento />
        <CompanyPreview />
        <Comparison />
        <Founder />
        <Testimonials />
        <Pricing />
        <Privacy />
        <FAQ />
        <FinalPush />
        <Footer />
        <StickyMobileCTA />
      </div>
    </>
  );
}

/* Section-only exports for individual storyboards in the canvas. */
export {
  TopBar as HomepageTopBar,
  Hero as HomepageHero,
  PinnedStory as HomepagePinnedStory,
  IntentRouter as HomepageIntentRouter,
  Bento as HomepageBento,
  CompanyPreview as HomepageCompanyPreview,
  Comparison as HomepageComparison,
  Founder as HomepageFounder,
  Testimonials as HomepageTestimonials,
  Pricing as HomepagePricing,
  Privacy as HomepagePrivacy,
  FAQ as HomepageFAQ,
  FinalPush as HomepageFinalPush,
  Footer as HomepageFooter,
};
