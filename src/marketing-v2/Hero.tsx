import type { CSSProperties } from "react";
import { tokens as t, fonts } from "../auth/_tokens";
import { ProductMockHero } from "./HeroProductMock";
import { HeroCta } from "./HeroCta";

/* No "use client" here on purpose — this is the homepage's above-the-fold
   shell (eyebrow, H1, subhead, CTA row, product-mock frame). It renders as
   plain server HTML so the headline paints before any client JS downloads
   or hydrates. The two pieces that genuinely need interactivity
   (click-tracked CTA, animated product demo) are isolated into their own
   "use client" islands and imported here as leaves. */

const container: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  paddingLeft: 48,
  paddingRight: 48,
};

const sectionBase: CSSProperties = {
  position: "relative",
  paddingTop: 80,
  paddingBottom: 80,
};

export function HeroV2() {
  return (
    <section
      aria-labelledby="hd-hero"
      className="mv2-hero-section"
      style={{
        ...sectionBase,
        paddingTop: 96,
        paddingBottom: 40,
        background: t.cream,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Copper wash — stronger and wider to anchor the headline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 60% at 50% 8%, rgba(180,83,9,0.11) 0%, rgba(180,83,9,0.04) 45%, transparent 65%)",
          pointerEvents: "none",
          contain: "paint",
        }}
      />

      {/* Centered text block */}
      <div style={{ ...container, position: "relative", textAlign: "center" }}>

        {/* Positioning eyebrow */}
        <div
          className="mv2-cascade mv2-cascade-1 mv2-hero-eyebrow"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 28,
            padding: "6px 16px",
            background: t.copperSoft,
            border: `1px solid rgba(180,83,9,0.18)`,
            borderRadius: 999,
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase" as const,
            color: t.copper,
          }}
        >
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: t.copper, display: "inline-block", flexShrink: 0 }} />
          AI Interview Coach, Built for India
        </div>

        <h1
          id="hd-hero"
          className="mv2-hero-display mv2-cascade mv2-cascade-2"
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(48px, 6vw, 86px)",
            lineHeight: 1.03,
            letterSpacing: "-0.035em",
            color: t.coal,
            margin: "0 auto",
            fontWeight: 400,
            maxWidth: 760,
            textWrap: "balance" as CSSProperties["textWrap"],
          }}
        >
          Practice the interview.
          <br />
          <span style={{ fontStyle: "italic", color: t.copper }}>
            Not the panic.
          </span>
        </h1>

        <p
          className="mv2-cascade mv2-cascade-3"
          style={{
            fontFamily: fonts.sans,
            fontSize: 16,
            lineHeight: 1.62,
            color: t.inkSoft,
            maxWidth: 620,
            margin: "22px auto 0",
          }}
        >
          AI mock interviews you actually speak to, scored against the
          rubrics real Indian panels use. STAR breakdown back before your chai
          cools.
        </p>

        {/* CTAs — click tracking needs a client boundary, isolated in HeroCta.tsx */}
        <HeroCta />
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            color: t.inkSoft,
            textAlign: "center",
            marginTop: 12,
            letterSpacing: "0.01em",
          }}
        >
          2 sessions free · no credit card required
        </p>

      </div>

      {/* Product mock — wider, more breathing room above.
          mask-image fades the bottom third to transparent so the card's
          shadow and hard edge dissolve into the cream background instead
          of cutting off abruptly. */}
      <div
        className="mv2-cascade mv2-cascade-6 mv2-hero-mock-outer"
        style={{
          maxWidth: 1160,
          margin: "48px auto 0",
          padding: "0 32px",
          position: "relative",
          maskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
        }}
      >
        <ProductMockHero />
      </div>
    </section>
  );
}
