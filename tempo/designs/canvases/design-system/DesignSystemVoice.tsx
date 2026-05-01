/* HireStepX — Design System / Voice & Tone
   Brand voice, microcopy patterns, words to use, words to avoid.
   The discipline: confident, specific, no fluff. Lead with outcomes. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Comparison row — bad copy vs good copy */
function CopyPair({ context, bad, good }: { context: string; bad: string; good: string }) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "24px 28px",
        boxShadow: shadows.card,
      }}
    >
      <MonoLabel>{context}</MonoLabel>
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div
          style={{
            background: t.error100,
            borderLeft: `3px solid ${t.error}`,
            borderRadius: 6,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 10,
              color: t.error,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Don't
          </div>
          <p style={{ fontSize: 14, color: t.coal, margin: 0, lineHeight: 1.55 }}>{bad}</p>
        </div>
        <div
          style={{
            background: t.success100,
            borderLeft: `3px solid ${t.success}`,
            borderRadius: 6,
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 10,
              color: t.success,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            Do
          </div>
          <p style={{ fontSize: 14, color: t.coal, margin: 0, lineHeight: 1.55 }}>{good}</p>
        </div>
      </div>
    </div>
  );
}

/* Word list */
function WordList({
  title,
  color,
  words,
}: {
  title: string;
  color: string;
  words: string[];
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "28px 32px",
        boxShadow: shadows.card,
      }}
    >
      <MonoLabel color={color}>{title}</MonoLabel>
      <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {words.map((w) => (
          <span
            key={w}
            style={{
              fontFamily: f.serif,
              fontSize: 16,
              color: t.coal,
              padding: "6px 12px",
              background: t.creamSoft,
              borderRadius: 6,
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemVoice() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* MASTHEAD */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 40, marginBottom: 64 }}>
          <MonoLabel>Design System · v1.0</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            Voice, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>specificity</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            Confident. Specific. No fluff. Like a sharp friend who works in
            hiring, not a corporate brochure. Lead with outcomes. Use numbers
            when possible. Acknowledge the fear.
          </p>
        </header>

        {/* 01 — THE VOICE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="The voice"
            desc="The personality that should come through every word HireStepX writes."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "40px 48px",
              boxShadow: shadows.card,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 20 }}>
              {[
                { k: "Confident", v: "We know what works. We don't hedge with 'might' or 'maybe'. Indian candidates need certainty, not corporate cushion." },
                { k: "Specific", v: "'40% improvement', 'within 30 seconds', '₹49/student/year'. Numbers earn trust. Vague is the enemy." },
                { k: "Outcome-led", v: "'Land your job' beats 'AI-powered interviews'. Lead with what they get, not how we get them there." },
                { k: "Honest about the fear", v: "Interviews are stressful. Say so. Empathy is more premium than denial." },
                { k: "Indian-aware", v: "₹ not $. TCS, Razorpay, Flipkart are valid examples. Campus placement is a real category. Don't write for SF." },
                { k: "Brief", v: "If a sentence can be cut, cut it. Premium products write less, not more." },
              ].map((row) => (
                <li key={row.k} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}>
                  <span
                    style={{
                      fontFamily: f.serif,
                      fontSize: 18,
                      color: t.copper,
                      fontWeight: 500,
                      paddingTop: 1,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {row.k}
                  </span>
                  <span style={{ color: t.indigoGray }}>{row.v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 02 — WORD LISTS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Words"
            desc="Use these. Avoid those. Build a vocabulary that's recognizable across surfaces."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <WordList
              title="Use these"
              color={t.success}
              words={[
                "Practice",
                "Score",
                "Improve",
                "Personalized",
                "Specific",
                "Real",
                "Clarity",
                "Land",
                "Crack",
                "Prepare",
                "Sharp",
                "Honest",
                "Today",
                "Tonight",
              ]}
            />
            <WordList
              title="Avoid these"
              color={t.error}
              words={[
                "Revolutionary",
                "Disrupt",
                "Synergy",
                "Leverage",
                "Best-in-class",
                "Cutting-edge",
                "Game-changing",
                "Empower",
                "Unleash",
                "Seamless",
                "Robust",
                "Holistic",
                "World-class",
                "Innovative",
              ]}
            />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> every word
            in the right column is a tell. They signal "marketing wrote this."
            The brand HireStepX wants to be — Mercury, Substack, Stripe Atlas
            — never uses these words. Neither do we.
          </p>
        </section>

        {/* 03 — MICROCOPY PATTERNS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Microcopy patterns"
            desc="The high-frequency strings — buttons, errors, success, empty. Get these right, the rest follows."
          />
          <div style={{ display: "grid", gap: 16 }}>
            <CopyPair
              context="Primary CTA — login screen"
              bad="Submit"
              good="Continue to practise →"
            />
            <CopyPair
              context="Error — invalid email"
              bad="ERROR: Email is not valid format. Please retry."
              good="Please enter a valid email."
            />
            <CopyPair
              context="Success — payment"
              bad="Transaction successful. Your account has been credited."
              good="You're in. Pro plan starts now."
            />
            <CopyPair
              context="Empty state — no sessions"
              bad="No data to display."
              good="No interviews yet. Run your first one in 90 seconds."
            />
            <CopyPair
              context="Loading state"
              bad="Please wait, processing your request..."
              good="Reading your story… ~12s"
            />
            <CopyPair
              context="Confirmation modal — delete account"
              bad="Are you sure you want to delete your account? This action cannot be undone."
              good="Delete your account? Your sessions, scores, and resume go with it. We can't recover them."
            />
            <CopyPair
              context="Email — verification"
              bad="Click the link below to verify your email address and complete your registration with our service."
              good="Verify your email to start practising. Link expires in 15 minutes."
            />
            <CopyPair
              context="Toast — reset link sent"
              bad="An email has been dispatched to your registered email address."
              good="Reset link sent. Check your inbox — it usually arrives within 30 seconds."
            />
          </div>
        </section>

        {/* 04 — HERO COPY FORMULAS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Hero copy formulas"
            desc="The italic-accent-word treatment depends on the right word in the right place."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { ctx: "Auth · login", line: "Clarity wins interviews", accent: "wins" },
              { ctx: "Auth · reset", line: "Reset your password", accent: "password" },
              { ctx: "Auth · check email", line: "Check your email", accent: "email" },
              { ctx: "Onboarding · upload", line: "Let's start improving your interview clarity", accent: "clarity" },
              { ctx: "Result · score reveal", line: "Strong foundation", accent: "" },
              { ctx: "Dashboard · greeting", line: "Good morning, Jay", accent: "Jay" },
              { ctx: "Empty · no sessions", line: "No interviews yet", accent: "yet" },
              { ctx: "Onboarding · ready", line: "Your first practice begins now", accent: "now" },
            ].map((row) => (
              <div
                key={row.ctx}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  padding: 28,
                  boxShadow: shadows.card,
                }}
              >
                <MonoLabel>{row.ctx}</MonoLabel>
                <p
                  style={{
                    fontFamily: f.serif,
                    fontSize: 28,
                    fontWeight: 400,
                    margin: "12px 0 0",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    color: t.coal,
                  }}
                >
                  {row.line.split(" ").map((word, i) => {
                    const isAccent = word.toLowerCase().replace(/[.,!]/g, "") === row.accent.toLowerCase();
                    return (
                      <React.Fragment key={i}>
                        {isAccent ? (
                          <em
                            style={{
                              fontStyle: "italic",
                              fontWeight: 500,
                              color: t.copper,
                            }}
                          >
                            {word}
                          </em>
                        ) : (
                          word
                        )}
                        {i < row.line.split(" ").length - 1 && " "}
                      </React.Fragment>
                    );
                  })}
                </p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Formula:</b> [verb or
            descriptive] [your] [noun-with-payoff]. The italic word is usually
            the noun (the thing they came for) or the verb (the action that
            unlocks it). Never on filler words like "the" or "a".
          </p>
        </section>

        {/* 05 — TONE CALIBRATION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Tone calibration"
            desc="Same brand voice, dialed up or down based on context. Funeral vs party — same person, different tone."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            {[
              {
                ctx: "Marketing landing",
                tone: "Confident, lightly bold",
                ex: "Land your dream job. Practice for ₹10 a session.",
              },
              {
                ctx: "Auth flows",
                tone: "Warm, inviting, calm",
                ex: "Welcome back. Continue where you left off.",
              },
              {
                ctx: "Score reveal",
                tone: "Encouraging, never harsh",
                ex: "Strong foundation. Push toward great with focused practice.",
              },
              {
                ctx: "Errors · recoverable",
                tone: "Calm, clear, what to do next",
                ex: "Connection dropped. Your answers are saved. Retry?",
              },
              {
                ctx: "Errors · destructive",
                tone: "Direct, consequential, clear",
                ex: "Delete your account? Your sessions go with it.",
              },
              {
                ctx: "Success moments",
                tone: "Brief, earned, no exclamation",
                ex: "You're in. Pro plan starts now.",
              },
              {
                ctx: "Empty states",
                tone: "Inviting, instructive",
                ex: "No interviews yet. Run your first one in 90 seconds.",
              },
              {
                ctx: "Notifications",
                tone: "Useful, never urgent unless urgent",
                ex: "3 days left on your plan. Renew anytime.",
              },
            ].map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 220px 1fr",
                  gap: 24,
                  padding: "16px 28px",
                  borderBottom: `1px solid ${t.line}`,
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: t.coal }}>{row.ctx}</div>
                <div style={{ fontSize: 12, color: t.indigo, fontStyle: "italic" }}>{row.tone}</div>
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 14,
                    color: t.indigoGray,
                    fontStyle: "italic",
                    lineHeight: 1.5,
                  }}
                >
                  "{row.ex}"
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 06 — INDIAN-ENGLISH GUIDANCE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Indian English"
            desc="The market is Indian. Spelling, currency, examples, idioms — match the audience."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
              <div>
                <MonoLabel color={t.copper}>Spelling</MonoLabel>
                <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  <li style={{ fontSize: 14, color: t.indigoGray }}>
                    <b style={{ color: t.coal }}>British spellings</b> across the product:
                  </li>
                  <li style={{ fontSize: 13, color: t.indigoGray, paddingLeft: 16, lineHeight: 1.7 }}>
                    practise (verb), practice (noun) · organise · prioritise ·
                    behaviour · colour · centre · analyse
                  </li>
                  <li style={{ fontSize: 13, color: t.error, paddingLeft: 16, marginTop: 8 }}>
                    Avoid: practice (as verb) · organize · prioritize ·
                    behavior · color · center · analyze
                  </li>
                </ul>
              </div>
              <div>
                <MonoLabel color={t.copper}>Currency & numbers</MonoLabel>
                <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                    Use <b style={{ color: t.coal }}>₹ (rupee symbol)</b>, never $ or USD
                  </li>
                  <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                    Use <b style={{ color: t.coal }}>LPA</b> (Lakhs Per Annum)
                    for salaries, not "$120K"
                  </li>
                  <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                    Format: <b style={{ color: t.coal }}>₹15,00,000</b> (Indian
                    grouping) or "₹15 LPA"
                  </li>
                  <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                    Dates: <b style={{ color: t.coal }}>14 May 2026</b> (DMY),
                    not "May 14, 2026"
                  </li>
                </ul>
              </div>
            </div>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${t.line}` }}>
              <MonoLabel color={t.copper}>Examples that resonate</MonoLabel>
              <p style={{ marginTop: 12, fontSize: 13, color: t.indigoGray, lineHeight: 1.7 }}>
                <b style={{ color: t.coal }}>Companies:</b> TCS, Infosys,
                Wipro, Razorpay, Flipkart, Swiggy, Zerodha, Cred, PhonePe,
                Paytm — not Stripe, Airbnb, Uber as primary examples.
              </p>
              <p style={{ fontSize: 13, color: t.indigoGray, lineHeight: 1.7 }}>
                <b style={{ color: t.coal }}>Interview types:</b> Campus
                placement, NQT (TCS), InfyTQ, Wipro NLTH, government PSU —
                these phrases mean nothing in SF, everything to your audience.
              </p>
              <p style={{ fontSize: 13, color: t.indigoGray, lineHeight: 1.7 }}>
                <b style={{ color: t.coal }}>Cities:</b> Bengaluru (not
                Bangalore in formal writing), Mumbai, Hyderabad, Chennai, NCR.
              </p>
            </div>
          </div>
        </section>

        {/* 07 — CTA VERB LIBRARY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="CTA verbs"
            desc="The button verb is the brand promise in two words. Pick from this library."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.success}>Use these</MonoLabel>
              <div
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  "Continue",
                  "Start practising",
                  "Save",
                  "Send reset link",
                  "Verify email",
                  "Try free",
                  "View report",
                  "Practice now",
                  "Get started",
                  "Resume session",
                  "Update password",
                  "Renew",
                ].map((v) => (
                  <span
                    key={v}
                    style={{
                      background: t.indigo,
                      color: t.white,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: "center",
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.error}>Avoid</MonoLabel>
              <div
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {[
                  "Submit",
                  "OK",
                  "Click here",
                  "Process",
                  "Execute",
                  "Confirm",
                  "Yes",
                  "Go",
                  "Next",
                  "Buy now!",
                  "Sign me up",
                  "Learn more",
                ].map((v) => (
                  <span
                    key={v}
                    style={{
                      background: t.creamSoft,
                      color: t.inkSoft,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: "center",
                      textDecoration: "line-through",
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rule:</b> CTAs are
            verb-first, specific, and tell the user exactly what happens next.
            "Continue to practise" beats "Continue" beats "OK". Specificity
            converts.
          </p>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="Confident · Specific · No fluff · Outcome-led." />
      </div>
    </>
  );
}
