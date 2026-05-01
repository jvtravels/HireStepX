/* HireStepX — Design System / Email
   Templates for every transactional moment. Editorial, branded,
   reading-friendly on mobile (which is 70% of email opens). */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* Email frame — mimics a real email client preview */
function EmailFrame({
  subject,
  from,
  preview,
  children,
}: {
  subject: string;
  from: string;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        boxShadow: shadows.card,
        overflow: "hidden",
      }}
    >
      {/* Mail header (gmail-style) */}
      <div
        style={{
          background: t.creamSoft,
          padding: "14px 24px",
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        <div style={{ fontFamily: f.serif, fontSize: 18, fontWeight: 500, color: t.coal, letterSpacing: "-0.01em" }}>
          {subject}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: t.inkSoft }}>
          <span>
            <b style={{ color: t.coal, fontWeight: 500 }}>{from}</b>
          </span>
          <span style={{ color: t.inkFaint }}>· {preview}</span>
        </div>
      </div>
      {/* Email body — editorial styled */}
      <div
        style={{
          padding: "40px 48px",
          maxWidth: 560,
          margin: "0 auto",
          fontFamily: f.sans,
          fontSize: 15,
          lineHeight: 1.7,
          color: t.coal,
        }}
      >
        {/* Logo header */}
        <div
          style={{
            fontFamily: f.serif,
            fontSize: 18,
            fontWeight: 500,
            color: t.coal,
            marginBottom: 32,
            paddingBottom: 24,
            borderBottom: `1px solid ${t.line}`,
          }}
        >
          HireStepX
        </div>
        {children}
        {/* Footer */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${t.line}`,
            fontSize: 12,
            color: t.inkSoft,
            lineHeight: 1.7,
          }}
        >
          You're receiving this because you have an account at hirestepx.com.
          <br />
          <a style={{ color: t.indigo, textDecoration: "none", borderBottom: `1px solid ${t.indigo}` }}>
            Manage notifications
          </a>{" "}
          ·{" "}
          <a style={{ color: t.indigo, textDecoration: "none", borderBottom: `1px solid ${t.indigo}` }}>
            Unsubscribe
          </a>
          <div style={{ marginTop: 12, color: t.inkFaint, fontSize: 11 }}>
            HireStepX · Bengaluru, India
          </div>
        </div>
      </div>
    </div>
  );
}

/* Reusable button styles for email */
const emailBtn: React.CSSProperties = {
  display: "inline-block",
  background: t.indigo,
  color: t.white,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  marginTop: 8,
};

/* ─── Main ─── */
export default function DesignSystemEmail() {
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
            Email, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>occasion</em>.
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
            Every transactional email rendered as a designed surface.
            Editorial layout, generous whitespace, one CTA. 70% of email
            opens are mobile — every template stays readable at 320px wide.
          </p>
        </header>

        {/* 01 — SUBJECT LINE VOICE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Subject line voice"
            desc="The first 60 characters that decide whether the email is opened."
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <MonoLabel color={t.success}>Use these patterns</MonoLabel>
                <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                  {[
                    "Welcome. Your first practice begins now.",
                    "Verify your email · 15 minutes",
                    "Reset link, as requested",
                    "Your practice score is in",
                    "₹149 received · receipt inside",
                    "Your practice streak is at risk",
                  ].map((s) => (
                    <li
                      key={s}
                      style={{
                        background: t.creamSoft,
                        padding: "10px 14px",
                        borderRadius: 6,
                        fontSize: 14,
                        color: t.coal,
                        fontWeight: 500,
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <MonoLabel color="#B91C1C">Avoid</MonoLabel>
                <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                  {[
                    "Welcome to HireStepX — your interview journey starts now! 🎉",
                    "[ACTION REQUIRED] Please verify your email address",
                    "Reset Password Request - Click Here",
                    "Don't miss out! Your weekly performance summary",
                    "Payment Confirmation - Order #4827392",
                    "We miss you 😢 Come back!",
                  ].map((s) => (
                    <li
                      key={s}
                      style={{
                        background: "#FEE2E2",
                        padding: "10px 14px",
                        borderRadius: 6,
                        fontSize: 14,
                        color: t.coal,
                        fontWeight: 400,
                        textDecoration: "line-through",
                        opacity: 0.8,
                      }}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p style={{ marginTop: 24, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
              <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> no
              ALL-CAPS, no emojis, no exclamation marks, no order numbers in
              subjects, no manipulative loss-aversion. The voice is calm,
              specific, useful. If they open the email, the subject did its
              job.
            </p>
          </div>
        </section>

        {/* 02 — WELCOME EMAIL */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Welcome"
            desc="Sent immediately after signup. Sets expectations, ends with one action."
          />
          <EmailFrame
            subject="Welcome. Your first practice begins now."
            from="Jay from HireStepX"
            preview="Three free sessions, no card needed. Here's how to start."
          >
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                margin: "0 0 20px",
              }}
            >
              Welcome,{" "}
              <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
                Arjun
              </em>
              .
            </h1>
            <p style={{ margin: "0 0 16px" }}>
              Glad you're here. You've got three free practice interviews —
              that's enough to find your weakest area and fix one of them.
            </p>
            <p style={{ margin: "0 0 16px" }}>Three things to know:</p>
            <ol style={{ margin: "0 0 28px", paddingLeft: 20, color: t.indigoGray }}>
              <li style={{ marginBottom: 10 }}>
                Your AI interviewer adapts to your resume. The more honest your
                resume, the better the questions.
              </li>
              <li style={{ marginBottom: 10 }}>
                Sessions are 15 minutes by default. Start with{" "}
                <b style={{ color: t.coal }}>Behavioral · Standard</b>.
              </li>
              <li>You can interrupt the AI anytime. Real interviewers do too.</li>
            </ol>
            <a href="#" style={emailBtn}>
              Start your first interview →
            </a>
            <p
              style={{
                margin: "32px 0 0",
                fontSize: 14,
                color: t.indigoGray,
                fontStyle: "italic",
              }}
            >
              Reply to this email if anything's unclear. I read every one.
            </p>
            <p style={{ margin: "24px 0 0", color: t.indigoGray }}>
              — Jay
              <br />
              <span style={{ fontSize: 13, color: t.inkSoft }}>Founder, HireStepX</span>
            </p>
          </EmailFrame>
        </section>

        {/* 03 — VERIFICATION */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Email verification"
            desc="Short, single-purpose. The CTA is the entire email."
          />
          <EmailFrame
            subject="Verify your email · 15 minutes"
            from="HireStepX"
            preview="One click to confirm it's you and unlock your account."
          >
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                margin: "0 0 20px",
              }}
            >
              Verify your{" "}
              <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
                email
              </em>
              .
            </h1>
            <p style={{ margin: "0 0 24px" }}>
              We just need to confirm this address is yours. One click, then
              you can start practising.
            </p>
            <a href="#" style={emailBtn}>
              Verify my email →
            </a>
            <p
              style={{
                margin: "32px 0 0",
                fontSize: 13,
                color: t.indigoGray,
                lineHeight: 1.6,
              }}
            >
              The link expires in <b style={{ color: t.coal, fontWeight: 600 }}>15 minutes</b>{" "}
              for your security. If you didn't sign up, you can safely ignore
              this email — your address won't be used.
            </p>
          </EmailFrame>
        </section>

        {/* 04 — PAYMENT RECEIPT */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Payment receipt"
            desc="Calm confirmation. Numbers prominent. Editorial, never accountant-tone."
          />
          <EmailFrame
            subject="₹149 received · receipt inside"
            from="HireStepX Billing"
            preview="Pro plan starts now. Renews 15 June 2026."
          >
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                margin: "0 0 16px",
              }}
            >
              You're{" "}
              <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
                in
              </em>
              .
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: 15 }}>
              Pro plan starts now. Unlimited interviews, AI feedback, salary
              negotiation mode — all unlocked.
            </p>

            {/* Receipt block */}
            <div
              style={{
                background: t.creamSoft,
                borderRadius: 10,
                padding: "20px 24px",
                marginBottom: 28,
              }}
            >
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: t.inkSoft,
                  marginBottom: 12,
                  fontWeight: 500,
                }}
              >
                Receipt
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <span style={{ color: t.indigoGray }}>Plan</span>
                <span style={{ color: t.coal, textAlign: "right", fontWeight: 500 }}>Pro · monthly</span>
                <span style={{ color: t.indigoGray }}>Amount</span>
                <span style={{ color: t.coal, textAlign: "right", fontFamily: f.mono }}>₹149.00</span>
                <span style={{ color: t.indigoGray }}>GST included</span>
                <span style={{ color: t.coal, textAlign: "right", fontFamily: f.mono }}>₹22.73</span>
                <span style={{ color: t.indigoGray }}>Renews</span>
                <span style={{ color: t.coal, textAlign: "right" }}>15 June 2026</span>
                <span style={{ color: t.indigoGray }}>Razorpay ID</span>
                <span
                  style={{
                    color: t.coal,
                    textAlign: "right",
                    fontFamily: f.mono,
                    fontSize: 12,
                  }}
                >
                  pay_NhJa12K3LkM4
                </span>
              </div>
            </div>

            <a href="#" style={emailBtn}>
              View dashboard →
            </a>
            <p style={{ margin: "24px 0 0", fontSize: 13, color: t.indigoGray, lineHeight: 1.6 }}>
              Need a GST invoice for your company? Reply to this email and
              we'll send a tax-compliant version within an hour.
            </p>
          </EmailFrame>
        </section>

        {/* 05 — WEEKLY RECAP */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Weekly recap"
            desc="The marquee email. Editorial-styled like a Substack post. Proves the brand every Sunday."
          />
          <EmailFrame
            subject="Your week, in interview reps"
            from="HireStepX"
            preview="3 sessions completed. Score up 8 points. Here's what stood out."
          >
            <MonoLabel color={t.copper}>Week of 12-18 May 2026</MonoLabel>
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                margin: "12px 0 24px",
              }}
            >
              You're{" "}
              <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
                sharper
              </em>{" "}
              than last week.
            </h1>

            {/* Stat row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 32,
                paddingBottom: 32,
                borderBottom: `1px solid ${t.line}`,
              }}
            >
              {[
                { label: "Sessions", val: "3" },
                { label: "Avg score", val: "78" },
                { label: "Change", val: "+8" },
              ].map((kpi) => (
                <div key={kpi.label}>
                  <div
                    style={{
                      fontFamily: f.mono,
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: t.inkSoft,
                    }}
                  >
                    {kpi.label}
                  </div>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 32,
                      fontWeight: 500,
                      color: t.copper,
                      marginTop: 4,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {kpi.val}
                  </div>
                </div>
              ))}
            </div>

            <h3
              style={{
                fontFamily: f.serif,
                fontSize: 20,
                fontWeight: 500,
                margin: "0 0 12px",
                letterSpacing: "-0.01em",
              }}
            >
              What stood out
            </h3>
            <p style={{ margin: "0 0 16px" }}>
              Your behavioral structure improved across all three sessions.
              The AI noted you're now starting with situation context before
              jumping into action — a real STAR pattern. That's worth
              celebrating.
            </p>
            <p style={{ margin: "0 0 28px" }}>
              The next push: <b style={{ color: t.coal, fontWeight: 600 }}>quantified outcomes</b>.
              Your stories are landing, but they're missing the "and that
              led to a 23% improvement" line at the end. Try{" "}
              <a style={{ color: t.indigo, textDecoration: "none", borderBottom: `1px solid ${t.indigo}` }}>
                this prompt set
              </a>{" "}
              this week.
            </p>

            <a href="#" style={emailBtn}>
              Practice this →
            </a>
            <p style={{ margin: "32px 0 0", fontSize: 13, color: t.indigoGray, fontStyle: "italic" }}>
              See you next Sunday.
            </p>
          </EmailFrame>
        </section>

        {/* 06 — RE-ENGAGEMENT */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Re-engagement"
            desc="Sent after 14 days inactive. Honest, useful, never guilty. Acknowledges the gap."
          />
          <EmailFrame
            subject="Your practice streak is at risk"
            from="HireStepX"
            preview="Skills decay without reps. Here's where you left off."
          >
            <h1
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                margin: "0 0 20px",
              }}
            >
              It's been{" "}
              <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
                14 days
              </em>
              .
            </h1>
            <p style={{ margin: "0 0 16px" }}>
              No judgment — life happens. Just a reminder that interview
              skills, like any skill, decay without reps.
            </p>
            <p style={{ margin: "0 0 24px" }}>
              Your last session scored <b style={{ color: t.coal, fontWeight: 600 }}>72</b>{" "}
              on behavioral. That's a strong baseline. Pick up where you left
              off — 15 minutes is enough to keep the muscle warm.
            </p>
            <a href="#" style={emailBtn}>
              Practice in 15 minutes →
            </a>
            <p style={{ margin: "32px 0 0", fontSize: 13, color: t.indigoGray, lineHeight: 1.6 }}>
              Or, if you've moved on or aren't job-hunting right now, that's
              fine too. You can{" "}
              <a style={{ color: t.indigo, textDecoration: "none", borderBottom: `1px solid ${t.indigo}` }}>
                pause notifications
              </a>{" "}
              and we'll be here when you're back.
            </p>
          </EmailFrame>
        </section>

        {/* 07 — DESIGN TOKENS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Email design tokens"
            desc="Tighter palette than the product. Email clients are unreliable — keep it simple."
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
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 14 }}>
              {[
                { k: "Width", v: "Body container max 600px. Mobile reflows to 100% with 24px padding." },
                { k: "Font stack", v: "Instrument Serif for headers (with Georgia fallback). Satoshi for body (with system-ui fallback). Web fonts often blocked by email clients — fallbacks must look good." },
                { k: "Background", v: "Pure white #FFFFFF for body. Cream surface only as accents (receipt blocks). Email clients sometimes invert colors." },
                { k: "Buttons", v: "Inline <a> styled as block. NOT real buttons — Outlook strips them. Use bulletproof button HTML for cross-client safety." },
                { k: "Images", v: "Avoid where possible. If used, host on a CDN with absolute URLs. Always include alt text. Never load fonts via image-as-text." },
                { k: "Links", v: "Indigo with bottom-border underline. No `text-decoration: underline` (renders inconsistently across clients)." },
                { k: "Dark mode", v: "Test in Apple Mail dark mode. Avoid #000 backgrounds; cream survives inversion better than pure white." },
                { k: "CTA placement", v: "One primary CTA, above the fold (320×480px viewport). Secondary actions only as text links at the bottom." },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}
                >
                  <span
                    style={{
                      fontFamily: f.mono,
                      fontSize: 11,
                      color: t.copper,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
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

        {/* FOOTER */}
        <Footer section="Section" tagline="One CTA. Editorial layout. Mobile-readable." />
      </div>
    </>
  );
}
