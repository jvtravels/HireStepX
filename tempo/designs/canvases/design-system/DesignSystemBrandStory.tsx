/* HireStepX — Design System / Brand Story
   Mission · vision · pillars · positioning · founder origin.
   The "why we exist" that lives behind every design choice.

   2026-09 SaaS-flat conversion: this page used to lean hardest into the
   retired editorial direction — an oversized serif masthead, 32px+ pull
   quotes, copper splashed across headline words as decorative emphasis.
   The mission/values/positioning CONTENT is unchanged (it's substantively
   about the company), but its visual presentation now runs through the
   compact `type` scale like every other storyboard: no display-serif
   headline larger than an h1, no copper outside a label/tag or an actual
   link-style emphasis, denser card padding, no italics. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, type, radius, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer, PageHeader } from "./_atoms";
/* ─── Main ─── */
export default function DesignSystemBrandStory() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 48px 96px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        <PageHeader
          title="Brand, by conviction."
          description="The why behind every design choice. Mission, pillars, position, and origin. Read this once a quarter to remember what we're actually building."
        />

        {/* 01 — MANIFESTO */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="01"
            title="Manifesto"
            desc="Our one-page philosophy. The thing we say to ourselves before every decision."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "32px 40px",
              boxShadow: shadows.card,
            }}
          >
            <p
              style={{
                fontFamily: f.serif,
                fontSize: type.h1.size,
                fontWeight: 600,
                letterSpacing: type.h1.letterSpacing,
                lineHeight: type.h1.lineHeight,
                color: t.coal,
                margin: 0,
              }}
            >
              Interviews are the most consequential ten minutes of someone's
              decade. And they're treated like a lottery.
            </p>
            <p
              style={{
                fontSize: type.bodyLg.size,
                fontWeight: 400,
                lineHeight: 1.6,
                color: t.inkMuted,
                margin: "20px 0 0",
              }}
            >
              We think they should be a skill. One you can practise, measure,
              and improve. So we built a coach that listens — not a course
              that lectures. One that costs ₹10, not ₹5,000. One that
              understands TCS interviews as well as Google ones, because
              India's job market deserves better than imported playbooks.
            </p>
            <p
              style={{
                fontSize: type.bodyLg.size,
                fontWeight: 400,
                lineHeight: 1.6,
                color: t.inkMuted,
                margin: "14px 0 0",
              }}
            >
              The product is small. The mission is big.{" "}
              <span style={{ color: t.coal, fontWeight: 600 }}>
                Clarity wins interviews.
              </span>{" "}
              We help people get clearer.
            </p>
          </div>
        </section>

        {/* 02 — MISSION VISION VALUES */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="02"
            title="Mission · Vision · Values"
            desc="The three statements every team member should be able to recite. No more, no less."
          />
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                background: t.coal,
                color: t.cream,
                borderRadius: radius.lg,
                padding: "24px 28px",
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: 24,
                alignItems: "center",
              }}
            >
              <MonoLabel color={t.copper}>Mission</MonoLabel>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: type.h2.size,
                  fontWeight: 600,
                  letterSpacing: type.h2.letterSpacing,
                  lineHeight: type.h2.lineHeight,
                  margin: 0,
                  color: t.cream,
                }}
              >
                Make interview prep feel less like a lottery and more like a
                skill.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "20px 28px",
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                gap: 24,
                alignItems: "center",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Vision</MonoLabel>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: type.h3.size,
                  fontWeight: 500,
                  lineHeight: type.h3.lineHeight,
                  margin: 0,
                  color: t.coal,
                }}
              >
                A future where every Indian job seeker walks into their
                interview already practised — not memorised, not lucky, but
                genuinely sharper than the last time.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "20px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Values</MonoLabel>
              <div
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 20,
                }}
              >
                {[
                  { k: "Specificity over fluff", v: "If we can say 40%, we don't say 'significant'. If we can say 30 seconds, we don't say 'soon'." },
                  { k: "Practice over theory", v: "Reading about interviews doesn't make you better. Doing them does. We optimize for reps, not content." },
                  { k: "India first", v: "We use ₹, not $. We know TCS NQT. We don't translate Silicon Valley playbooks — we replace them." },
                  { k: "Honest about the fear", v: "Job interviews are stressful. Pretending otherwise is corporate cowardice. We acknowledge it." },
                ].map((row) => (
                  <div key={row.k}>
                    <h4
                      style={{
                        fontFamily: f.sans,
                        fontSize: type.h4.size,
                        fontWeight: type.h4.weight,
                        margin: "0 0 4px",
                        color: t.coal,
                      }}
                    >
                      {row.k}
                    </h4>
                    <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                      {row.v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 03 — BRAND PILLARS */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="03"
            title="Three brand pillars"
            desc="The themes every product, marketing, and design decision must trace back to."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                num: "I",
                title: "Practise, not study",
                line: "We are not a course. We are reps.",
                expand:
                  "Every feature must answer: does this give the user another rep, or just more to read? If it's the latter, cut it.",
              },
              {
                num: "II",
                title: "Specific, not generic",
                line: "TCS questions for TCS candidates.",
                expand:
                  "Generic interview prep is everywhere and it's failing. Our wedge is precision: this company, this role, this experience level, this resume.",
              },
              {
                num: "III",
                title: "Honest, not corporate",
                line: "Acknowledge the fear. Then beat it.",
                expand:
                  "Most career platforms write like HR brochures. We write like a sharp friend. Warm, direct, never robotic. Never 'leverage'.",
              },
            ].map((p) => (
              <div
                key={p.num}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: radius.lg,
                  padding: "20px 20px",
                  boxShadow: shadows.card,
                }}
              >
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: type.h2.size,
                    fontWeight: 600,
                    color: t.inkFaint,
                    lineHeight: 1,
                  }}
                >
                  {p.num}
                </div>
                <h3
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.h3.size,
                    fontWeight: type.h3.weight,
                    margin: "14px 0 6px",
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.body.size,
                    fontWeight: 500,
                    color: t.copper,
                    margin: "0 0 10px",
                    lineHeight: 1.4,
                  }}
                >
                  {p.line}
                </p>
                <p
                  style={{
                    fontSize: type.small.size,
                    color: t.inkMuted,
                    margin: 0,
                    lineHeight: type.small.lineHeight,
                  }}
                >
                  {p.expand}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — POSITIONING */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="04"
            title="Positioning"
            desc="Where we sit in the market. What we're not. The hill we'll defend."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "24px 28px",
              boxShadow: shadows.card,
            }}
          >
            <MonoLabel color={t.copper}>Position statement</MonoLabel>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: type.h3.size,
                fontWeight: 500,
                lineHeight: 1.5,
                margin: "12px 0 0",
                color: t.coal,
              }}
            >
              For Indian job seekers who can't afford coaching but can't afford
              to fail their next interview, HireStepX is{" "}
              <span style={{ color: t.coal, fontWeight: 700 }}>
                AI-powered mock interview practice
              </span>{" "}
              that costs ₹10 a session and adapts to their resume, target
              company, and weak spots — unlike YouTube tutorials, generic mock
              platforms, or expensive coaches.
            </p>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <MonoLabel color={t.copper}>What we're NOT</MonoLabel>
              <ul
                style={{
                  margin: "12px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 8,
                }}
              >
                {[
                  "Not a job board. We don't list openings. We make you ready to win them.",
                  "Not a course. We don't teach concepts. We give you reps with feedback.",
                  "Not a chatbot. We're an interviewer. Voice, follow-ups, scoring — like a real one.",
                  "Not Silicon Valley translated. We're built for India, in INR, with TCS/Razorpay/Flipkart fluency.",
                  "Not a coach replacement. Coaches are great. We're who you practise with between sessions.",
                ].map((line, i) => (
                  <li
                    key={i}
                    style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: 1.6, paddingLeft: 16, position: "relative" }}
                  >
                    <span style={{ position: "absolute", left: 0, color: t.error, fontWeight: 600 }}>×</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 05 — COMPETITIVE MAP */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="05"
            title="Competitive map"
            desc="How we differ from the obvious comparisons. The wedge that's defensible."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr 1fr 1fr",
                background: t.creamSoft,
                padding: "10px 20px",
                fontFamily: f.mono,
                fontSize: type.micro.size,
                textTransform: "uppercase",
                letterSpacing: type.micro.letterSpacing,
                color: t.inkSoft,
                fontWeight: type.micro.weight,
                borderBottom: `1px solid ${t.line}`,
              }}
            >
              <div>Competitor</div>
              <div>Their angle</div>
              <div>Our wedge</div>
              <div>Price gap</div>
            </div>
            {[
              {
                name: "Yoodli",
                angle: "AI speech coach. Generic communication tool.",
                wedge: "We're interview-specific + India-aware. They're a global toastmaster app.",
                price: "$8-20/mo · we're ₹10/session",
              },
              {
                name: "Final Round AI",
                angle: "Live interview copilot. Whispers answers in real interviews.",
                wedge: "Different category. They help you cheat. We help you get good.",
                price: "$25-149/mo · ethical line",
              },
              {
                name: "Pramp / Exponent",
                angle: "Peer-to-peer practice. Free if you reciprocate.",
                wedge: "We don't depend on a partner. AI is always available, India-tuned, scored.",
                price: "Free · we trade time for ₹10",
              },
              {
                name: "Naukri Mock",
                angle: "Indian incumbent. AI mock interviews bundled with Naukri.",
                wedge: "We're focused. They're a feature. Premium positioning vs. job-board adjacent.",
                price: "Bundled · we're standalone premium",
              },
              {
                name: "₹5,000 coaches",
                angle: "Human career coaches. 1-2 sessions / month.",
                wedge: "We're not a coach. We're who you practise WITH between coaching calls.",
                price: "₹3K-10K/session · we're ₹10/session",
              },
            ].map((row) => (
              <div
                key={row.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr 1fr 1fr",
                  padding: "14px 20px",
                  borderBottom: `1px solid ${t.line}`,
                  alignItems: "flex-start",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.h4.size,
                    fontWeight: type.h4.weight,
                    color: t.coal,
                  }}
                >
                  {row.name}
                </div>
                <div style={{ fontSize: type.small.size, color: t.inkMuted, lineHeight: 1.55 }}>{row.angle}</div>
                <div style={{ fontSize: type.small.size, color: t.coal, lineHeight: 1.55, fontWeight: 500 }}>
                  {row.wedge}
                </div>
                <div style={{ fontSize: type.caption.size, color: t.copper, lineHeight: 1.55, fontFamily: f.mono }}>
                  {row.price}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 06 — ORIGIN */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="06"
            title="Founder origin"
            desc="The 60-second story. Used in pitch decks, About pages, podcast intros."
          />
          <div
            style={{
              background: t.coal,
              color: t.cream,
              borderRadius: radius.lg,
              padding: "32px 36px",
            }}
          >
            <MonoLabel color={t.copper}>The moment</MonoLabel>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: type.h2.size,
                fontWeight: 600,
                lineHeight: type.h2.lineHeight,
                letterSpacing: type.h2.letterSpacing,
                margin: "14px 0 0",
                color: t.cream,
              }}
            >
              I bombed an interview I'd prepared 40 hours for.
            </p>
            <p
              style={{
                fontSize: type.bodyLg.size,
                fontWeight: 400,
                lineHeight: 1.6,
                margin: "16px 0 0",
                color: "rgba(250, 247, 240, .80)",
              }}
            >
              Not because I didn't know the material. I'd memorized every
              answer. The problem was the follow-up question I hadn't
              rehearsed for. My answer landed flat. The recruiter's "we'll be
              in touch" came that afternoon.
            </p>
            <p
              style={{
                fontSize: type.bodyLg.size,
                fontWeight: 400,
                lineHeight: 1.6,
                margin: "12px 0 0",
                color: "rgba(250, 247, 240, .80)",
              }}
            >
              I realized: I'd <b style={{ fontWeight: 700, color: t.cream }}>studied</b> interviews. I hadn't{" "}
              <b style={{ fontWeight: 700, color: t.cream }}>practised</b> them. There's a difference. And there was
              no affordable way for an Indian candidate to do the second one
              well — coaching cost ₹5,000 per session, friends were biased,
              YouTube was theory. Mock interview platforms existed but they
              were Western, expensive, or peer-roulette.
            </p>
            <div
              style={{
                marginTop: 20,
                paddingLeft: 20,
                borderLeft: `2px solid ${t.copper}`,
              }}
            >
              <p
                style={{
                  fontSize: type.body.size,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: t.cream,
                  margin: 0,
                }}
              >
                So I built the thing I wished I'd had — an AI that interviews
                you the way a real recruiter would, in your context, on your
                resume, for ₹10 a session. Not a course. Not a coach. A
                practise partner.
              </p>
            </div>
            <p
              style={{
                marginTop: 20,
                fontSize: type.small.size,
                color: "rgba(250, 247, 240, .55)",
                fontFamily: f.mono,
                letterSpacing: "0.04em",
              }}
            >
              — Jay Vyas, Founder · 2026
            </p>
          </div>
        </section>

        {/* 07 — TAGLINES */}
        <section style={{ marginBottom: 48 }}>
          <SectionHead
            num="07"
            title="Taglines"
            desc="The lockup line, the social caption, the billboard. Tone-tested for context."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { ctx: "Primary · landing hero", line: "Clarity wins interviews.", note: "The default. Use everywhere unless context demands otherwise." },
              { ctx: "Pricing · payment flow", line: "₹10. One mock. No card.", note: "Friction-killer. Use on pricing CTAs." },
              { ctx: "B2B · college pitch", line: "Make every student interview-ready, not just lucky.", note: "Speaks to placement officers' KPI." },
              { ctx: "Social · recruiting", line: "We're hiring people who hate corporate-speak.", note: "Filters for cultural fit." },
              { ctx: "Email · welcome line", line: "Welcome. Your first practice begins now.", note: "Calm, immediate. No exclamation point." },
              { ctx: "Press · one-line", line: "AI mock interviews built for India. ₹10 per session.", note: "Use in press releases and journalist pitches." },
            ].map((row) => (
              <div
                key={row.ctx}
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: radius.lg,
                  padding: 20,
                  boxShadow: shadows.card,
                }}
              >
                <MonoLabel>{row.ctx}</MonoLabel>
                <p
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.h3.size,
                    fontWeight: 600,
                    margin: "10px 0 10px",
                    color: t.coal,
                  }}
                >
                  "{row.line}"
                </p>
                <p style={{ fontSize: type.caption.size, color: t.inkMuted, margin: 0, lineHeight: 1.55 }}>
                  {row.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="Mission, not feature list." />
      </div>
    </>
  );
}
