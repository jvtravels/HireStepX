/* HireStepX — Design System / Typography
   Self-contained canvas component. No external imports.

   Three families, one signature:
     Instrument Serif  — display serif, with italic accent in copper
     Satoshi     — UI + body sans
     JetBrains Mono — micro-caps, labels, code

   The italic-accent-word treatment is the single most ownable
   visual asset on this product. Protect it. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
/* ─── Atoms ─── */

function FamilyCard({
  family,
  fontStack,
  role,
  weights,
  preview,
  bigPreview,
  bigStyle,
}: {
  family: string;
  fontStack: string;
  role: string;
  weights: string;
  preview: string;
  bigPreview: string;
  bigStyle: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "32px 36px",
        boxShadow: shadows.card,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 32,
        alignItems: "center",
      }}
    >
      <div>
        <MonoLabel>{role}</MonoLabel>
        <h3
          style={{
            fontFamily: fontStack,
            fontSize: 36,
            fontWeight: 400,
            margin: "8px 0 12px",
            letterSpacing: "-0.01em",
            color: t.coal,
          }}
        >
          {family}
        </h3>
        <p
          style={{
            color: t.indigoGray,
            fontSize: 13,
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          {preview}
        </p>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            color: t.inkSoft,
            background: t.creamSoft,
            padding: "8px 12px",
            borderRadius: 6,
            display: "inline-block",
          }}
        >
          {weights}
        </div>
      </div>
      <div
        style={{
          background: t.creamSoft,
          borderRadius: 10,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ ...bigStyle, fontFamily: fontStack }}>{bigPreview}</div>
      </div>
    </div>
  );
}

