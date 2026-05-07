/* HireStepX — Dashboard / Resume tab · empty state (design-only)
   Shown when the user is in the dashboard but hasn't uploaded a resume
   yet (e.g. signed up via Google + skipped onboarding upload). The page
   has no analysis to show, so the design pivots to a single, focused
   upload moment with the same trust beats as the onboarding upload —
   plus an explicit "what happens next" preview so the user knows what
   they're trading their resume for. */
import type { CSSProperties } from "react";

const t = {
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
  white: "#FFFFFF",
  coal: "#0E0C08",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copper100: "#F4E5D8",
  copperSoft: "rgba(180, 83, 9, 0.12)",
  success: "#15803D",
  success100: "#DCFCE7",
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
};
const f = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};
const cardShadow =
  "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)";

const TRUST_PILLS: Array<{ label: string; icon: "lock" | "shield" | "trash" }> = [
  { label: "Encrypted in transit (TLS)", icon: "lock" },
  { label: "Never sold or shared", icon: "shield" },
  { label: "Delete any time (DPDP)", icon: "trash" },
];

const PREVIEW_STEPS: Array<{ icon: "scan" | "score" | "play"; title: string; body: string }> = [
  {
    icon: "scan",
    title: "Read in ~10 seconds",
    body: "We extract role, seniority, skills, and key achievements — once. Nothing manual.",
  },
  {
    icon: "score",
    title: "Get a Readiness Index",
    body: "Resume Quality + ATS Compatibility + Interview Coverage on six tracks.",
  },
  {
    icon: "play",
    title: "Practise the weakest track",
    body: "We'll suggest a 5-minute mock based on what your resume is missing.",
  },
];

function StepIcon({ kind }: { kind: "scan" | "score" | "play" }) {
  const common: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 10,
    background: t.copper100,
    border: `1px solid ${t.copperSoft}`,
    flexShrink: 0,
  };
  return (
    <div style={common} aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === "scan" && (
          <>
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </>
        )}
        {kind === "score" && (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        )}
        {kind === "play" && (
          <>
            <polygon points="5 3 19 12 5 21 5 3" />
          </>
        )}
      </svg>
    </div>
  );
}

export default function ResumeTabEmpty() {
  return (
    <div
      style={{
        background: t.cream,
        minHeight: "100dvh",
        color: t.coal,
        fontFamily: f.sans,
        padding: "40px 32px 80px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: "clamp(2.25rem, 4vw, 3rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              fontWeight: 400,
              color: t.coal,
              margin: 0,
            }}
          >
            Add your{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>
              resume
            </em>
          </h1>
          <p
            style={{
              fontFamily: f.sans,
              fontSize: 15,
              color: t.inkSoft,
              marginTop: 12,
              lineHeight: 1.55,
              maxWidth: 540,
              marginLeft: "auto",
              marginRight: "auto",
              textWrap: "balance",
            }}
          >
            One upload powers everything else — interview questions, fitness
            scores, coaching nudges. We&apos;ll read it once and never ask
            again.
          </p>
        </header>

        {/* Drop zone card */}
        <div
          style={{
            background: t.white,
            borderRadius: 18,
            border: `1px solid ${t.line}`,
            boxShadow: cardShadow,
            padding: "28px 28px 26px",
            marginBottom: 18,
          }}
        >
          <label
            htmlFor="empty-resume-input"
            style={{
              display: "block",
              border: `2px dashed ${t.lineStrong}`,
              background: t.creamSoft,
              borderRadius: 14,
              padding: "44px 24px",
              cursor: "pointer",
              textAlign: "center",
              transition: "background 160ms ease, border-color 160ms ease",
            }}
          >
            <input
              id="empty-resume-input"
              type="file"
              accept=".pdf,.doc,.docx"
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
            />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: t.copper100,
                  border: `1px solid ${t.copperSoft}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: f.sans, fontSize: 17, fontWeight: 600, color: t.coal, lineHeight: 1.3 }}>
                  Drag a file here, or{" "}
                  <span style={{ color: t.indigo, textDecoration: "underline", textUnderlineOffset: 3 }}>browse</span>
                </div>
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}>
                  PDF, DOC, or DOCX · up to 10 MB
                </div>
              </div>
            </div>
          </label>

          {/* Trust pills */}
          <ul
            aria-label="How we handle your resume"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              margin: "18px 0 0",
              padding: 0,
              listStyle: "none",
              fontFamily: f.sans,
              fontSize: 12,
              color: t.inkSoft,
              lineHeight: 1.4,
            }}
          >
            {TRUST_PILLS.map(p => (
              <li
                key={p.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  background: t.creamSoft,
                  border: `1px solid ${t.line}`,
                  borderRadius: 999,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {p.icon === "lock" && (
                    <>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </>
                  )}
                  {p.icon === "shield" && (
                    <>
                      <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
                      <polyline points="9 12 11 14 15 10" />
                    </>
                  )}
                  {p.icon === "trash" && (
                    <>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </>
                  )}
                </svg>
                {p.label}
              </li>
            ))}
          </ul>
        </div>

        {/* What happens next preview — answers the unspoken
            "what am I trading my resume for?" question. */}
        <div
          style={{
            background: t.white,
            borderRadius: 16,
            border: `1px solid ${t.line}`,
            boxShadow: cardShadow,
            padding: "20px 24px",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontFamily: f.sans,
              fontSize: 11,
              fontWeight: 700,
              color: t.copper,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            What happens after you upload
          </span>
          <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 14 }}>
            {PREVIEW_STEPS.map(step => (
              <li key={step.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <StepIcon kind={step.icon} />
                <div>
                  <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, lineHeight: 1.35 }}>
                    {step.title}
                  </div>
                  <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2, lineHeight: 1.5 }}>
                    {step.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Skip / soft escape */}
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            style={{
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 500,
              color: t.indigo,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            I&apos;ll add it later — back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
