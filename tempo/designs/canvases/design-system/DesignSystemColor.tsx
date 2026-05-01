/* HireStepX — Design System / Color
   Self-contained canvas component. No external imports.
   Discipline rule: Indigo is interactive · Copper is editorial · Never mix. */
import React from "react";
import { tokens, fonts, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";

/* ─── Reusable atoms ─── */

function Hex({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 11,
        color: tokens.coal,
        background: tokens.creamSoft,
        padding: "3px 8px",
        borderRadius: 4,
        display: "inline-block",
      }}
    >
      {value}
    </span>
  );
}

function Swatch({
  bg,
  name,
  role,
  hex,
  overlay,
  dark,
}: {
  bg: string;
  name: string;
  role: string;
  hex: string;
  overlay?: string;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        background: tokens.white,
        border: `1px solid ${tokens.line}`,
        borderRadius: 10,
        overflow: "hidden",
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          height: 120,
          background: bg,
          borderBottom: `1px solid ${tokens.line}`,
          position: "relative",
        }}
      >
        {overlay && (
          <span
            style={{
              position: "absolute",
              bottom: 12,
              left: 14,
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: dark ? "rgba(14,12,8,.7)" : "rgba(255,255,255,.85)",
            }}
          >
            {overlay}
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: tokens.coal,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: tokens.inkSoft,
            margin: "4px 0 10px",
            lineHeight: 1.4,
          }}
        >
          {role}
        </div>
        <Hex value={hex} />
      </div>
    </div>
  );
}

function ContrastTile({
  bg,
  fg,
  ratio,
  level,
  text,
  sub,
  pair,
  whiteSub,
}: {
  bg: string;
  fg: string;
  ratio: string;
  level: "AA" | "AAA";
  text: string;
  sub: string;
  pair: string;
  whiteSub?: boolean;
}) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 10,
        padding: "28px 24px",
        border: `1px solid ${tokens.line}`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 14,
          fontFamily: fonts.mono,
          fontSize: 10,
          padding: "3px 8px",
          background: "rgba(255,255,255,.85)",
          borderRadius: 4,
          color: tokens.success,
          letterSpacing: "0.04em",
        }}
      >
        {ratio} · {level}
      </div>
      <p
        style={{
          fontFamily: fonts.serif,
          fontSize: 22,
          margin: "0 0 4px",
          lineHeight: 1.2,
          color: fg,
        }}
      >
        {text}
      </p>
      <p style={{ fontSize: 12, margin: 0, lineHeight: 1.4, color: fg }}>{sub}</p>
      <p
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 14,
          marginBottom: 0,
          opacity: 0.7,
          color: whiteSub ? "rgba(255,255,255,.65)" : tokens.inkSoft,
        }}
      >
        {pair}
      </p>
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
        background: tokens.white,
        border: `1px solid ${tokens.line}`,
        borderLeft: `3px solid ${isDo ? tokens.success : tokens.error}`,
        borderRadius: 10,
        padding: "24px 28px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontFamily: fonts.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          padding: "3px 10px",
          borderRadius: 999,
          marginBottom: 16,
          background: isDo ? tokens.success100 : tokens.error100,
          color: isDo ? tokens.success : tokens.error,
        }}
      >
        {isDo ? "Do" : "Don't"}
      </span>
      <h4
        style={{
          fontFamily: fonts.serif,
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
          color: tokens.indigoGray,
          fontSize: 13,
          margin: "0 0 12px",
        }}
      >
        {body}
      </p>
      <div
        style={{
          marginTop: 14,
          background: tokens.creamSoft,
          borderRadius: 6,
          padding: 14,
          fontSize: 13,
          color: tokens.inkSoft,
        }}
      >
        {demo}
      </div>
    </div>
  );
}