function ScaleRow({
  label,
  size,
  lineHeight,
  tracking,
  use,
  sample,
  fontStack,
  weight = 400,
  isItalic,
  color,
}: {
  label: string;
  size: number;
  lineHeight: number;
  tracking: string;
  use: string;
  sample: string;
  fontStack: string;
  weight?: number;
  isItalic?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 220px",
        alignItems: "center",
        gap: 24,
        padding: "20px 0",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 11,
            color: t.coal,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: 10,
            color: t.inkSoft,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {size}px · {lineHeight} · {tracking}
        </div>
      </div>
      <div
        style={{
          fontFamily: fontStack,
          fontSize: size,
          lineHeight,
          letterSpacing: tracking,
          fontWeight: weight,
          fontStyle: isItalic ? "italic" : "normal",
          color: color || t.coal,
          margin: 0,
        }}
      >
        {sample}
      </div>
      <div
        style={{
          color: t.indigoGray,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {use}
      </div>
    </div>
  );
}

function Rule({
  kind,
  title,
  body,
  demo,
}: {
  kind: "do" | "dont";
  title: string;
  body: string;
  demo: React.ReactNode;
}) {
  const isDo = kind === "do";
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderLeft: `3px solid ${isDo ? t.success : t.error}`,
        borderRadius: 10,
        padding: "24px 28px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: f.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          padding: "3px 10px",
          borderRadius: 999,
          marginBottom: 16,
          background: isDo ? t.success100 : t.error100,
          color: isDo ? t.success : t.error,
        }}
      >
        {isDo ? "Do" : "Don't"}
      </span>
      <h4
        style={{
          fontFamily: f.serif,
          fontSize: 18,
          fontWeight: 400,
          margin: "0 0 8px",
          lineHeight: 1.3,
        }}
      >
        {title}
      </h4>
      <p
        style={{
          color: t.indigoGray,
          fontSize: 13,
          margin: "0 0 12px",
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
      <div
        style={{
          marginTop: 14,
          background: t.creamSoft,
          borderRadius: 6,
          padding: "14px 16px",
          fontSize: 13,
          color: t.inkSoft,
          lineHeight: 1.6,
        }}
      >
        {demo}
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemTypography() {
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
        <header
          style={{
            borderBottom: `1px solid ${t.line}`,
            paddingBottom: 40,
            marginBottom: 64,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            alignItems: "end",
          }}
        >
          <div>
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
              Typography, by{" "}
              <em style={{ fontStyle: "italic", color: t.copper }}>signature</em>.
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
              Three families. One signature: the italic accent word in
              Instrument Serif, set in copper. Used once per moment. Never twice.
              Everything else is structure around the move.
            </p>
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: f.mono,
              fontSize: 11,
              color: t.inkSoft,
              lineHeight: 1.7,
            }}
          >
            <div>
              <b style={{ color: t.coal, fontWeight: 500 }}>Display</b> Instrument Serif
            </div>
            <div>
              <b style={{ color: t.coal, fontWeight: 500 }}>UI / Body</b> Satoshi
            </div>
            <div>
              <b style={{ color: t.coal, fontWeight: 500 }}>Mono</b> JetBrains
            </div>
            <div>
              <b style={{ color: t.coal, fontWeight: 500 }}>Accent</b> Italic +
              Copper
            </div>
          </div>
        </header>

        {/* 01 — THE SIGNATURE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="The signature"
            desc="The single move that defines HireStepX visually. Protect it from drift."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "56px 64px",
              boxShadow: shadows.card,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: f.serif,
                fontSize: 64,
                fontWeight: 400,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                margin: 0,
                color: t.coal,
              }}
            >
              Clarity{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  color: t.copper,
                }}
              >
                wins
              </em>{" "}
              the interview.
            </p>
            <div
              style={{
                marginTop: 36,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 28,
                paddingTop: 32,
                borderTop: `1px solid ${t.line}`,
              }}
            >
              <div>
                <MonoLabel>Family</MonoLabel>
                <p
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    margin: "8px 0 0",
                    color: t.coal,
                  }}
                >
                  Instrument Serif, italic 400
                </p>
              </div>
              <div>
                <MonoLabel>Color</MonoLabel>
                <p
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    margin: "8px 0 0",
                    color: t.copper,
                    fontStyle: "italic",
                  }}
                >
                  Copper #B45309
                </p>
              </div>
              <div>
                <MonoLabel>Frequency</MonoLabel>
                <p
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    margin: "8px 0 0",
                    color: t.coal,
                  }}
                >
                  Once per moment
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — FAMILIES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Three families"
            desc="One purpose each. Never substitute. Never combine outside their lane."
          />
          <div style={{ display: "grid", gap: 16 }}>
            <FamilyCard
              family="Instrument Serif"
              fontStack={f.serif}
              role="Display · Editorial"
              weights="Regular 400 · Medium 500 · Italic 400 / 500"
              preview="A high-contrast serif designed for editorial display. Used for hero text, section heads, and the score numerals on result screens. Never set below 16px — the optical sizes start to break down."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 140,
                lineHeight: 1,
                fontWeight: 400,
                color: t.coal,
                letterSpacing: "-0.04em",
              }}
            />
            <FamilyCard
              family="Satoshi"
              fontStack={f.sans}
              role="UI · Body"
              weights="Regular 400 · Medium 500 · SemiBold 600 · Bold 700"
              preview="The workhorse. Buttons, form fields, body text, navigation, microcopy. Optimized for screens. Set to 14-15px for body, 12-13px for helper text."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 140,
                lineHeight: 1,
                fontWeight: 500,
                color: t.coal,
                letterSpacing: "-0.04em",
              }}
            />
            <FamilyCard
              family="JetBrains Mono"
              fontStack={f.mono}
              role="Micro · Labels · Data"
              weights="Regular 400 · Medium 500"
              preview="Used in micro-caps for eyebrow labels, in code blocks, and for tabular data (dates, hex codes, file names). Always uppercase + tracked at 0.08-0.12em when used as a label."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 140,
                lineHeight: 1,
                fontWeight: 500,
                color: t.coal,
                letterSpacing: "-0.02em",
              }}
            />
          </div>
        </section>

        {/* 03 — TYPE SCALE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Type scale"
            desc="Modular scale, ratio ~1.250. Each step has one role. Don't invent in-between sizes."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "8px 32px 8px",
              boxShadow: shadows.card,
            }}
          >
            <ScaleRow
              label="Display 1"
              size={64}
              lineHeight={1.05}
              tracking="-0.02em"
              use="Hero text on auth + onboarding. Brand-defining moments."
              sample="Reset your password"
              fontStack={f.serif}
            />
            <ScaleRow
              label="Display 2"
              size={44}
              lineHeight={1.1}
              tracking="-0.02em"
              use="Page titles inside the app, modal heroes."
              sample="Senior Product Designer"
              fontStack={f.serif}
            />
            <ScaleRow
              label="Heading 1"
              size={28}
              lineHeight={1.15}
              tracking="-0.01em"
              use="Section heads inside long-form pages."
              sample="The discipline"
              fontStack={f.serif}
            />
            <ScaleRow
              label="Heading 2"
              size={22}
              lineHeight={1.25}
              tracking="-0.01em"
              use="Card titles, sub-section heads."
              sample="Your weakest area"
              fontStack={f.serif}
            />
            <ScaleRow
              label="Heading 3"
              size={18}
              lineHeight={1.3}
              tracking="0"
              use="Inline panel titles, dense UI."
              sample="Behavioral interview"
              fontStack={f.sans}
              weight={500}
            />
            <ScaleRow
              label="Body"
              size={15}
              lineHeight={1.6}
              tracking="0"
              use="Default body text, form fields, paragraph copy."
              sample="Practice unlimited mock interviews tailored to your resume and target role."
              fontStack={f.sans}
            />
            <ScaleRow
              label="Body small"
              size={13}
              lineHeight={1.55}
              tracking="0"
              use="Helper text, descriptions, secondary copy."
              sample="We'll email you a link to reset your password."
              fontStack={f.sans}
              color={t.indigoGray}
            />
            <ScaleRow
              label="Caption"
              size={12}
              lineHeight={1.5}
              tracking="0"
              use="Form labels, tooltips, footnotes."
              sample="Email address"
              fontStack={f.sans}
              weight={500}
            />
            <ScaleRow
              label="Micro caps"
              size={10}
              lineHeight={1.5}
              tracking="0.12em"
              use="Eyebrow labels, mono-uppercase tags, navigation."
              sample="DESIGN SYSTEM · V1.0"
              fontStack={f.mono}
              weight={500}
              color={t.inkSoft}
            />
            <ScaleRow
              label="Score"
              size={72}
              lineHeight={1}
              tracking="-0.02em"
              use="Hero numerals — clarity score, percentage, single big number."
              sample="62"
              fontStack={f.serif}
              color={t.copper}
            />
            <div style={{ height: 8 }} />
          </div>
        </section>

        {/* 04 — WEIGHT & STYLE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Weight, style, italic"
            desc="When to reach for medium. When italic is allowed. The bold rule."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Instrument Serif · serif rules</MonoLabel>
              <ul
                style={{
                  margin: "16px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 14,
                }}
              >
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>400 only for body display.</b>{" "}
                  500 for emphasis or accent.
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>Italic 500 + copper</b> = the
                  signature. The only italic moment allowed in the system.
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>Never bold (700+).</b> Heavy
                  weights kill the editorial feel. If you need impact, use
                  size, not weight.
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>Minimum 18px.</b> Below this,
                  the letterforms break down on screen. Drop to Satoshi.
                </li>
              </ul>
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
              <MonoLabel color={t.indigo}>Satoshi · sans rules</MonoLabel>
              <ul
                style={{
                  margin: "16px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 14,
                }}
              >
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>400 for body.</b> 500 for
                  buttons, labels, and emphasis.
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>600 only on click targets.</b>{" "}
                  Primary CTA text, prominent links.
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>700 sparingly.</b> Reserved for
                  strong emphasis inside a paragraph (rare).
                </li>
                <li style={{ fontSize: 14, color: t.indigoGray, lineHeight: 1.55 }}>
                  <b style={{ color: t.coal }}>Never italic.</b> Italic is
                  Instrument Serif-copper-only territory.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 05 — LINE HEIGHT & TRACKING */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Line height & tracking"
            desc="Tight when big. Open when small. Mono caps always tracked."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Line height (leading)</MonoLabel>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {[
                  { range: "Display (44+px)", value: "1.05 – 1.15", note: "Tight, dramatic" },
                  { range: "Headings (22-32px)", value: "1.2 – 1.3", note: "Balanced" },
                  { range: "Body (14-16px)", value: "1.55 – 1.7", note: "Easy to read" },
                  { range: "Small (12-13px)", value: "1.4 – 1.5", note: "Compact, no crowding" },
                  { range: "Mono caps (10-11px)", value: "1.5", note: "Comfortable, no overlap" },
                ].map((row) => (
                  <div
                    key={row.range}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 1fr",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: `1px solid ${t.line}`,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 500 }}>{row.range}</span>
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: 12,
                        color: t.indigo,
                      }}
                    >
                      {row.value}
                    </span>
                    <span style={{ color: t.inkSoft, fontSize: 12 }}>{row.note}</span>
                  </div>
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
              <MonoLabel>Letter-spacing (tracking)</MonoLabel>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {[
                  { range: "Display (44+px)", value: "-0.02em", note: "Very tight, optical" },
                  { range: "Headings (22-32px)", value: "-0.01em", note: "Lightly tight" },
                  { range: "Body (14-16px)", value: "0", note: "Default Satoshi spacing" },
                  { range: "Small (12-13px)", value: "0", note: "Default" },
                  { range: "Mono caps (10-11px)", value: "0.08 – 0.12em", note: "Always loose" },
                ].map((row) => (
                  <div
                    key={row.range}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 1fr",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: `1px solid ${t.line}`,
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 500 }}>{row.range}</span>
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: 12,
                        color: t.indigo,
                      }}
                    >
                      {row.value}
                    </span>
                    <span style={{ color: t.inkSoft, fontSize: 12 }}>{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 06 — NUMERALS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Numerals"
            desc="Three contexts. Three families. Never mix."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel color={t.copper}>Display numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.serif,
                  fontSize: 96,
                  fontWeight: 400,
                  lineHeight: 1,
                  color: t.copper,
                  letterSpacing: "-0.03em",
                  margin: "20px 0",
                }}
              >
                62
              </div>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: 0, lineHeight: 1.55 }}>
                Instrument Serif, copper. The score moment. One per screen.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel color={t.indigo}>UI numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.sans,
                  fontSize: 48,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: t.coal,
                  margin: "20px 0",
                }}
              >
                ₹149
              </div>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: 0, lineHeight: 1.55 }}>
                Satoshi, coal. Pricing, counts, in-line stats.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: "28px 32px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel>Data numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: 22,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: t.coal,
                  margin: "20px 0",
                  letterSpacing: "0.02em",
                }}
              >
                #B45309
                <br />
                15.9 : 1
              </div>
              <p style={{ fontSize: 13, color: t.indigoGray, margin: 0, lineHeight: 1.55 }}>
                JetBrains Mono. Tabular. Hex codes, contrast ratios, file
                names, dates.
              </p>
            </div>
          </div>
        </section>

        {/* 07 — DO / DON'T */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Do & don't"
            desc="The pitfalls. The discipline. Common drift moves caught early."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <Rule
              kind="do"
              title="One italic accent word per screen."
              body="The italic-Instrument Serif-copper move is the brand. Pick the most important word in the hero. That's it."
              demo={
                <>
                  <span style={{ fontFamily: f.serif, fontSize: 22, color: t.coal }}>
                    Reset your{" "}
                    <em
                      style={{
                        fontStyle: "italic",
                        fontWeight: 500,
                        color: t.copper,
                      }}
                    >
                      password
                    </em>
                  </span>
                </>
              }
            />
            <Rule
              kind="dont"
              title="Italicize multiple words in one hero."
              body="Two italics dilutes both. Three is graphic chaos."
              demo={
                <span style={{ fontFamily: f.serif, fontSize: 22, color: t.coal }}>
                  ❌ <em style={{ fontStyle: "italic", color: t.copper }}>Reset</em>{" "}
                  your{" "}
                  <em style={{ fontStyle: "italic", color: t.copper }}>own</em>{" "}
                  <em style={{ fontStyle: "italic", color: t.copper }}>password</em>
                </span>
              }
            />
            <Rule
              kind="do"
              title="Set body in Satoshi at 14-15px."
              body="Satoshi is engineered for screens. 14-15px hits the readability sweet spot for most adult readers."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                  Practice unlimited mock interviews tailored to your resume
                  and target role. Score, learn, repeat — until you're ready.
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Set body in Instrument Serif."
              body="Serifs at 14-16px lose all the optical magic that makes them feel premium at display sizes. Looks cheap."
              demo={
                <span style={{ fontFamily: f.serif, fontSize: 14, color: t.indigoGray, lineHeight: 1.6 }}>
                  ❌ "Practice unlimited mock interviews tailored to your
                  resume…" Looks dated and fights legibility.
                </span>
              }
            />
            <Rule
              kind="do"
              title="Use weight for emphasis, not italic."
              body="Inside a paragraph, bump to medium 500 or semibold 600 to draw the eye. Italic is reserved for the brand signature."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.7 }}>
                  Your interview readiness is{" "}
                  <b style={{ fontWeight: 600 }}>62 out of 100</b> — strong
                  foundation, room to push.
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Italicize in body text."
              body="Steals the visual budget reserved for the hero accent. Reads as Word-document italics, not editorial."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.7 }}>
                  ❌ Your interview readiness is{" "}
                  <i>62 out of 100</i> — diluted and off-brand.
                </span>
              }
            />
            <Rule
              kind="do"
              title="Mono-caps for eyebrow labels."
              body="JetBrains Mono, 10-11px, uppercase, tracked at 0.12em. Used above any section heading or important block."
              demo={
                <>
                  <MonoLabel color={t.copper}>Section · 04</MonoLabel>
                  <span
                    style={{
                      fontFamily: f.serif,
                      fontSize: 22,
                      color: t.coal,
                      display: "block",
                      marginTop: 8,
                    }}
                  >
                    The discipline
                  </span>
                </>
              }
            />
            <Rule
              kind="dont"
              title="Satoshi caps for labels."
              body="Satoshi at small caps loses its character. JetBrains Mono adds the technical-precision feel that matches the brand."
              demo={
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: t.inkSoft,
                  }}
                >
                  ❌ SECTION · 04 — Looks generic, every SaaS does this.
                </span>
              }
            />
          </div>
        </section>

        {/* 08 — LIVING EXAMPLES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Living examples"
            desc="The system applied. Hero, card, button, data — every word in its right family."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            {/* Hero example */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 36,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Hero · auth screen</MonoLabel>
              <h3
                style={{
                  fontFamily: f.serif,
                  fontSize: 44,
                  fontWeight: 400,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  margin: "16px 0 12px",
                  color: t.coal,
                }}
              >
                Check your{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 500,
                    color: t.copper,
                  }}
                >
                  email
                </em>
              </h3>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: 14,
                  color: t.indigoGray,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                We've sent a verification link to{" "}
                <b style={{ color: t.coal, fontWeight: 600 }}>
                  jay@example.com
                </b>
                . It usually arrives within 30 seconds.
              </p>
            </div>

            {/* Card example */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 36,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Score card · result</MonoLabel>
              <div
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  background: t.creamSoft,
                  borderRadius: 10,
                  padding: "28px 24px",
                }}
              >
                <MonoLabel>Clarity Score</MonoLabel>
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 80,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: t.copper,
                    letterSpacing: "-0.03em",
                    margin: "10px 0",
                  }}
                >
                  62
                  <small
                    style={{
                      fontSize: 22,
                      color: t.inkFaint,
                      marginLeft: 4,
                    }}
                  >
                    /100
                  </small>
                </div>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "3px 12px",
                    background: t.copperSoft,
                    color: t.copper,
                    borderRadius: 999,
                  }}
                >
                  Fair · room to grow
                </span>
              </div>
            </div>

            {/* Button + label */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 36,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>UI · button + label</MonoLabel>
              <label
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  display: "block",
                  margin: "16px 0 8px",
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={{
                  width: "100%",
                  fontFamily: f.sans,
                  fontSize: 14,
                  padding: "12px 14px",
                  border: `1px solid ${t.lineStrong}`,
                  borderRadius: 10,
                  background: t.white,
                  color: t.coal,
                  outline: "none",
                  marginBottom: 16,
                }}
              />
              <button
                style={{
                  background: t.indigo,
                  color: t.white,
                  border: "none",
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontFamily: f.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue to practise →
              </button>
            </div>

            {/* Data row */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 36,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Data · session row</MonoLabel>
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    fontWeight: 500,
                    color: t.coal,
                    margin: 0,
                  }}
                >
                  Behavioral · standard
                </div>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 11,
                    color: t.inkSoft,
                    letterSpacing: "0.04em",
                    margin: "6px 0 12px",
                  }}
                >
                  MAY 14, 2026 · 10:32 AM · 15 MIN
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: f.serif,
                      fontSize: 36,
                      fontWeight: 500,
                      color: t.copper,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    78
                  </span>
                  <span
                    style={{
                      fontFamily: f.sans,
                      fontSize: 12,
                      fontWeight: 500,
                      color: t.success,
                    }}
                  >
                    +6 from last
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 09 — CSS TOKENS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="09"
            title="CSS variables"
            desc="Single source of truth. Drop into your stylesheet."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: 14,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
              margin: 0,
            }}
          >
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* HireStepX — Typography tokens */"}
            </span>
            {`\n:root {\n  `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Families */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-serif</span>
            {`:    `}
            <span style={{ color: "#f4d4a8" }}>
              "Instrument Serif", Georgia, serif;
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-sans</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>
              "Satoshi", -apple-system, system-ui, sans-serif;
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-mono</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>
              "JetBrains Mono", monospace;
            </span>
            {`\n\n  `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Sizes */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-display-1</span>
            {`: `}
            <span style={{ color: "#f4d4a8" }}>64px;</span>
            {`     `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* hero */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-display-2</span>
            {`: `}
            <span style={{ color: "#f4d4a8" }}>44px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-h1</span>
            {`:        `}
            <span style={{ color: "#f4d4a8" }}>28px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-h2</span>
            {`:        `}
            <span style={{ color: "#f4d4a8" }}>22px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-h3</span>
            {`:        `}
            <span style={{ color: "#f4d4a8" }}>18px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-body</span>
            {`:      `}
            <span style={{ color: "#f4d4a8" }}>15px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-body-sm</span>
            {`:   `}
            <span style={{ color: "#f4d4a8" }}>13px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-caption</span>
            {`:   `}
            <span style={{ color: "#f4d4a8" }}>12px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-micro</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>10px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-score</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>72px;</span>
            {`     `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* clarity score */"}
            </span>
            {`\n\n  `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Weights */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--weight-regular</span>
            {`: `}
            <span style={{ color: "#f4d4a8" }}>400;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--weight-medium</span>
            {`:  `}
            <span style={{ color: "#f4d4a8" }}>500;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--weight-semibold</span>
            {`:`}
            <span style={{ color: "#f4d4a8" }}>600;</span>
            {`     `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* CTAs only */"}
            </span>
            {`\n\n  `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Leading */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-display</span>
            {`: `}
            <span style={{ color: "#f4d4a8" }}>1.05;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-heading</span>
            {`: `}
            <span style={{ color: "#f4d4a8" }}>1.25;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-body</span>
            {`:    `}
            <span style={{ color: "#f4d4a8" }}>1.6;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-mono</span>
            {`:    `}
            <span style={{ color: "#f4d4a8" }}>1.5;</span>
            {`\n\n  `}
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"/* Tracking */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-display</span>
            {`:  `}
            <span style={{ color: "#f4d4a8" }}>-0.02em;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-heading</span>
            {`:  `}
            <span style={{ color: "#f4d4a8" }}>-0.01em;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-body</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>0;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-caps</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>0.12em;</span>
            {`\n}`}
          </pre>
        </section>

        {/* 10 — IMPORT CODE */}
        <section style={{ marginBottom: 40 }}>
          <SectionHead
            num="10"
            title="Loading the fonts"
            desc="Google Fonts. Subsetted to the weights actually used. Drop into your <head>."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: 14,
              padding: "28px 32px",
              fontFamily: f.mono,
              fontSize: 12,
              lineHeight: 1.7,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: "#6b6660", fontStyle: "italic" }}>
              {"<!-- Add to your HTML <head> -->\n"}
            </span>
            <span style={{ color: "#c4a8ff" }}>
              {'<link rel="preconnect" href="https://fonts.googleapis.com" />\n'}
              {'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'}
              {'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" />'}
            </span>
          </pre>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="One italic accent word per moment. Never twice." />
      </div>
    </>
  );
}
