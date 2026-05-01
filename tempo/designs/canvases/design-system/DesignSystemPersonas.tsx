/* HireStepX — Design System / Customer Personas
   Three core personas. Their context, fears, language, and the moments
   where HireStepX becomes essential. Use to vet every product decision. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
function PersonaCard({
  num,
  name,
  role,
  age,
  city,
  initials,
  copperAvatar,
  oneLiner,
  bio,
  pains,
  wants,
  fears,
  whatTheySay,
  scenario,
}: {
  num: string;
  name: string;
  role: string;
  age: number;
  city: string;
  initials: string;
  copperAvatar?: boolean;
  oneLiner: string;
  bio: string;
  pains: string[];
  wants: string[];
  fears: string[];
  whatTheySay: string;
  scenario: string;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        boxShadow: shadows.card,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      {/* Header strip */}
      <div
        style={{
          background: t.coal,
          color: t.cream,
          padding: "32px 40px",
          display: "grid",
          gridTemplateColumns: "120px 1fr auto",
          gap: 28,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: copperAvatar ? t.copper100 : t.indigo100,
            color: copperAvatar ? t.copper : t.indigo,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: f.serif,
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          {initials}
        </div>
        <div>
          <MonoLabel color={t.copper}>Persona {num}</MonoLabel>
          <h3
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
              margin: "10px 0 6px",
              color: t.cream,
            }}
          >
            {name}
          </h3>
          <p
            style={{
              fontFamily: f.serif,
              fontSize: 18,
              fontStyle: "italic",
              color: t.copper,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            "{oneLiner}"
          </p>
        </div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            color: "rgba(250, 247, 240, .65)",
            lineHeight: 1.7,
            textAlign: "right",
          }}
        >
          <div>{age} years old</div>
          <div>{city}</div>
          <div>{role}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "32px 40px" }}>
        <p
          style={{
            fontSize: 15,
            color: t.indigoGray,
            margin: "0 0 32px",
            lineHeight: 1.7,
          }}
        >
          {bio}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
          {[
            { title: "Pain points", color: t.error, items: pains },
            { title: "What they want", color: t.success, items: wants },
            { title: "What they fear", color: t.copper, items: fears },
          ].map((col) => (
            <div key={col.title}>
              <MonoLabel color={col.color}>{col.title}</MonoLabel>
              <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {col.items.map((item, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 13,
                      color: t.indigoGray,
                      lineHeight: 1.55,
                      paddingLeft: 14,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: col.color,
                      }}
                    >
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* What they say */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 28,
            borderTop: `1px solid ${t.line}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
          }}
        >
          <div>
            <MonoLabel>How they talk</MonoLabel>
            <p
              style={{
                fontFamily: f.serif,
                fontSize: 18,
                fontStyle: "italic",
                color: t.coal,
                margin: "12px 0 0",
                lineHeight: 1.55,
              }}
            >
              "{whatTheySay}"
            </p>
          </div>
          <div>
            <MonoLabel>The HireStepX moment</MonoLabel>
            <p
              style={{
                fontSize: 14,
                color: t.indigoGray,
                margin: "12px 0 0",
                lineHeight: 1.7,
              }}
            >
              {scenario}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function DesignSystemPersonas() {
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
            Personas, by{" "}
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
            Three real people. Read them before every product decision. If
            the answer doesn't help <em>at least one</em> of them in a
            specific way, it's probably the wrong answer.
          </p>
        </header>

        {/* PERSONA 1 */}
        <section style={{ marginBottom: 32 }}>
          <PersonaCard
            num="01"
            name="Arjun Mehta"
            role="Final-year B.Tech · CSE"
            age={21}
            city="Pune · Maharashtra"
            initials="AM"
            copperAvatar
            oneLiner="My placement is in 6 weeks. I haven't done a real interview yet."
            bio="Arjun is a fourth-year computer science student at a Tier 2 engineering college. TCS NQT and Infosys placements are coming up. He's smart, has solved 250 LeetCode problems, but has never been interviewed for a job. His parents are anxious. His seniors warn him that 'just knowing the answer' isn't enough. He has roughly ₹500/month of pocket money."
            pains={[
              "Never been interviewed — pure terror around follow-up questions",
              "₹5,000 coaching is impossible on his budget",
              "YouTube tutorials feel theoretical, don't simulate pressure",
              "Friends won't give honest feedback",
            ]}
            wants={[
              "Specifically TCS NQT prep, not generic interview content",
              "Cheap enough to do every day for a month",
              "Fast feedback — 'is what I'm saying actually good?'",
              "Practice in English (his first language is Marathi)",
            ]}
            fears={[
              "Bombing his only campus shot",
              "Letting his family down",
              "Looking inarticulate in English under pressure",
              "Not knowing what he doesn't know",
            ]}
            whatTheySay="I just need to do, like, 20 of these before my actual one. Just for the reps, you know?"
            scenario="It's Tuesday night. Arjun has 4 weeks until campus placements start. He pays ₹49 for a week of practice and runs his first behavioral interview. Score: 47/100. He sees the breakdown — vague answers, no metrics. He practises every night for 7 days. Score climbs to 71. On placement day, his answer to 'tell me about a time you led a team' lands. He gets the offer."
          />
        </section>

        {/* PERSONA 2 */}
        <section style={{ marginBottom: 32 }}>
          <PersonaCard
            num="02"
            name="Priya Sharma"
            role="Senior Product Designer · Wipro"
            age={28}
            city="Bengaluru · Karnataka"
            initials="PS"
            oneLiner="I haven't interviewed in 3 years. My answers are rusty."
            bio="Priya has been at Wipro for 4 years, last promoted 18 months ago. She's eyeing Razorpay, Cred, and Swiggy for her next move. She knows her craft cold, but the last time she interviewed she was a fresher. Now the questions are different — leadership, strategy, salary negotiation. She earns enough to afford coaching, but most coaches she's tried are generic, US-focused, or don't understand the Indian product landscape."
            pains={[
              "STAR stories feel rusty — hasn't told them in years",
              "Salary negotiation in India feels culturally awkward",
              "Generic interview coaches don't know Razorpay vs Cred vs Swiggy interview patterns",
              "Limited evening hours after work — needs flexibility",
            ]}
            wants={[
              "Practice that respects her experience level (no 'tell me about yourself' 101)",
              "Company-specific question patterns",
              "A safe space to practise saying 'I want ₹35 LPA' out loud",
              "Real follow-up pressure, not scripted",
            ]}
            fears={[
              "Lowballing herself in negotiation",
              "Not articulating her impact at Wipro convincingly",
              "Being passed over for someone with sharper interview skills",
              "Wasting interview-cycle attempts",
            ]}
            whatTheySay="I know I'm good at the job. I just don't know if I'm good at the interview anymore."
            scenario="Sunday evening. Priya pays ₹149 for a Pro month. Her first session: salary negotiation with a Razorpay-style hiring manager persona. She freezes when asked 'what range are you targeting?' — practises three more times that week. By Saturday, she has a script. Two weeks later, she walks into a Razorpay round and confidently anchors at ₹38 LPA. Final offer: ₹34 LPA. Without practice, she'd have anchored at ₹28 LPA and ended at ₹26."
          />
        </section>

        {/* PERSONA 3 */}
        <section style={{ marginBottom: 32 }}>
          <PersonaCard
            num="03"
            name="Rahul Iyer"
            role="On 18-month career break · ex-PM"
            age={34}
            city="Mumbai · Maharashtra"
            initials="RI"
            oneLiner="I took a break for my kid. Now I'm trying to come back."
            bio="Rahul left his Product Manager role at Flipkart 18 months ago to be the primary parent. His daughter just started kindergarten and he's ready to return. The market has changed. Hiring is tougher. He's afraid the 'gap' on his resume will be a liability. He's interviewed twice — both rejections cited 'communication' or 'currentness' as reasons. He needs to rebuild interview muscle without spending a fortune while income is paused."
            pains={[
              "Confidence has eroded after two rejections",
              "Limited income while job-searching — can't afford ₹5K coaches",
              "Career-break questions are awkward and he hasn't rehearsed them",
              "Industry has changed — needs to update vocabulary (AI, agentic, etc.)",
            ]}
            wants={[
              "Specifically how to handle 'why the gap' questions",
              "Modern PM interview questions (2026, not 2022)",
              "A way to practise without judgment",
              "Quick wins to rebuild confidence",
            ]}
            fears={[
              "Being permanently labeled as 'out of touch'",
              "Sabotaging interviews because of nerves, not knowledge",
              "Not making the right comeback before savings run out",
              "His skills atrophying every month he's not interviewing",
            ]}
            whatTheySay="I just need someone to tell me, honestly, where I'm rusty. Not patronising. Just honest."
            scenario="A Monday morning when his daughter is at school. Rahul does one mock interview a day for two weeks — behavioral, then product sense, then case study. He practises the 'why the gap' answer 8 times. The AI's feedback is direct, never patronising. He notices his confidence in his own voice change. Three weeks later, he interviews at a Series B startup. The career-break question comes up. He answers it cleanly, even uses a slight smile. The recruiter moves past it. He gets the offer."
          />
        </section>

        {/* HOW TO USE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="How to use these personas"
            desc="Not for slideshow purposes. For genuine product decisions."
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
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
              {[
                {
                  k: "Before every feature",
                  v: "Ask: which persona benefits, and how specifically? If it's 'all of them, generally', the feature is too vague. Cut it or sharpen it.",
                },
                {
                  k: "Before every copy edit",
                  v: "Read the line out loud. Would Arjun say this? Would Priya use this word? If it sounds like a brochure, rewrite.",
                },
                {
                  k: "Before every pricing decision",
                  v: "Arjun has ₹500/month of pocket money. Priya can absorb ₹149/month easily. Rahul is income-cautious. Pricing must serve all three — that's why we have three tiers.",
                },
                {
                  k: "Before every onboarding flow",
                  v: "Run the flow in each persona's head. Where does Arjun stall? Where does Priya skip? Where does Rahul get reassured?",
                },
                {
                  k: "When deprioritizing a feature",
                  v: "Ask: does any persona genuinely lose if we don't ship this? If no, you have your answer.",
                },
              ].map((row) => (
                <li
                  key={row.k}
                  style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, fontSize: 14, lineHeight: 1.6 }}
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
        <Footer section="Section" tagline="Arjun · Priya · Rahul. Read before every decision." />
      </div>
    </>
  );
}