function TokenRow({
  varName,
  role,
  hex,
  notes,
  preview,
}: {
  varName: string;
  role: string;
  hex: string;
  notes: string;
  preview: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr 200px 1fr 120px",
        alignItems: "center",
        padding: "14px 24px",
        borderBottom: `1px solid ${tokens.line}`,
        fontSize: 13,
      }}
    >
      <div style={{ fontFamily: fonts.mono, fontSize: 12, color: tokens.coal }}>
        {varName}
      </div>
      <div style={{ color: tokens.indigoGray, fontSize: 12 }}>{role}</div>
      <div>
        <Hex value={hex} />
      </div>
      <div style={{ color: tokens.indigoGray, fontSize: 12 }}>{notes}</div>
      <div>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: `1px solid ${tokens.line}`,
            display: "inline-block",
            background: preview,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemColor() {
  return (
    <>
      {/* Font import as a one-off — canvas is self-contained */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: fonts.sans,
          color: tokens.coal,
          background: tokens.cream,
        }}
      >
        {/* MASTHEAD */}
        <header
          style={{
            borderBottom: `1px solid ${tokens.line}`,
            paddingBottom: 40,
            marginBottom: 64,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            alignItems: "end",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tokens.inkSoft,
                marginBottom: 12,
              }}
            >
              Design System · v1.0
            </div>
            <h1
              style={{
                fontFamily: fonts.serif,
                fontSize: 56,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                margin: 0,
              }}
            >
              Color, by{" "}
              <em style={{ fontStyle: "italic", color: tokens.copper }}>discipline</em>.
            </h1>
            <p
              style={{
                color: tokens.indigoGray,
                fontSize: 15,
                margin: "16px 0 0",
                maxWidth: 540,
              }}
            >
              The canonical color reference for HireStepX. Cream surface, coal
              text, indigo for everything you click, copper for one highlighted
              fact per moment. Defaults handle the rest.
            </p>
          </div>
          <div
            style={{
              textAlign: "right",
              fontFamily: fonts.mono,
              fontSize: 11,
              color: tokens.inkSoft,
              lineHeight: 1.7,
            }}
          >
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Indigo</b> #312E81
            </div>
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Copper</b> #B45309
            </div>
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Cream</b> #FAF7F0
            </div>
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Coal</b> #0E0C08
            </div>
          </div>
        </header>

        {/* 01 — DISCIPLINE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="The discipline"
            desc="One rule, applied everywhere. If you remember nothing else, remember this."
          />
          <div
            style={{
              background: tokens.white,
              border: `1px solid ${tokens.line}`,
              borderRadius: 14,
              padding: "36px 40px",
              boxShadow: shadows.card,
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: fonts.serif,
                fontSize: 22,
                lineHeight: 1.25,
                letterSpacing: "-0.01em",
              }}
            >
              <b style={{ color: tokens.indigo, fontWeight: 500 }}>Indigo</b> is
              interactive.
              <br />
              <em style={{ fontStyle: "italic", color: tokens.copper }}>Copper</em>{" "}
              is editorial.
              <br />
              Never mix.
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 14,
              }}
            >
              {[
                {
                  key: "Indigo",
                  color: tokens.indigo,
                  text:
                    "CTAs · links · focus rings · brand identifiers (logo wordmark, score numbers as state) · selection",
                },
                {
                  key: "Copper",
                  color: tokens.copper,
                  text:
                    'The italic accent word in a hero. A "highlighted number or fact" — once per moment. Never twice on the same screen.',
                },
                {
                  key: "Coal",
                  color: tokens.coal,
                  text: "Primary text. Warm dark, never pure black.",
                },
                {
                  key: "Indigo-gray",
                  color: tokens.coal,
                  text:
                    "Secondary text. Tints body copy with brand identity, subliminally.",
                },
                {
                  key: "Defaults",
                  color: tokens.coal,
                  text:
                    "Errors are red. Success is green. Don't burn brand budget on status.",
                },
              ].map((row) => (
                <li
                  key={row.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px 1fr",
                    gap: 16,
                    fontSize: 14,
                    color: tokens.inkSoft,
                  }}
                >
                  <span
                    style={{
                      color: row.color,
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      paddingTop: 2,
                    }}
                  >
                    {row.key}
                  </span>
                  <span>{row.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 02 — SURFACE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Surface"
            desc="Where everything sits. Warm, parchment-like, never pure white."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Swatch
              bg={tokens.cream}
              name="Cream"
              role="Primary canvas — every page background."
              hex="#FAF7F0"
              overlay="Page"
              dark
            />
            <Swatch
              bg={tokens.white}
              name="White"
              role="Cards, input fields, surfaces lifted off cream."
              hex="#FFFFFF"
              overlay="Card"
              dark
            />
            <Swatch
              bg={tokens.creamSoft}
              name="Cream-soft"
              role="Hover states, recessed sections, code snippets."
              hex="#F4EFE3"
              overlay="Soft"
              dark
            />
          </div>
        </section>

        {/* 03 — INK */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Ink"
            desc="Text. Coal for primary, indigo-gray for secondary — the brand-thread move."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Swatch
              bg={tokens.coal}
              name="Coal"
              role="Primary text. Warm dark — never pure black."
              hex="#0E0C08"
              overlay="Primary"
            />
            <Swatch
              bg={tokens.indigoGray}
              name="Indigo-gray"
              role="Secondary text — tinted with brand. Use for body, helpers."
              hex="#3E3A6E"
              overlay="Secondary"
            />
            <Swatch
              bg={tokens.inkSoft}
              name="Ink-soft"
              role="Microcopy, labels, captions."
              hex="#6E6759"
              overlay="Helper"
            />
            <Swatch
              bg={tokens.inkFaint}
              name="Ink-faint"
              role="Placeholders, disabled, tertiary metadata."
              hex="#A39C8B"
              overlay="Faint"
            />
          </div>
        </section>

        {/* 04 — BRAND */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Brand"
            desc="Indigo is the path forward. Copper is the spotlight. They never share the stage."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Swatch
              bg={tokens.indigo}
              name="Indigo"
              role="Primary CTAs, links, focus, score numerals. Anything you click."
              hex="#312E81"
              overlay="Interactive"
            />
            <Swatch
              bg={tokens.indigoDeep}
              name="Indigo-deep"
              role="CTA hover, pressed state. ~10% darker."
              hex="#1E1B4B"
              overlay="Hover"
            />
            <Swatch
              bg={tokens.indigo100}
              name="Indigo-100"
              role="Soft brand background — premium-tier panels, badges."
              hex="#E5E2F2"
              overlay="Soft"
              dark
            />
            <Swatch
              bg={tokens.copper}
              name="Copper"
              role="Italic accent words. Score numbers. Logo accent stroke."
              hex="#B45309"
              overlay="Editorial"
            />
            <Swatch
              bg={tokens.copper100}
              name="Copper-100"
              role="Avatar tints, soft accent badges, score-tag chips."
              hex="#F4E5D8"
              overlay="Soft"
              dark
            />
          </div>
        </section>

        {/* 05 — STATUS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Status"
            desc="Defaults. Universally legible. Don't burn brand budget on status colors."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Swatch
              bg={tokens.error}
              name="Error"
              role="Form validation, destructive actions, hard failures."
              hex="#B91C1C"
              overlay="Error"
            />
            <Swatch
              bg={tokens.success}
              name="Success"
              role="Confirmations, validated fields, completed states."
              hex="#15803D"
              overlay="Success"
            />
            <Swatch
              bg={tokens.error100}
              name="Error-100"
              role="Inline error backgrounds, soft warning panels."
              hex="#FEE2E2"
              overlay="Soft"
              dark
            />
            <Swatch
              bg={tokens.success100}
              name="Success-100"
              role="Inline success backgrounds, fit tags."
              hex="#DCFCE7"
              overlay="Soft"
              dark
            />
          </div>
        </section>

        {/* 06 — TOKEN TABLE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Token reference"
            desc="Drop these into your stylesheet. Every value used in this system maps to one variable."
          />
          <div
            style={{
              background: tokens.white,
              border: `1px solid ${tokens.line}`,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: shadows.card,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr 200px 1fr 120px",
                alignItems: "center",
                padding: "14px 24px",
                borderBottom: `1px solid ${tokens.line}`,
                background: tokens.creamSoft,
                fontFamily: fonts.mono,
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: tokens.inkSoft,
                fontWeight: 500,
              }}
            >
              <div>Token</div>
              <div>Where</div>
              <div>Hex</div>
              <div>Notes</div>
              <div>Preview</div>
            </div>
            <TokenRow
              varName="--cream"
              role="Page background"
              hex="#FAF7F0"
              notes="Warm parchment, never #FFF"
              preview={tokens.cream}
            />
            <TokenRow
              varName="--white"
              role="Card surface, inputs"
              hex="#FFFFFF"
              notes="Lifted off cream"
              preview={tokens.white}
            />
            <TokenRow
              varName="--coal"
              role="Primary text"
              hex="#0E0C08"
              notes="Warm dark, premium"
              preview={tokens.coal}
            />
            <TokenRow
              varName="--indigo-gray"
              role="Secondary text"
              hex="#3E3A6E"
              notes="Tinted with brand"
              preview={tokens.indigoGray}
            />
            <TokenRow
              varName="--indigo"
              role="Primary CTA, links, focus"
              hex="#312E81"
              notes="Anything you click"
              preview={tokens.indigo}
            />
            <TokenRow
              varName="--indigo-deep"
              role="CTA hover"
              hex="#1E1B4B"
              notes="Pressed state"
              preview={tokens.indigoDeep}
            />
            <TokenRow
              varName="--indigo-ring"
              role="Focus halos"
              hex="rgba(49,46,129,.20)"
              notes="3px ring outset"
              preview={tokens.indigoRing}
            />
            <TokenRow
              varName="--copper"
              role="Editorial accent"
              hex="#B45309"
              notes="One per moment"
              preview={tokens.copper}
            />
            <TokenRow
              varName="--copper-100"
              role="Avatar tints, badges"
              hex="#F4E5D8"
              notes="Soft brand thread"
              preview={tokens.copper100}
            />
            <TokenRow
              varName="--error"
              role="Destructive, validation fail"
              hex="#B91C1C"
              notes="Default red — leave it"
              preview={tokens.error}
            />
            <TokenRow
              varName="--success"
              role="Confirmation, validated"
              hex="#15803D"
              notes="Default green — leave it"
              preview={tokens.success}
            />
          </div>
        </section>

        {/* 07 — CONTRAST */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Contrast & accessibility"
            desc="WCAG 2.1 AA requires 4.5:1 for body text. AAA prefers 7:1. Every approved pairing checks out."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.coal}
              ratio="15.9:1"
              level="AAA"
              text="Coal on Cream"
              sub="Hero text, primary copy. The default pair."
              pair="--coal / --cream"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.indigoGray}
              ratio="7.4:1"
              level="AAA"
              text="Indigo-gray on Cream"
              sub="Body copy, secondary text. Brand-tinted reading."
              pair="--indigo-gray / --cream"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.indigo}
              ratio="9.1:1"
              level="AAA"
              text="Indigo on Cream"
              sub="Links, interactive text. Always meets AAA."
              pair="--indigo / --cream"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.copper}
              ratio="5.4:1"
              level="AA"
              text="Copper on Cream"
              sub="Italic accent words, headlines only. AA pass."
              pair="--copper / --cream"
            />
            <ContrastTile
              bg={tokens.indigo}
              fg={tokens.white}
              ratio="12.5:1"
              level="AAA"
              text="White on Indigo"
              sub="Primary CTA text. Universal pass."
              pair="--white / --indigo"
              whiteSub
            />
            <ContrastTile
              bg={tokens.white}
              fg={tokens.coal}
              ratio="17.4:1"
              level="AAA"
              text="Coal on White"
              sub="Card surfaces. Maximum readability."
              pair="--coal / --white"
            />
          </div>
        </section>

        {/* 08 — DO / DON'T */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Do & don't"
            desc="The discipline rule applied to common situations. Save the brand from drift."
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
              title="One copper moment per screen."
              body="The italic accent word is the signature. Don't dilute it."
              demo={
                <>
                  Hero: "Reset your{" "}
                  <em
                    style={{
                      color: tokens.copper,
                      fontFamily: fonts.serif,
                      fontStyle: "italic",
                    }}
                  >
                    password
                  </em>
                  "
                  <br />
                  Score numeral:{" "}
                  <b
                    style={{
                      color: tokens.copper,
                      fontFamily: fonts.serif,
                      fontWeight: 500,
                    }}
                  >
                    62
                  </b>
                  <br />
                  Pick <i>one</i>. Not both.
                </>
              }
            />
            <Rule
              kind="dont"
              title="Stack copper on warnings, icons, AND text."
              body="When everything is highlighted, nothing is."
              demo={
                <>
                  ❌ Copper italic accent + copper warning icon + copper
                  time-clock + copper avatar + copper "replace" link — all on
                  one screen.
                </>
              }
            />
            <Rule
              kind="do"
              title="Make every clickable thing indigo."
              body="Predictability is premium. Buttons, links, focus rings, score numbers (interactive on click)."
              demo={
                <>
                  <a
                    style={{
                      color: tokens.indigo,
                      borderBottom: `1px solid ${tokens.indigo}`,
                      textDecoration: "none",
                    }}
                  >
                    View report
                  </a>{" "}
                  · <span style={{ color: tokens.indigo }}>→ Continue</span>
                </>
              }
            />
            <Rule
              kind="dont"
              title="Use copper on click targets."
              body="Copper is editorial — a label for a fact, not an invitation to act."
              demo={
                <>
                  ❌ "Replace" link in copper · ❌ "View all" CTA in copper · ❌
                  Tab navigation in copper.
                </>
              }
            />
            <Rule
              kind="do"
              title="Tint secondary text with indigo-gray."
              body="Body copy stays subliminally on-brand. Mercury and Substack do exactly this."
              demo={
                <span style={{ color: tokens.indigoGray }}>
                  "You have a strong foundation. With a few improvements,
                  you'll stand out."
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Use a neutral gray for secondary text."
              body="Generic grays make every SaaS look the same. The indigo-tint is an inch of identity per paragraph."
              demo={
                <span style={{ color: "#6B7280" }}>
                  ❌ "Generic Tailwind gray-500." Looks like every other
                  dashboard.
                </span>
              }
            />
          </div>
        </section>

        {/* 09 — LIVING EXAMPLES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="09"
            title="Living examples"
            desc="The system applied. Hover, focus, and click — every state earned its color."
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            <div
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: tokens.copper,
                  marginBottom: 14,
                }}
              >
                Buttons · Interactive
              </div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  fontWeight: 400,
                  margin: "0 0 6px",
                  letterSpacing: "-0.01em",
                }}
              >
                Primary action
              </h3>
              <p
                style={{
                  color: tokens.indigoGray,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                Indigo on every CTA. Subtle hover lift. Focus halo for keyboard.
              </p>
              <button
                style={{
                  background: tokens.indigo,
                  color: tokens.white,
                  border: "none",
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 1px 2px rgba(20,17,10,.12)",
                }}
              >
                Continue to practise →
              </button>
              <button
                style={{
                  background: tokens.white,
                  color: tokens.coal,
                  border: `1px solid ${tokens.lineStrong}`,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  marginLeft: 8,
                }}
              >
                Cancel
              </button>
            </div>

            <div
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: tokens.copper,
                  marginBottom: 14,
                }}
              >
                Inputs · Focused state
              </div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  fontWeight: 400,
                  margin: "0 0 6px",
                }}
              >
                Form field
              </h3>
              <p
                style={{
                  color: tokens.indigoGray,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                Click in to see the indigo focus ring at 20% alpha.
              </p>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: tokens.coal,
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: `1px solid ${tokens.lineStrong}`,
                  borderRadius: 10,
                  fontFamily: "inherit",
                  fontSize: 14,
                  background: tokens.white,
                  color: tokens.coal,
                  outline: "none",
                }}
              />
            </div>

            <div
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: tokens.copper,
                  marginBottom: 14,
                }}
              >
                Editorial moment
              </div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  fontWeight: 400,
                  margin: "0 0 6px",
                }}
              >
                Reset your{" "}
                <em style={{ fontStyle: "italic", color: tokens.copper }}>
                  password
                </em>
              </h3>
              <p
                style={{
                  color: tokens.indigoGray,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                The italic accent word is the brand signature. One copper
                moment, no more.
              </p>
            </div>

            <div
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.line}`,
                borderRadius: 14,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: tokens.copper,
                  marginBottom: 14,
                }}
              >
                Highlighted fact
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 24px",
                  background: tokens.creamSoft,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: tokens.inkSoft,
                    marginBottom: 8,
                  }}
                >
                  Clarity Score
                </div>
                <div
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 72,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: tokens.copper,
                    letterSpacing: "-0.02em",
                  }}
                >
                  62
                  <small
                    style={{
                      fontSize: 22,
                      color: tokens.inkFaint,
                      marginLeft: 4,
                    }}
                  >
                    /100
                  </small>
                </div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    padding: "3px 12px",
                    fontSize: 11,
                    background: tokens.copperSoft,
                    color: tokens.copper,
                    borderRadius: 999,
                    fontWeight: 500,
                  }}
                >
                  Fair · room to grow
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 10 — PHILOSOPHY */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="10"
            title="Why these colors"
            desc="The cultural and competitive logic behind every choice."
          />
          <div
            style={{
              background: tokens.coal,
              color: tokens.cream,
              borderRadius: 14,
              padding: "48px 56px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 32,
                  fontWeight: 400,
                  lineHeight: 1.15,
                  margin: "0 0 20px",
                  letterSpacing: "-0.015em",
                }}
              >
                Indigo is{" "}
                <em style={{ fontStyle: "italic", color: tokens.copper }}>
                  historically
                </em>{" "}
                Indian.
              </h3>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                The dye is literally named after the country — Sanskrit{" "}
                <i>nīla</i> → Greek <i>indikón</i>. India's signature export for
                2,000+ years.
              </p>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Using it isn't cliché in the way saffron is. It's quietly,
                culturally rooted.
              </p>
              <div
                style={{
                  borderLeft: `2px solid ${tokens.copper}`,
                  paddingLeft: 20,
                  fontFamily: fonts.serif,
                  fontSize: 18,
                  fontStyle: "italic",
                  color: tokens.cream,
                  lineHeight: 1.45,
                }}
              >
                No competitor in our space owns indigo — Yoodli is blue, Final
                Round is blue/black, Pramp is orange, Big Interview is red. We
                can be the first.
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 32,
                  fontWeight: 400,
                  lineHeight: 1.15,
                  margin: "0 0 20px",
                  letterSpacing: "-0.015em",
                }}
              >
                Copper is the{" "}
                <em style={{ fontStyle: "italic", color: tokens.copper }}>
                  perfect
                </em>{" "}
                counterweight.
              </h3>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Warm where indigo is cool. Earthen where indigo is sky.
                Indian-aware (terracotta, copper, brass are visual signatures of
                Indian craft). And already at home in our cream-bg world.
              </p>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                The two colors fight beautifully — like a Banarasi or
                Pochampally weave. Subconsciously Indian without ever being
                literal.
              </p>
              <div
                style={{
                  borderLeft: `2px solid ${tokens.copper}`,
                  paddingLeft: 20,
                  fontFamily: fonts.serif,
                  fontSize: 18,
                  fontStyle: "italic",
                  color: tokens.cream,
                  lineHeight: 1.45,
                }}
              >
                Indigo says depth, calm, authority, premium. Copper says
                heritage, warmth, fact. Together they say: this product was
                made by someone who knows.
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Color" tagline="Indigo is interactive. Copper is editorial. Never mix." />
      </div>
    </>
  );
}
