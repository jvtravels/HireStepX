"use client";
/**
 * FooterDome — production marketing footer.
 *
 * Desktop (≥880px): Three-column layout on warm cream with a copper-toned
 * video dome rising from the bottom center. Left PRODUCT nav, center
 * editorial headline + blurb, right COMPANY nav. © 2026 bottom-left,
 * social icons bottom-right.
 *
 * Mobile (<880px): Compact two-column nav grid + wordmark + legal row.
 * The dome is hidden on mobile to keep the footer height manageable.
 *
 * Replaces: FinalCTAFooterV2 (HomepageV2, MarketingPagesV2, BlogPage).
 */

import { useEffect, useRef } from "react";
import { tokens as t, fonts } from "../auth/_tokens";

/* ── Nav link data ── */
const PRODUCT_LINKS: Array<[string, string]> = [
  ["How it works", "/how-it-works"],
  ["Pricing", "/pricing"],
  ["Blog", "/blog"],
];

const COMPANY_LINKS: Array<[string, string]> = [
  ["About", "/about"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refund policy", "/refund"],
];

const LEGAL_LINKS: Array<[string, string]> = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refund", "/refund"],
];

/* ── Icon SVGs ── */
function IgIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231 5.447-6.231Zm-1.16 17.52h1.833L7.084 4.126H5.117L17.084 19.77Z" />
    </svg>
  );
}
function InIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm6 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9V9Z" />
    </svg>
  );
}

