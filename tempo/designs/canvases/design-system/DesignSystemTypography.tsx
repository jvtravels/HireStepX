/* HireStepX — Design System / Typography
   Self-contained canvas component. No external imports.

   2026-09 SaaS-flat conversion: AF Sobremesa stays the typeface for both
   the `serif` and `sans` roles below — no font-family swap — but it no
   longer carries a separate "display serif identity" sized for magazine
   drama. Headings now run through the compact, functional `type` scale
   (see _tokens.ts): h1 28 down to micro 11, ~1.2-1.33x steps, tight
   line-heights, restrained tracking — the way Linear/Notion/Stripe size
   type. Copper is the one UI accent (primary CTAs, active/selected
   states, links, focus rings) — never a decorative headline color.

   Two families:
     AF Sobremesa   — one family, two roles: headings and UI/body,
                       differentiated by weight, not by typeface or size
     JetBrains Mono — micro-caps, labels, code */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens as t, fonts as f, shadows, type, radius } from "./_tokens";
import { MonoLabel, SectionHead, Footer, PageHeader } from "./_atoms";
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
        borderRadius: radius.lg,
        padding: "28px 32px",
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
            fontSize: type.h3.size,
            fontWeight: type.h3.weight,
            margin: "8px 0 12px",
            lineHeight: type.h3.lineHeight,
            color: t.coal,
          }}
        >
          {family}
        </h3>
        <p
          style={{
            color: t.inkMuted,
            fontSize: type.small.size,
            lineHeight: type.small.lineHeight,
            margin: "0 0 20px",
          }}
        >
          {preview}
        </p>
        <div
          style={{
            fontFamily: f.mono,
            fontSize: type.micro.size,
            color: t.inkSoft,
            background: t.creamSoft,
            padding: "8px 12px",
            borderRadius: radius.sm,
            display: "inline-block",
          }}
        >
          {weights}
        </div>
      </div>
      <div
        style={{
          background: t.creamSoft,
          borderRadius: radius.md,
          padding: "28px 24px",
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
          color: color || t.coal,
          margin: 0,
        }}
      >
        {sample}
      </div>
      <div
        style={{
          color: t.inkMuted,
          fontSize: type.caption.size,
          lineHeight: type.caption.lineHeight,
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
        borderRadius: radius.md,
        padding: "24px 28px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: f.mono,
          fontSize: type.micro.size,
          textTransform: "uppercase",
          letterSpacing: type.micro.letterSpacing,
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
          fontFamily: f.sans,
          fontSize: type.h3.size,
          fontWeight: type.h3.weight,
          margin: "0 0 8px",
          lineHeight: type.h3.lineHeight,
          color: t.coal,
        }}
      >
        {title}
      </h4>
      <p
        style={{
          color: t.inkMuted,
          fontSize: type.small.size,
          margin: "0 0 12px",
          lineHeight: type.small.lineHeight,
        }}
      >
        {body}
      </p>
      <div
        style={{
          marginTop: 14,
          background: t.creamSoft,
          borderRadius: radius.sm,
          padding: "14px 16px",
          fontSize: type.small.size,
          color: t.inkSoft,
          lineHeight: type.small.lineHeight,
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
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "56px 48px 96px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* HEADER — demonstrates the PageHeader pattern: plain title, no
            decorative accent word. See _atoms.tsx PageHeader. */}
        <PageHeader
          title="Typography"
          description="One typeface, sized functionally. A compact scale from h1 down to micro, tight line-heights, restrained tracking — built for information density, not billboard moments."
          metaRight={
            <>
              <div>
                <b style={{ color: t.coal, fontWeight: 500 }}>Headings</b> AF Sobremesa
              </div>
              <div>
                <b style={{ color: t.coal, fontWeight: 500 }}>UI / Body</b> AF Sobremesa
              </div>
              <div>
                <b style={{ color: t.coal, fontWeight: 500 }}>Mono</b> JetBrains
              </div>
              <div>
                <b style={{ color: t.coal, fontWeight: 500 }}>Accent</b> Copper
              </div>
            </>
          }
        />

        {/* 01 — THE ACCENT DISCIPLINE */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="01"
            title="The accent discipline"
            desc="Copper is the one UI accent, used sparingly — primary buttons, active states, links, focus rings. Not decoration."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "40px 48px",
              boxShadow: shadows.card,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: f.sans,
                fontSize: type.h1.size,
                fontWeight: type.h1.weight,
                lineHeight: type.h1.lineHeight,
                letterSpacing: type.h1.letterSpacing,
                margin: 0,
                color: t.coal,
              }}
            >
              Clarity wins the interview.
            </p>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
              <button
                style={{
                  background: t.copper,
                  color: t.white,
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: radius.md,
                  fontFamily: f.sans,
                  fontSize: type.body.size,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Start practising →
              </button>
            </div>
            <div
              style={{
                marginTop: 32,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 24,
                paddingTop: 28,
                borderTop: `1px solid ${t.line}`,
              }}
            >
              <div>
                <MonoLabel>What gets copper</MonoLabel>
                <p style={{ fontSize: type.small.size, margin: "8px 0 0", color: t.coal }}>
                  Primary buttons, active/selected states, links, focus rings
                </p>
              </div>
              <div>
                <MonoLabel>What doesn't</MonoLabel>
                <p style={{ fontSize: type.small.size, margin: "8px 0 0", color: t.coal }}>
                  Headline words, section labels, plain numerals, decoration
                </p>
              </div>
              <div>
                <MonoLabel>Frequency</MonoLabel>
                <p style={{ fontSize: type.small.size, margin: "8px 0 0", color: t.coal }}>
                  Roughly ≤10% of any given surface
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 02 — FAMILIES */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="02"
            title="Two families"
            desc="One purpose each. Never substitute. Never combine outside their lane."
          />
          <div style={{ display: "grid", gap: 12 }}>
            <FamilyCard
              family="AF Sobremesa"
              fontStack={f.sans}
              role="Headings"
              weights="Medium 500 · SemiBold 600"
              preview="Sized functionally through the compact scale (h1 28 down to h4 16) — not a separate display identity. Used for section heads, card titles, and page headers."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 32,
                lineHeight: 1,
                fontWeight: 600,
                color: t.coal,
                letterSpacing: type.h1.letterSpacing,
              }}
            />
            <FamilyCard
              family="AF Sobremesa"
              fontStack={f.sans}
              role="UI · Body"
              weights="Regular 400 · Medium 500 · SemiBold 600"
              preview="The workhorse. Buttons, form fields, body text, navigation, microcopy. Set to 14-15px for body, 12-13px for helper text."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 32,
                lineHeight: 1,
                fontWeight: 500,
                color: t.coal,
                letterSpacing: "0",
              }}
            />
            <FamilyCard
              family="JetBrains Mono"
              fontStack={f.mono}
              role="Micro · Labels · Data"
              weights="Regular 400 · Medium 500"
              preview="Used in micro-caps for eyebrow labels, in code blocks, and for tabular data (dates, hex codes, file names). Uppercase + tracked at 0.04em when used as a label."
              bigPreview="Aa"
              bigStyle={{
                fontSize: 32,
                lineHeight: 1,
                fontWeight: 500,
                color: t.coal,
                letterSpacing: "0",
              }}
            />
          </div>
        </section>

        {/* 03 — TYPE SCALE */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="03"
            title="Type scale"
            desc="Compact functional scale, ~1.2-1.33x steps. Each step has one role. Don't invent in-between sizes."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: radius.lg,
              padding: "8px 32px 8px",
              boxShadow: shadows.card,
            }}
          >
            <ScaleRow
              label="H1"
              size={type.h1.size}
              lineHeight={type.h1.lineHeight}
              tracking={type.h1.letterSpacing}
              use="Page headers, top-of-page titles."
              sample="Reset your password"
              fontStack={f.sans}
              weight={type.h1.weight}
            />
            <ScaleRow
              label="H2"
              size={type.h2.size}
              lineHeight={type.h2.lineHeight}
              tracking={type.h2.letterSpacing}
              use="Section heads inside long-form pages."
              sample="The accent discipline"
              fontStack={f.sans}
              weight={type.h2.weight}
            />
            <ScaleRow
              label="H3"
              size={type.h3.size}
              lineHeight={type.h3.lineHeight}
              tracking="0"
              use="Card titles, sub-section heads."
              sample="Your weakest area"
              fontStack={f.sans}
              weight={type.h3.weight}
            />
            <ScaleRow
              label="H4"
              size={type.h4.size}
              lineHeight={type.h4.lineHeight}
              tracking="0"
              use="Inline panel titles, dense UI."
              sample="Behavioral interview"
              fontStack={f.sans}
              weight={type.h4.weight}
            />
            <ScaleRow
              label="Body LG"
              size={type.bodyLg.size}
              lineHeight={type.bodyLg.lineHeight}
              tracking="0"
              use="Lead paragraphs, header descriptions."
              sample="Practice unlimited mock interviews tailored to your resume and target role."
              fontStack={f.sans}
              weight={type.bodyLg.weight}
            />
            <ScaleRow
              label="Body"
              size={type.body.size}
              lineHeight={type.body.lineHeight}
              tracking="0"
              use="Default body text, form fields, paragraph copy."
              sample="We'll email you a link to reset your password."
              fontStack={f.sans}
              weight={type.body.weight}
              color={t.inkMuted}
            />
            <ScaleRow
              label="Small"
              size={type.small.size}
              lineHeight={type.small.lineHeight}
              tracking="0"
              use="Helper text, descriptions, secondary copy."
              sample="Helper text and secondary descriptions"
              fontStack={f.sans}
              weight={type.small.weight}
              color={t.inkMuted}
            />
            <ScaleRow
              label="Caption"
              size={type.caption.size}
              lineHeight={type.caption.lineHeight}
              tracking="0"
              use="Form labels, tooltips, footnotes."
              sample="Email address"
              fontStack={f.sans}
              weight={type.caption.weight}
            />
            <ScaleRow
              label="Micro"
              size={type.micro.size}
              lineHeight={type.micro.lineHeight}
              tracking={type.micro.letterSpacing}
              use="Eyebrow labels, mono-uppercase tags, navigation."
              sample="DESIGN SYSTEM · V1.0"
              fontStack={f.mono}
              weight={type.micro.weight}
              color={t.inkSoft}
            />
            <div style={{ height: 8 }} />
          </div>
        </section>

        {/* 04 — WEIGHT & STYLE */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="04"
            title="Weight and style"
            desc="When to reach for medium. When to reach for semibold. The accent rule."
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
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Headings (h1-h4)</MonoLabel>
              <ul
                style={{
                  margin: "16px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 14,
                }}
              >
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>600 (SemiBold) is the default.</b>{" "}
                  Every step in the scale (h1-h4) carries the same weight.
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>Size carries hierarchy, not weight.</b>{" "}
                  Don't reach for a heavier weight to make a heading feel bigger — move up a step instead.
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>Never bold (700+).</b>{" "}
                  Heavy weights read as loud, not important, at these compact sizes.
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>Neutral ink, not copper.</b>{" "}
                  Copper is reserved for actions and states, never a headline color.
                </li>
              </ul>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>UI / body</MonoLabel>
              <ul
                style={{
                  margin: "16px 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: 14,
                }}
              >
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>400 for body.</b> 500 for
                  buttons, labels, and emphasis.
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>600 on click targets.</b>{" "}
                  Primary CTA text, prominent links.
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>700 sparingly.</b> Reserved for
                  strong emphasis inside a paragraph (rare).
                </li>
                <li style={{ fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  <b style={{ color: t.coal }}>Copper only on the action itself.</b>{" "}
                  The button or link, not the surrounding text.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 05 — LINE HEIGHT & TRACKING */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="05"
            title="Line height & tracking"
            desc="Tight and consistent across the whole scale. Mono caps get the only real tracking."
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
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Line height (leading)</MonoLabel>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {[
                  { range: "H1 (28px)", value: "1.25", note: "Tightest, still legible" },
                  { range: "H2-H4 (16-22px)", value: "1.3 – 1.4", note: "Balanced" },
                  { range: "Body (14-15px)", value: "1.5", note: "Easy to read, still dense" },
                  { range: "Small / caption (12-13px)", value: "1.4 – 1.45", note: "Compact, no crowding" },
                  { range: "Micro (11px)", value: "1.35", note: "Comfortable, no overlap" },
                ].map((row) => (
                  <div
                    key={row.range}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 1fr",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: `1px solid ${t.line}`,
                      fontSize: type.small.size,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 500 }}>{row.range}</span>
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: type.caption.size,
                        color: t.inkMuted,
                      }}
                    >
                      {row.value}
                    </span>
                    <span style={{ color: t.inkSoft, fontSize: type.caption.size }}>{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Letter-spacing (tracking)</MonoLabel>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                {[
                  { range: "H1 (28px)", value: "-0.01em", note: "Slightly tight, optical" },
                  { range: "H2 (22px)", value: "-0.006em", note: "Barely tight" },
                  { range: "H3-H4 / body", value: "0", note: "Default AF Sobremesa spacing" },
                  { range: "Small / caption", value: "0", note: "Default" },
                  { range: "Micro (11px)", value: "0.04em", note: "Light, for uppercase labels" },
                ].map((row) => (
                  <div
                    key={row.range}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 1fr",
                      gap: 16,
                      padding: "10px 0",
                      borderBottom: `1px solid ${t.line}`,
                      fontSize: type.small.size,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 500 }}>{row.range}</span>
                    <span
                      style={{
                        fontFamily: f.mono,
                        fontSize: type.caption.size,
                        color: t.inkMuted,
                      }}
                    >
                      {row.value}
                    </span>
                    <span style={{ color: t.inkSoft, fontSize: type.caption.size }}>{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 06 — NUMERALS */}
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="06"
            title="Numerals"
            desc="Three contexts. Two families. Never mix."
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
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel>Hero numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.sans,
                  fontSize: 40,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: t.coal,
                  letterSpacing: type.h1.letterSpacing,
                  margin: "20px 0",
                }}
              >
                62
              </div>
              <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                AF Sobremesa, semibold, neutral ink. The score moment — bold weight carries the emphasis, not color.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel>UI numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.sans,
                  fontSize: 28,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: t.coal,
                  margin: "20px 0",
                }}
              >
                ₹149
              </div>
              <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
                AF Sobremesa's UI weight, coal. Pricing, counts, in-line stats.
              </p>
            </div>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: "24px 28px",
                boxShadow: shadows.card,
                textAlign: "center",
              }}
            >
              <MonoLabel>Data numerals</MonoLabel>
              <div
                style={{
                  fontFamily: f.mono,
                  fontSize: type.h4.size,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  color: t.coal,
                  margin: "20px 0",
                  letterSpacing: "0.02em",
                }}
              >
                #BB4D00
                <br />
                15.9 : 1
              </div>
              <p style={{ fontSize: type.small.size, color: t.inkMuted, margin: 0, lineHeight: type.small.lineHeight }}>
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
              title="One clear primary action per screen, always in the accent color."
              body="Copper marks the one thing to do next — a button, a link, an active tab. Never a headline word."
              demo={
                <span
                  style={{
                    display: "inline-block",
                    background: t.copper,
                    color: t.white,
                    fontFamily: f.sans,
                    fontSize: type.body.size,
                    fontWeight: 600,
                    padding: "8px 16px",
                    borderRadius: radius.sm,
                  }}
                >
                  Reset password
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Use copper as a decorative headline color."
              body="Coloring a headline word in copper reads as decoration, not action — it dilutes copper's meaning everywhere else."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: type.h3.size, color: t.coal, fontWeight: 600 }}>
                  ❌ Reset your <span style={{ color: t.copper }}>password</span>
                </span>
              }
            />
            <Rule
              kind="do"
              title="Set body in the UI/body weight at 14-15px."
              body="14-15px hits the readability sweet spot for most adult readers, at the regular weight."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: type.body.size, color: t.inkMuted, lineHeight: type.body.lineHeight }}>
                  Practice unlimited mock interviews tailored to your resume
                  and target role. Score, learn, repeat — until you're ready.
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Oversize body copy into heading territory."
              body="A paragraph set at 18px+ reads as a design accident, not confidence — it also breaks the compact rhythm of the page."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: 20, color: t.inkMuted, lineHeight: 1.4 }}>
                  ❌ "Practice unlimited mock interviews tailored to your
                  resume…" Fights the surrounding density.
                </span>
              }
            />
            <Rule
              kind="do"
              title="Use weight for emphasis, not color."
              body="Inside a paragraph, bump to medium 500 or semibold 600 to draw the eye. Copper stays reserved for the action layer."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: type.body.size, color: t.coal, lineHeight: type.body.lineHeight }}>
                  Your interview readiness is{" "}
                  <b style={{ fontWeight: 600 }}>62 out of 100</b> — strong
                  foundation, room to push.
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Italicize anything."
              body="Italics aren't part of the system anywhere — not even for a 'wrong-example' callout. Use weight or color for emphasis instead."
              demo={
                <span style={{ fontFamily: f.sans, fontSize: type.body.size, color: t.coal, lineHeight: type.body.lineHeight }}>
                  ❌ <code style={{ fontFamily: f.mono, fontSize: type.caption.size, background: t.creamSoft, padding: "2px 6px", borderRadius: radius.sm }}>font-style: italic</code>{" "}
                  — not used anywhere in this system.
                </span>
              }
            />
            <Rule
              kind="do"
              title="Mono-caps for eyebrow labels."
              body="JetBrains Mono, 11px, uppercase, tracked at 0.04em. Used above any section heading or important block."
              demo={
                <>
                  <MonoLabel>Section · 04</MonoLabel>
                  <span
                    style={{
                      fontFamily: f.sans,
                      fontSize: type.h2.size,
                      fontWeight: type.h2.weight,
                      color: t.coal,
                      display: "block",
                      marginTop: 8,
                    }}
                  >
                    Weight and style
                  </span>
                </>
              }
            />
            <Rule
              kind="dont"
              title="AF Sobremesa caps for labels."
              body="AF Sobremesa at small caps loses its character. JetBrains Mono adds the technical-precision feel that matches the brand."
              demo={
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.micro.size,
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
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="08"
            title="Living examples"
            desc="The system applied. Hero, card, button, data — every word in its right family."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            {/* Hero example */}
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: radius.lg,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Hero · auth screen</MonoLabel>
              <h3
                style={{
                  fontFamily: f.sans,
                  fontSize: type.h1.size,
                  fontWeight: type.h1.weight,
                  lineHeight: type.h1.lineHeight,
                  letterSpacing: type.h1.letterSpacing,
                  margin: "12px 0 10px",
                  color: t.coal,
                }}
              >
                Check your email
              </h3>
              <p
                style={{
                  fontFamily: f.sans,
                  fontSize: type.body.size,
                  color: t.inkMuted,
                  lineHeight: type.body.lineHeight,
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
                borderRadius: radius.lg,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Score card · result</MonoLabel>
              <div
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  background: t.creamSoft,
                  borderRadius: radius.md,
                  padding: "24px 20px",
                }}
              >
                <MonoLabel>Clarity Score</MonoLabel>
                <div
                  style={{
                    fontFamily: f.sans,
                    fontSize: 40,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: t.coal,
                    letterSpacing: type.h1.letterSpacing,
                    margin: "10px 0",
                  }}
                >
                  62
                  <small
                    style={{
                      fontSize: type.h2.size,
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
                    fontSize: type.caption.size,
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
                borderRadius: radius.lg,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>UI · button + label</MonoLabel>
              <label
                style={{
                  fontFamily: f.sans,
                  fontSize: type.caption.size,
                  color: t.coal,
                  fontWeight: type.caption.weight,
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
                  fontSize: type.body.size,
                  padding: "10px 14px",
                  border: `1px solid ${t.lineStrong}`,
                  borderRadius: radius.md,
                  background: t.white,
                  color: t.coal,
                  outline: "none",
                  marginBottom: 16,
                }}
              />
              <button
                style={{
                  background: t.copper,
                  color: t.white,
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: radius.md,
                  fontFamily: f.sans,
                  fontSize: type.body.size,
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
                borderRadius: radius.lg,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel>Data · session row</MonoLabel>
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    fontFamily: f.sans,
                    fontSize: type.h3.size,
                    fontWeight: type.h3.weight,
                    color: t.coal,
                    margin: 0,
                  }}
                >
                  Behavioral · standard
                </div>
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: type.micro.size,
                    color: t.inkSoft,
                    letterSpacing: type.micro.letterSpacing,
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
                      fontFamily: f.sans,
                      fontSize: type.h1.size,
                      fontWeight: 600,
                      color: t.coal,
                      letterSpacing: type.h1.letterSpacing,
                    }}
                  >
                    78
                  </span>
                  <span
                    style={{
                      fontFamily: f.sans,
                      fontSize: type.caption.size,
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
        <section style={{ marginBottom: 64 }}>
          <SectionHead
            num="09"
            title="CSS variables"
            desc="Single source of truth. Drop into your stylesheet."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: radius.lg,
              padding: "24px 28px",
              fontFamily: f.mono,
              fontSize: 13,
              lineHeight: 1.8,
              overflowX: "auto",
              margin: 0,
            }}
          >
            <span style={{ color: "#6b6660" }}>
              {"/* HireStepX — Typography tokens */"}
            </span>
            {`\n:root {\n  `}
            <span style={{ color: "#6b6660" }}>
              {"/* Families */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-serif</span>
            {`:    `}
            <span style={{ color: "#f4d4a8" }}>
              "AF Sobremesa", Georgia, serif;
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-sans</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>
              "AF Sobremesa", -apple-system, system-ui, sans-serif;
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--font-mono</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>
              "JetBrains Mono", monospace;
            </span>
            {`\n\n  `}
            <span style={{ color: "#6b6660" }}>
              {"/* Sizes — compact functional scale */"}
            </span>
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
            <span style={{ color: "#c4a8ff" }}>--text-h4</span>
            {`:        `}
            <span style={{ color: "#f4d4a8" }}>16px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-body-lg</span>
            {`:   `}
            <span style={{ color: "#f4d4a8" }}>15px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-body</span>
            {`:      `}
            <span style={{ color: "#f4d4a8" }}>14px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-small</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>13px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-caption</span>
            {`:   `}
            <span style={{ color: "#f4d4a8" }}>12px;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--text-micro</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>11px;</span>
            {`\n\n  `}
            <span style={{ color: "#6b6660" }}>
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
            <span style={{ color: "#6b6660" }}>
              {"/* headings + CTAs */"}
            </span>
            {`\n\n  `}
            <span style={{ color: "#6b6660" }}>
              {"/* Leading */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-h1</span>
            {`:      `}
            <span style={{ color: "#f4d4a8" }}>1.25;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-h2</span>
            {`:      `}
            <span style={{ color: "#f4d4a8" }}>1.3;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-body</span>
            {`:    `}
            <span style={{ color: "#f4d4a8" }}>1.5;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--leading-micro</span>
            {`:   `}
            <span style={{ color: "#f4d4a8" }}>1.35;</span>
            {`\n\n  `}
            <span style={{ color: "#6b6660" }}>
              {"/* Tracking */"}
            </span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-h1</span>
            {`:       `}
            <span style={{ color: "#f4d4a8" }}>-0.01em;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-h2</span>
            {`:       `}
            <span style={{ color: "#f4d4a8" }}>-0.006em;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-body</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>0;</span>
            {`\n  `}
            <span style={{ color: "#c4a8ff" }}>--track-caps</span>
            {`:     `}
            <span style={{ color: "#f4d4a8" }}>0.04em;</span>
            {`\n}`}
          </pre>
        </section>

        {/* 10 — IMPORT CODE */}
        <section style={{ marginBottom: 40 }}>
          <SectionHead
            num="10"
            title="Loading the fonts"
            desc="AF Sobremesa self-hosted from /fonts; JetBrains Mono from Google Fonts."
          />
          <pre
            style={{
              background: t.coal,
              color: "#d8d2c0",
              borderRadius: radius.lg,
              padding: "24px 28px",
              fontFamily: f.mono,
              fontSize: type.caption.size,
              lineHeight: 1.7,
              overflowX: "auto",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            <span style={{ color: "#6b6660" }}>
              {"/* AF Sobremesa — self-hosted, weights 100-900 + italic */\n"}
            </span>
            <span style={{ color: "#c4a8ff" }}>
              {"@import url('/fonts/af-sobremesa.css');\n"}
            </span>
            <span style={{ color: "#6b6660" }}>
              {"\n/* JetBrains Mono — Google Fonts */\n"}
            </span>
            <span style={{ color: "#c4a8ff" }}>
              {"@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');"}
            </span>
          </pre>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="One accent color, used sparingly. Everything else is neutral ink." />
      </div>
    </>
  );
}
