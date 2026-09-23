/* HireStepX — Design System / Color
   Self-contained canvas component.
   Discipline: restrained neutral, plus one accent. Copper is the single
   accent color — primary CTAs, active/selected states, links, focus rings
   only. Indigo is demoted to a secondary / data-viz hue. Everything else
   is coal, ink-muted, or the neutral gray scale. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { tokens, fonts, shadows, radius, type } from "./_tokens";
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
        borderRadius: radius.sm,
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
        borderRadius: radius.lg,
        overflow: "hidden",
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          height: 96,
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
        borderRadius: radius.lg,
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
          borderRadius: radius.sm,
          color: tokens.success,
          letterSpacing: "0.04em",
        }}
      >
        {ratio} · {level}
      </div>
      <p
        style={{
          fontFamily: fonts.sans,
          fontWeight: 600,
          fontSize: type.h3.size,
          margin: "0 0 4px",
          lineHeight: 1.3,
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
        borderRadius: radius.lg,
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
          fontFamily: fonts.sans,
          fontSize: type.h4.size,
          fontWeight: type.h4.weight,
          margin: "0 0 8px",
          lineHeight: type.h4.lineHeight,
        }}
      >
        {title}
      </h4>
      <p
        style={{
          color: tokens.inkMuted,
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
          borderRadius: radius.sm,
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
      <div style={{ color: tokens.inkMuted, fontSize: 12 }}>{role}</div>
      <div>
        <Hex value={hex} />
      </div>
      <div style={{ color: tokens.inkMuted, fontSize: 12 }}>{notes}</div>
      <div>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.sm,
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
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 48px 96px",
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
                fontFamily: fonts.sans,
                fontSize: type.h1.size,
                fontWeight: type.h1.weight,
                letterSpacing: type.h1.letterSpacing,
                lineHeight: type.h1.lineHeight,
                margin: 0,
                color: tokens.coal,
              }}
            >
              Color reference
            </h1>
            <p
              style={{
                color: tokens.inkMuted,
                fontSize: type.bodyLg.size,
                lineHeight: type.bodyLg.lineHeight,
                margin: "10px 0 0",
                maxWidth: 540,
              }}
            >
              The canonical color reference for HireStepX, mapped to shadcn/ui
              semantics. Cool-neutral surface, coal text, copper as the single
              accent — CTAs, active states, links, focus rings. Indigo is a
              secondary hue reserved for data-viz. No beige, no cream tint —
              the shadcn defaults handle the rest.
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
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Copper</b> #BB4D00
            </div>
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Surface</b> #FFFFFF
            </div>
            <div>
              <b style={{ color: tokens.coal, fontWeight: 500 }}>Coal</b> #18181B
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
              borderRadius: radius.lg,
              padding: "32px 36px",
              boxShadow: shadows.card,
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 40,
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: fonts.sans,
                fontWeight: 600,
                fontSize: type.h2.size,
                lineHeight: type.h2.lineHeight,
                letterSpacing: type.h2.letterSpacing,
                color: tokens.coal,
              }}
            >
              Restrained neutral,
              <br />
              plus{" "}
              <span style={{ color: tokens.copper }}>one accent</span>.
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
                  key: "Copper",
                  color: tokens.copper,
                  text:
                    "The one accent color. Primary CTAs, active/selected states, links, focus rings — nothing else. Keep it to a small fraction of any screen.",
                },
                {
                  key: "Indigo",
                  color: tokens.indigo,
                  text:
                    "Secondary hue, demoted to data-viz — charts, graphs, sound waves. Not used for buttons, links, or body text.",
                },
                {
                  key: "Coal",
                  color: tokens.coal,
                  text: "Primary text. Warm dark, never pure black.",
                },
                {
                  key: "Ink-muted / gray scale",
                  color: tokens.coal,
                  text:
                    "Secondary and helper text, borders, backgrounds — the neutral 11-step gray scale, not brand-tinted.",
                },
                {
                  key: "Defaults",
                  color: tokens.coal,
                  text:
                    "Errors are red. Success is green. Don't burn the accent on status.",
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
            desc="Where everything sits. Clean cool white, shadcn-neutral — no warm beige tint."
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
              name="Surface"
              role="Primary canvas — every page background. Pure white, not cream."
              hex="#FFFFFF"
              overlay="Page"
              dark
            />
            <Swatch
              bg={tokens.creamSoft}
              name="Surface-muted"
              role="Hover states, recessed sections, code snippets. Cool zinc, not tan."
              hex="#F4F4F5"
              overlay="Muted"
              dark
            />
          </div>
        </section>

        {/* 03 — INK */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Ink & the neutral gray scale"
            desc="Text and neutral surfaces. Coal for primary, ink-muted for secondary — no brand tint."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <Swatch
              bg={tokens.coal}
              name="Coal"
              role="Primary text. Cool near-black — never pure black."
              hex="#18181B"
              overlay="Primary"
            />
            <Swatch
              bg={tokens.inkMuted}
              name="Ink-muted"
              role="Secondary text — body copy, descriptions, list items. Neutral, not brand-tinted."
              hex="#3F3F46"
              overlay="Secondary"
            />
            <Swatch
              bg={tokens.inkSoft}
              name="Ink-soft"
              role="Microcopy, labels, captions."
              hex="#71717A"
              overlay="Helper"
            />
            <Swatch
              bg={tokens.inkFaint}
              name="Ink-faint"
              role="Placeholders, disabled, tertiary metadata."
              hex="#A1A1AA"
              overlay="Faint"
            />
          </div>
          <MonoLabel>The full gray scale — tokens.gray[50–950]</MonoLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(11, 1fr)",
              gap: 8,
              marginTop: 12,
            }}
          >
            {[
              { step: "50", hex: "#FAFAFA" },
              { step: "100", hex: "#F4F4F5" },
              { step: "200", hex: "#E4E4E7" },
              { step: "300", hex: "#D4D4D8" },
              { step: "400", hex: "#A1A1AA" },
              { step: "500", hex: "#71717A" },
              { step: "600", hex: "#52525B" },
              { step: "700", hex: "#3F3F46" },
              { step: "800", hex: "#27272A" },
              { step: "900", hex: "#18181B" },
              { step: "950", hex: "#09090B" },
            ].map((g) => (
              <div key={g.step} style={{ textAlign: "center" }}>
                <div
                  style={{
                    height: 56,
                    background: g.hex,
                    border: `1px solid ${tokens.line}`,
                    borderRadius: radius.sm,
                  }}
                />
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    color: tokens.coal,
                    marginTop: 6,
                  }}
                >
                  {g.step}
                </div>
                <div
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 9,
                    color: tokens.inkSoft,
                  }}
                >
                  {g.hex}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 04 — BRAND */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Brand"
            desc="Copper is the one accent — CTAs, active states, links, focus. Indigo is demoted to data-viz."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <Swatch
              bg={tokens.copper}
              name="Copper"
              role="The one accent. Primary CTAs, active/selected states, links, focus rings — from the shadcn preset's own generated accent."
              hex="#BB4D00"
              overlay="Accent"
            />
            <Swatch
              bg={tokens.copper100}
              name="Copper-100"
              role="Avatar tints, soft accent badges, score-tag chips."
              hex="#F5DFCB"
              overlay="Soft"
              dark
            />
            <Swatch
              bg={tokens.indigo}
              name="Indigo"
              role="Secondary hue — charts, graphs, data-viz series. Not used for buttons or links."
              hex="#312E81"
              overlay="Data-viz"
            />
            <Swatch
              bg={tokens.indigoDeep}
              name="Indigo-deep"
              role="Darker data-viz series step. ~10% darker."
              hex="#1E1B4B"
              overlay="Data-viz"
            />
            <Swatch
              bg={tokens.indigo100}
              name="Indigo-100"
              role="Soft data-viz background — chart fills, legend chips."
              hex="#E5E2F2"
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
              borderRadius: radius.lg,
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
              varName="--background"
              role="Page background"
              hex="#FFFFFF"
              notes="Pure white — shadcn default, no beige"
              preview={tokens.cream}
            />
            <TokenRow
              varName="--muted"
              role="Recessed sections, code snippets"
              hex="#F4F4F5"
              notes="Cool zinc, not tan"
              preview={tokens.creamSoft}
            />
            <TokenRow
              varName="--coal"
              role="Primary text"
              hex="#18181B"
              notes="Cool near-black, premium"
              preview={tokens.coal}
            />
            <TokenRow
              varName="--ink-muted"
              role="Secondary text"
              hex="#3F3F46"
              notes="Neutral gray-700, not brand-tinted"
              preview={tokens.inkMuted}
            />
            <TokenRow
              varName="--indigo"
              role="Charts, graphs, data-viz series"
              hex="#312E81"
              notes="Secondary hue — not for buttons or links"
              preview={tokens.indigo}
            />
            <TokenRow
              varName="--indigo-deep"
              role="Darker data-viz series step"
              hex="#1E1B4B"
              notes="Chart-only"
              preview={tokens.indigoDeep}
            />
            <TokenRow
              varName="--copper"
              role="Primary CTA, links, focus, active state"
              hex="#BB4D00"
              notes="The one accent — from the shadcn preset"
              preview={tokens.copper}
            />
            <TokenRow
              varName="--copper-ring"
              role="Focus halos"
              hex="rgba(187,77,0,.20)"
              notes="3px ring outset"
              preview={tokens.copperLine}
            />
            <TokenRow
              varName="--copper-100"
              role="Avatar tints, badges"
              hex="#F5DFCB"
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
              ratio="17.9:1"
              level="AAA"
              text="Coal on Surface"
              sub="Hero text, primary copy. The default pair."
              pair="--coal / --background"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.inkMuted}
              ratio="9.7:1"
              level="AAA"
              text="Ink-muted on Surface"
              sub="Body copy, secondary text. Neutral, not brand-tinted."
              pair="--ink-muted / --background"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.indigo}
              ratio="9.1:1"
              level="AAA"
              text="Indigo on Surface"
              sub="Chart labels, data-viz text only — not links or CTAs."
              pair="--indigo / --background"
            />
            <ContrastTile
              bg={tokens.cream}
              fg={tokens.copper}
              ratio="5.1:1"
              level="AA"
              text="Copper on Surface"
              sub="Links, active-state text. AA pass."
              pair="--copper / --background"
            />
            <ContrastTile
              bg={tokens.copper}
              fg={tokens.white}
              ratio="5.0:1"
              level="AA"
              text="White on Copper"
              sub="Primary CTA button text. AA pass."
              pair="--white / --copper"
              whiteSub
            />
            <ContrastTile
              bg={tokens.white}
              fg={tokens.coal}
              ratio="17.7:1"
              level="AAA"
              text="Coal on Card"
              sub="Card surfaces. Maximum readability."
              pair="--coal / --card"
            />
          </div>
        </section>

        {/* 08 — DO / DON'T */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Do & don't"
            desc="The discipline rule applied to common situations. Keep the accent scarce and deliberate."
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
              title="Make every clickable thing copper."
              body="Predictability is premium. Buttons, links, focus rings, active/selected states — one consistent signal for 'interactive'."
              demo={
                <>
                  <a
                    style={{
                      color: tokens.copper,
                      borderBottom: `1px solid ${tokens.copper}`,
                      textDecoration: "none",
                    }}
                  >
                    View report
                  </a>{" "}
                  · <span style={{ color: tokens.copper }}>→ Continue</span>
                </>
              }
            />
            <Rule
              kind="dont"
              title="Spread copper across icons, badges, and text at once."
              body="When everything is accented, nothing reads as the primary action."
              demo={
                <>
                  ❌ Copper heading + copper icon + copper badge + copper
                  "replace" link — all competing on one screen.
                </>
              }
            />
            <Rule
              kind="do"
              title="Use one primary action in copper per screen."
              body="Every other button stays neutral outline or ghost, so the one copper CTA is unambiguous."
              demo={
                <>
                  <b style={{ color: tokens.copper }}>Continue to practise →</b>{" "}
                  is copper. "Cancel" stays a plain outline button.
                </>
              }
            />
            <Rule
              kind="dont"
              title="Use indigo for buttons, links, or body text."
              body="Indigo is demoted to a secondary/data-viz hue — it should never compete with copper as an interactive signal."
              demo={
                <>
                  ❌ Indigo "View all" CTA · ❌ Indigo tab navigation · ❌
                  Indigo body copy.
                </>
              }
            />
            <Rule
              kind="do"
              title="Use a neutral gray for secondary text."
              body="Ink-muted (gray-700) keeps body copy quiet and legible without borrowing brand color."
              demo={
                <span style={{ color: tokens.inkMuted }}>
                  "You have a strong foundation. With a few improvements,
                  you'll stand out."
                </span>
              }
            />
            <Rule
              kind="dont"
              title="Tint secondary text with a brand hue."
              body="Indigo- or copper-tinted body copy reads as decorative, not functional — and quietly breaks contrast guarantees."
              demo={
                <span style={{ color: tokens.indigo }}>
                  ❌ Indigo-tinted paragraph text pretending to be neutral.
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
                borderRadius: radius.lg,
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
                  fontFamily: fonts.sans,
                  fontSize: type.h3.size,
                  fontWeight: type.h3.weight,
                  margin: "0 0 6px",
                  letterSpacing: "-0.01em",
                }}
              >
                Primary action
              </h3>
              <p
                style={{
                  color: tokens.inkMuted,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                Copper on every CTA. Subtle hover lift. Focus halo for keyboard.
              </p>
              <button
                style={{
                  background: tokens.copper,
                  color: tokens.white,
                  border: "none",
                  padding: "12px 22px",
                  borderRadius: radius.md,
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
                  borderRadius: radius.md,
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
                borderRadius: radius.lg,
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
                  fontFamily: fonts.sans,
                  fontSize: type.h3.size,
                  fontWeight: type.h3.weight,
                  margin: "0 0 6px",
                }}
              >
                Form field
              </h3>
              <p
                style={{
                  color: tokens.inkMuted,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                Click in to see the copper focus ring at 20% alpha.
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
                  borderRadius: radius.md,
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
                borderRadius: radius.lg,
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
                Active state
              </div>
              <h3
                style={{
                  fontFamily: fonts.sans,
                  fontSize: type.h3.size,
                  fontWeight: type.h3.weight,
                  margin: "0 0 6px",
                  color: tokens.coal,
                }}
              >
                Reset your password
              </h3>
              <p
                style={{
                  color: tokens.inkMuted,
                  fontSize: 13,
                  margin: "0 0 20px",
                }}
              >
                A plain heading — no decorative accent word. Copper appears
                only on the selected tab or step indicator below.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: tokens.copper,
                    borderBottom: `2px solid ${tokens.copper}`,
                  }}
                >
                  1. Verify
                </span>
                <span
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: tokens.inkFaint,
                  }}
                >
                  2. New password
                </span>
              </div>
            </div>

            <div
              style={{
                background: tokens.white,
                border: `1px solid ${tokens.line}`,
                borderRadius: radius.lg,
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
                  borderRadius: radius.lg,
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
                    fontFamily: fonts.sans,
                    fontSize: 32,
                    fontWeight: 600,
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
            desc="The functional logic behind the palette — restrained neutral, plus one accent."
          />
          <div
            style={{
              background: tokens.coal,
              color: tokens.cream,
              borderRadius: radius.lg,
              padding: "40px 48px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: fonts.sans,
                  fontSize: type.h2.size,
                  fontWeight: 600,
                  lineHeight: type.h2.lineHeight,
                  margin: "0 0 16px",
                  letterSpacing: type.h2.letterSpacing,
                  color: tokens.cream,
                }}
              >
                One accent, spent deliberately.
              </h3>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Copper is the only color that means "act on this." Every
                button, link, active tab, and focus ring shares it, so a
                user learns the signal once and it holds everywhere.
              </p>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Keeping it to a small fraction of any screen is what makes
                it work — a UI that highlights everything highlights
                nothing.
              </p>
              <div
                style={{
                  borderLeft: `2px solid ${tokens.copper}`,
                  paddingLeft: 20,
                  fontFamily: fonts.sans,
                  fontWeight: 500,
                  fontSize: type.h4.size,
                  color: tokens.cream,
                  lineHeight: 1.45,
                }}
              >
                One clear primary action per screen, always in copper.
                Everything else stays quiet.
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: fonts.sans,
                  fontSize: type.h2.size,
                  fontWeight: 600,
                  lineHeight: type.h2.lineHeight,
                  margin: "0 0 16px",
                  letterSpacing: type.h2.letterSpacing,
                  color: tokens.cream,
                }}
              >
                Neutral does the heavy lifting.
              </h3>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Coal, ink-muted, and the 11-step gray scale carry almost
                every surface, border, and line of text in the product.
                That density of neutral is what reads as calm and
                information-dense rather than busy.
              </p>
              <p
                style={{
                  color: "rgba(250, 247, 240, .72)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  margin: "0 0 14px",
                }}
              >
                Indigo is kept in reserve for data-viz — charts, graphs,
                waveforms — so it never competes with copper as a signal
                for "click here."
              </p>
              <div
                style={{
                  borderLeft: `2px solid ${tokens.copper}`,
                  paddingLeft: 20,
                  fontFamily: fonts.sans,
                  fontWeight: 500,
                  fontSize: type.h4.size,
                  color: tokens.cream,
                  lineHeight: 1.45,
                }}
              >
                Restrained neutral, plus one accent. That's the whole
                system.
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Color" tagline="Restrained neutral, plus one accent." />
      </div>
    </>
  );
}