/* ── Desktop dome footer (≥880px) ── */
function FooterDomeDesktop() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Programmatic play is more reliable than the autoPlay attribute alone —
    // some browsers silently block the attribute even on muted videos.
    video.muted = true;
    video.play().catch(() => {
      // Autoplay still blocked (very restricted browser policy). The copper
      // fallback background-color on the dome div remains visible in that case.
    });
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 460,
        background: t.cream,
        overflow: "hidden",
      }}
    >
      {/* Video dome — rendered FIRST so it sits behind all text/nav elements
          in natural DOM stacking order. On narrow desktop viewports (~880–950px)
          the dome arc's horizontal extent can reach the social-icons; rendering
          it first means those elements always paint on top with no z-index needed. */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: 316,
        width: 900,
        height: 900,
        borderRadius: "50%",
        overflow: "hidden",
        transform: "translateX(-50%)",
        background: "#B45309",
      }}>
        {/* src on the element directly (not via <source>) forces Chrome to
            use the simpler resource selection algorithm and keeps networkState
            in NETWORK_LOADING until the buffer fills. Using <source> child
            lets Chrome stop at HAVE_METADATA without loading frame data. */}
        {/* Width 100% scales the 1920×500 video to fill the 900px dome width
            → rendered at 900×234px. The visible dome window is the top 144px
            of the 900px circle, which shows the top 144px of this 234px frame
            — the wordmark (centered vertically in the original ~y=117px scaled)
            sits inside that window. objectFit:cover was filling the full 900px
            height, pushing all video content far below the visible arc. */}
        <video
          ref={videoRef}
          src="/HX.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{
            width: "25%",
            height: "auto",
            display: "block",
            margin: "48px auto 0",
          }}
        />
      </div>

      {/* Left column */}
      <div style={{ position: "absolute", left: 96, top: 76 }}>
        <p style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: t.copper,
          textTransform: "uppercase",
          margin: "0 0 24px",
        }}>Product</p>
        {PRODUCT_LINKS.map(([label, href]) => (
          <a key={label} href={href} style={{
            display: "block",
            fontFamily: fonts.sans,
            fontSize: 15,
            fontWeight: 400,
            color: t.inkSoft,
            textDecoration: "none",
            marginBottom: 20,
            letterSpacing: "-0.01em",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = t.coal)}
          onMouseLeave={e => (e.currentTarget.style.color = t.inkSoft)}
          >{label}</a>
        ))}
      </div>

      {/* © 2026 bottom-left */}
      <div style={{
        position: "absolute",
        left: 96,
        bottom: 40,
        fontFamily: fonts.sans,
        fontSize: 13,
        color: t.inkFaint,
        letterSpacing: "0.01em",
      }}>© 2026 HireStepX</div>

      {/* Center block — full-width flex, children centered */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 76,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
      }}>
        <h2 style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: 36,
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.005em",
          color: t.coal,
          textAlign: "center",
          pointerEvents: "auto",
          maxWidth: 560,
        }}>
          You've done the work.
          <br />
          <em style={{ fontStyle: "italic", color: t.copper }}>Now just talk it through.</em>
        </h2>
        <p style={{
          margin: "18px 0 0",
          maxWidth: 400,
          fontFamily: fonts.sans,
          fontSize: 14.5,
          fontWeight: 400,
          lineHeight: 1.68,
          letterSpacing: "-0.004em",
          color: t.inkSoft,
          textAlign: "center",
          pointerEvents: "auto",
        }}>
          Knowing the answer and saying it under pressure aren't the same thing.
          We learned that the hard way too.
        </p>
      </div>

      {/* Right column */}
      <div style={{ position: "absolute", right: 96, top: 76 }}>
        <p style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.16em",
          color: t.copper,
          textTransform: "uppercase",
          margin: "0 0 24px",
        }}>Company</p>
        {COMPANY_LINKS.map(([label, href]) => (
          <a key={label} href={href} style={{
            display: "block",
            fontFamily: fonts.sans,
            fontSize: 15,
            fontWeight: 400,
            color: t.inkSoft,
            textDecoration: "none",
            marginBottom: 20,
            letterSpacing: "-0.01em",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = t.coal)}
          onMouseLeave={e => (e.currentTarget.style.color = t.inkSoft)}
          >{label}</a>
        ))}
      </div>

      {/* Social icons bottom-right */}
      <div style={{ position: "absolute", right: 96, bottom: 36, display: "flex", gap: 12 }}>
        {[
          { icon: <IgIcon />, href: "https://instagram.com/hirestepx", label: "Instagram" },
          { icon: <XIcon />, href: "https://twitter.com/hirestepx", label: "X" },
          { icon: <InIcon />, href: "https://linkedin.com/company/hirestepx", label: "LinkedIn" },
        ].map(({ icon, href, label }) => (
          <a key={label} href={href} aria-label={label} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${t.line}`,
              color: t.inkFaint,
              textDecoration: "none",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = t.copper;
              e.currentTarget.style.color = t.copper;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = t.line;
              e.currentTarget.style.color = t.inkFaint;
            }}
          >{icon}</a>
        ))}
      </div>

    </div>
  );
}

/* ── Mobile fallback (<880px) ── */
function FooterDomeMobile() {
  return (
    <div style={{ background: t.cream, padding: "48px 24px 32px" }}>
      {/* Wordmark */}
      <p style={{
        fontFamily: fonts.sans,
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        color: t.coal,
        margin: "0 0 8px",
      }}>HireStepX</p>
      <p style={{
        fontFamily: fonts.sans,
        fontSize: 13,
        color: t.inkSoft,
        margin: "0 0 36px",
        lineHeight: 1.5,
      }}>
        The AI mock interviewer for India.
      </p>

      {/* Two-column nav */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 24px", marginBottom: 40 }}>
        {[
          { title: "Product", links: PRODUCT_LINKS },
          { title: "Company", links: COMPANY_LINKS },
        ].map(col => (
          <div key={col.title}>
            <p style={{
              fontFamily: fonts.sans,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: t.copper,
              textTransform: "uppercase",
              margin: "0 0 16px",
            }}>{col.title}</p>
            {col.links.map(([label, href]) => (
              <a key={label} href={href} style={{
                display: "block",
                fontFamily: fonts.sans,
                fontSize: 14,
                color: t.inkSoft,
                textDecoration: "none",
                marginBottom: 14,
              }}>{label}</a>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: `1px solid ${t.line}`,
        paddingTop: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint }}>
          © 2026 HireStepX Labs Pvt Ltd
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {LEGAL_LINKS.map(([label, href]) => (
            <a key={label} href={href} style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: t.inkFaint,
              textDecoration: "none",
            }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Public export — drop-in replacement for FinalCTAFooterV2 ── */
export function FooterDome() {
  return (
    <footer aria-label="Site footer">
      <style>{`
        @media (max-width: 879px) { .fd-desktop { display: none !important; } }
        @media (min-width: 880px) { .fd-mobile  { display: none !important; } }
      `}</style>
      <div className="fd-desktop"><FooterDomeDesktop /></div>
      <div className="fd-mobile"><FooterDomeMobile /></div>
    </footer>
  );
}

export default FooterDome;
