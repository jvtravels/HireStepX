import type { CSSProperties, ReactNode } from "react";
import { tokens as t, fonts } from "../auth/_tokens";

/* ════════════════════════════════════════════════════════════════════
   HireStepX — Editorial kit for SEO surfaces
   Shared building blocks that port HomepageV2's editorial craft onto the
   programmatic SEO pages (companies · blog · questions). Pure presentational
   module — NO hooks, NO "use client" — so it can be imported by both the
   server-rendered route pages AND the client BlogPage.

   Motion is CSS-only: a load cascade + scroll reveal via animation-timeline
   where supported. Base state is always visible (opacity:1) so crawlers,
   reduced-motion users, and browsers without animation-timeline never lose
   content — the animation is pure enhancement.
   ════════════════════════════════════════════════════════════════════ */

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/* One <style> block, dropped once per page. Namespaced .ed-* so it never
   collides with the homepage's .mv2-* or the blog's .blog-* rules. */
export const editorialCSS = `
  .ed-container { max-width: 1240px; margin: 0 auto; padding-left: 48px; padding-right: 48px; }
  .ed-reading { max-width: 720px; }

  /* Load cascade — plays once on first paint. Stagger via delay classes. */
  @keyframes edRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  .ed-rise { animation: edRise 0.8s ${EASE} both; }
  .ed-d1 { animation-delay: 0.06s; }
  .ed-d2 { animation-delay: 0.14s; }
  .ed-d3 { animation-delay: 0.24s; }
  .ed-d4 { animation-delay: 0.34s; }
  .ed-d5 { animation-delay: 0.44s; }

  /* Scroll reveal — progressive enhancement. Element is visible by default;
     where animation-timeline is supported it fades up as it enters view. */
  @supports (animation-timeline: view()) {
    @keyframes edReveal { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
    .ed-reveal { animation: edReveal linear both; animation-timeline: view(); animation-range: entry 0% cover 22%; }
  }

  /* Card hover lift */
  .ed-card { transition: transform 0.4s ${EASE}, box-shadow 0.4s ${EASE}, border-color 0.4s ${EASE}; }
  .ed-card:hover { transform: translateY(-3px); }

  /* CTA arrow nudge */
  .ed-cta-arrow { display: inline-block; transition: transform 0.4s ${EASE}; }
  .ed-cta:hover .ed-cta-arrow { transform: translateX(4px); }

  /* Underline-reveal links */
  .ed-link { position: relative; text-decoration: none; }
  .ed-link::after { content: ""; position: absolute; left: 0; bottom: -2px; height: 1px; width: 100%; background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform 0.4s ${EASE}; }
  .ed-link:hover::after { transform: scaleX(1); }

  /* Timeline connecting rule */
  .ed-tl-item:last-child .ed-tl-rule { display: none; }

  /* Rich prose (markdown output) */
  .ed-prose p { margin: 0 0 1.15em; }
  .ed-prose p:last-child { margin-bottom: 0; }
  .ed-prose strong { color: ${t.coal}; font-weight: 600; }
  .ed-prose em { font-style: italic; }
  .ed-prose a { color: ${t.copper}; text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
  .ed-prose ul { margin: 0 0 1.15em; padding: 0; list-style: none; }
  .ed-prose ul > li { position: relative; padding-left: 26px; margin-bottom: 0.6em; }
  .ed-prose ul > li::before { content: ""; position: absolute; left: 4px; top: 0.62em; width: 6px; height: 6px; border-radius: 50%; background: ${t.copper}; }
  .ed-prose ul > li:last-child { margin-bottom: 0; }
  .ed-prose ol { margin: 0 0 1.15em; padding: 0; list-style: none; counter-reset: ed-ol; }
  .ed-prose ol > li { position: relative; padding-left: 38px; margin-bottom: 0.65em; counter-increment: ed-ol; }
  .ed-prose ol > li::before { content: counter(ed-ol, decimal-leading-zero); position: absolute; left: 0; top: 0.12em; font-family: ${fonts.sans}; font-size: 11px; font-weight: 700; color: ${t.copper}; letter-spacing: 0.04em; }
  .ed-prose ol > li:last-child { margin-bottom: 0; }

  @media (max-width: 720px) {
    .ed-container { padding-left: 20px !important; padding-right: 20px !important; }
    .ed-hero { padding-top: 64px !important; padding-bottom: 52px !important; }
    .ed-section { padding-top: 56px !important; padding-bottom: 56px !important; }
    .ed-close { padding-top: 64px !important; padding-bottom: 64px !important; }
    .ed-split { flex-direction: column !important; align-items: flex-start !important; gap: 28px !important; }
    .ed-cta-row { flex-direction: column !important; align-items: stretch !important; }
    .ed-cta-row > a { justify-content: center !important; text-align: center; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ed-rise, .ed-reveal, .ed-card, .ed-cta-arrow, .ed-link::after { animation: none !important; transition: none !important; }
    .ed-rise { opacity: 1 !important; transform: none !important; }
  }
`;

/* ── Shared style atoms ─────────────────────────────────────────────── */

/* Eyebrow label — small uppercase copper/inkFaint tag above headings.
   Override `color` per context (copper for hero, inkFaint for panels). */
export const edEyebrow: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: t.copper,
  margin: 0,
};

/* Sans body lead — 16px regular weight for hero sub-headings. */
export const edSansLead: CSSProperties = {
  fontFamily: fonts.sans,
  fontStyle: "normal",
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.7,
  color: t.inkSoft,
  margin: 0,
};

/* Serif italic lead — kept for long-form blog article heroes only. */
export const edLead: CSSProperties = {
  fontFamily: fonts.serif,
  fontStyle: "italic",
  fontSize: "clamp(19px, 2.2vw, 23px)",
  lineHeight: 1.5,
  color: t.inkSoft,
  margin: 0,
  maxWidth: "40ch",
};

export const edBody: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 16,
  lineHeight: 1.72,
  color: t.inkSoft,
  margin: 0,
};

/* ── Shared spacing scale ───────────────────────────────────────────── */
/* Use these constants so every page's hero/section padding matches. */
export const ED_PADDING = {
  heroTop: 96,
  heroBottom: 80,
  sectionV: 80,
  closeV: 100,
} as const;

/* Accent — renders a headline with an optional italic-copper phrase. */
export function Accent({ children }: { children: ReactNode }) {
  return <span style={{ fontStyle: "italic", color: t.copper }}>{children}</span>;
}

/* Primary + ghost CTA (shared shape with HomepageV2). */
export function ctaPrimaryStyle(size: "md" | "lg" = "lg"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    fontFamily: fonts.sans,
    fontSize: size === "lg" ? 16 : 14,
    fontWeight: 600,
    padding: size === "lg" ? "15px 26px" : "11px 18px",
    borderRadius: 999,
    background: t.copper,
    color: t.cream,
    textDecoration: "none",
    border: 0,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(20,17,10,.12), 0 4px 12px -4px rgba(20,17,10,.20)",
  };
}

export function ctaGhostStyle(size: "md" | "lg" = "lg"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: fonts.sans,
    fontSize: size === "lg" ? 16 : 14,
    fontWeight: 600,
    padding: size === "lg" ? "15px 26px" : "11px 18px",
    borderRadius: 999,
    background: "transparent",
    color: t.coal,
    textDecoration: "none",
    border: `1px solid ${t.lineStrong}`,
    cursor: "pointer",
  };
}

/* ── EditorialHero ──────────────────────────────────────────────────────
   Radial copper glow on cream, hairline baseline. Eyebrow → big serif
   display (with italic-copper accent) → italic lead → CTA/meta row.
   `leftMeta` renders a small stacked spec column on the right at desktop. */
export function EditorialHero({
  eyebrow,
  titleLead,
  accent,
  titleTail,
  lead,
  children,
  meta,
}: {
  eyebrow: string;
  titleLead: string;
  accent?: string;
  titleTail?: string;
  lead?: ReactNode;
  children?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <section
      className="ed-hero"
      style={{
        paddingTop: ED_PADDING.heroTop,
        paddingBottom: ED_PADDING.heroBottom,
        background: t.cream,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div className="ed-container" style={{ position: "relative" }}>
        {meta && (
          <div className="ed-rise ed-d1" style={{ marginBottom: 22 }}>
            {meta}
          </div>
        )}
        <p className="ed-rise ed-d1" style={{ ...edEyebrow, marginBottom: 20 }}>
          {eyebrow}
        </p>
        <h1
          className="ed-rise ed-d2"
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(38px, 5.6vw, 68px)",
            lineHeight: 1.03,
            letterSpacing: "-0.028em",
            color: t.coal,
            margin: 0,
            fontWeight: 400,
            maxWidth: "18ch",
            textWrap: "balance" as const,
          }}
        >
          {titleLead}
          {accent && (
            <>
              {" "}
              <Accent>{accent}</Accent>
            </>
          )}
          {titleTail && ` ${titleTail}`}
        </h1>
        {lead && (
          <div className="ed-rise ed-d3" style={{ marginTop: 26 }}>
            {typeof lead === "string" ? <p style={edLead}>{lead}</p> : lead}
          </div>
        )}
        {children && (
          <div className="ed-rise ed-d4 ed-cta-row" style={{ marginTop: 34, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── SectionHead ────────────────────────────────────────────────────────
   Numbered editorial masthead. `index` prints a copper serif ordinal to
   the left; eyebrow + serif H2 (with optional italic accent) sit beside it. */
export function SectionHead({
  index,
  eyebrow,
  title,
  accent,
  sub,
}: {
  index?: string;
  eyebrow?: string;
  title: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 32 }}>
      {index && (
        <span
          aria-hidden
          style={{
            fontFamily: fonts.serif,
            fontSize: 22,
            fontStyle: "italic",
            color: t.copper,
            opacity: 0.7,
            lineHeight: 1.1,
            flexShrink: 0,
            paddingTop: 6,
          }}
        >
          {index}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <p style={{ ...edEyebrow, marginBottom: 12 }}>{eyebrow}</p>}
        <h2
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(28px, 3.6vw, 42px)",
            lineHeight: 1.08,
            letterSpacing: "-0.022em",
            color: t.coal,
            margin: 0,
            fontWeight: 400,
            maxWidth: "20ch",
            textWrap: "balance" as const,
          }}
        >
          {title}
          {accent && (
            <>
              {" "}
              <Accent>{accent}</Accent>
            </>
          )}
        </h2>
        {sub && (
          <p style={{ ...edBody, marginTop: 14, maxWidth: "56ch", color: t.inkSoft, fontSize: 15 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── SpecTimeline ───────────────────────────────────────────────────────
   Numbered process rows joined by a vertical copper hairline. Replaces the
   plain <ol> + <hr> lists. Each item: ordinal node, connecting rule, label
   (+ optional body). */
export function SpecTimeline({
  items,
}: {
  items: { label: string; body?: string }[];
}) {
  return (
    <ol role="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((it, i) => (
        <li key={i} className="ed-tl-item" style={{ display: "flex", gap: 22 }}>
          {/* ordinal + connecting rule */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 40 }}>
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: t.copper,
                width: 40,
                height: 40,
                borderRadius: 999,
                border: `1px solid ${t.copperBorder}`,
                background: t.copperWash,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="ed-tl-rule"
              aria-hidden
              style={{ width: 1, flex: 1, minHeight: 20, background: t.line, marginTop: 6, marginBottom: 6 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 9, paddingBottom: 26 }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 16, lineHeight: 1.55, color: t.coal, margin: 0, fontWeight: it.body ? 600 : 500 }}>
              {it.label}
            </p>
            {it.body && (
              <p style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 1.6, color: t.inkSoft, margin: "6px 0 0" }}>
                {it.body}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── DarkBand ───────────────────────────────────────────────────────────
   Full-bleed coal section for the closing CTA — the signature rhythm break.
   Copper eyebrow + serif display in cream + supporting copy + CTA. */
export function DarkBand({
  eyebrow,
  title,
  accent,
  children,
  videoSrc,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  children?: ReactNode;
  videoSrc?: string;
}) {
  return (
    <section
      className="ed-close"
      style={{
        position: "relative",
        background: t.coal,
        color: t.cream,
        paddingTop: ED_PADDING.closeV,
        paddingBottom: ED_PADDING.closeV,
        overflow: "hidden",
      }}
    >
      {videoSrc && (
        <video
          aria-hidden
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.22,
            pointerEvents: "none",
          }}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 60% at 78% 100%, rgba(180, 83, 9, 0.18) 0%, transparent 62%)",
          pointerEvents: "none",
        }}
      />
      <div className="ed-container ed-split" style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
        <div style={{ maxWidth: "17ch" }}>
          {eyebrow && <p style={{ ...edEyebrow, color: t.copper, marginBottom: 20 }}>{eyebrow}</p>}
          <h2
            style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(34px, 5vw, 60px)",
              lineHeight: 1.02,
              letterSpacing: "-0.026em",
              color: t.cream,
              margin: 0,
              fontWeight: 400,
              textWrap: "balance" as const,
            }}
          >
            {title}
            {accent && (
              <>
                {" "}
                <span style={{ fontStyle: "italic", color: t.copper }}>{accent}</span>
              </>
            )}
          </h2>
        </div>
        <div style={{ minWidth: "min(300px, 100%)", display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
          {children}
        </div>
      </div>
    </section>
  );
}

/* ── Markdown → React ───────────────────────────────────────────────────
   Lightweight parser for the blog's stored content. Handles blank-line
   paragraphs, bullet blocks (- / * / •), and inline **bold**, *italic*,
   [text](url). Fixes the literal-asterisk bug where content rendered with
   whiteSpace: pre-line. Pure + deterministic — safe in server components. */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: links, then bold, then italic.
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(
        <a key={`${keyPrefix}-a${idx}`} href={m[3]}>
          {m[2]}
        </a>,
      );
    } else if (m[4]) {
      nodes.push(<strong key={`${keyPrefix}-b${idx}`}>{m[5]}</strong>);
    } else if (m[6]) {
      nodes.push(<em key={`${keyPrefix}-i${idx}`}>{m[7]}</em>);
    } else if (m[8]) {
      nodes.push(<em key={`${keyPrefix}-u${idx}`}>{m[9]}</em>);
    }
    last = m.index + m[0].length;
    idx++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function markdownToNodes(raw: string, keyPrefix = "md"): ReactNode[] {
  const blocks = raw.trim().split(/\n{2,}/);
  const out: ReactNode[] = [];

  const isBulletLine = (l: string) => /^\s*[-*•]\s+/.test(l.trim());
  const isNumberedLine = (l: string) => /^\s*\d+\.\s+/.test(l.trim());
  const isListLine = (l: string) => isBulletLine(l) || isNumberedLine(l);
  const stripBullet = (l: string) => l.trim().replace(/^\s*[-*•]\s+/, "");
  const stripNumber = (l: string) => l.trim().replace(/^\s*\d+\.\s+/, "");
  const stripList = (l: string) => isNumberedLine(l) ? stripNumber(l) : stripBullet(l);

  blocks.forEach((block, bi) => {
    const lines = block.split("\n");
    const nonEmpty = lines.filter((l) => l.trim() !== "");
    if (nonEmpty.length === 0) return;

    const allBullet = nonEmpty.every(isBulletLine);
    const allNumbered = nonEmpty.every(isNumberedLine);
    // Mixed: first line(s) are a label, remaining are list items
    const listStart = nonEmpty.findIndex(isListLine);
    const mixed = !allBullet && !allNumbered && listStart > 0 && nonEmpty.slice(listStart).every(isListLine);

    if (allBullet) {
      out.push(
        <ul key={`${keyPrefix}-ul${bi}`}>
          {nonEmpty.map((l, li) => (
            <li key={`${keyPrefix}-ul${bi}-li${li}`}>
              {parseInline(stripBullet(l), `${keyPrefix}-ul${bi}-li${li}`)}
            </li>
          ))}
        </ul>,
      );
    } else if (allNumbered) {
      out.push(
        <ol key={`${keyPrefix}-ol${bi}`}>
          {nonEmpty.map((l, li) => (
            <li key={`${keyPrefix}-ol${bi}-li${li}`}>
              {parseInline(stripNumber(l), `${keyPrefix}-ol${bi}-li${li}`)}
            </li>
          ))}
        </ol>,
      );
    } else if (mixed) {
      // Label paragraph(s) before the list
      const labelText = nonEmpty.slice(0, listStart).join(" ");
      out.push(
        <p key={`${keyPrefix}-lbl${bi}`}>
          {parseInline(labelText, `${keyPrefix}-lbl${bi}`)}
        </p>,
      );
      const listItems = nonEmpty.slice(listStart);
      const useOl = listItems.every(isNumberedLine);
      const ListEl = useOl ? "ol" : "ul";
      out.push(
        <ListEl key={`${keyPrefix}-ml${bi}`}>
          {listItems.map((l, li) => (
            <li key={`${keyPrefix}-ml${bi}-li${li}`}>
              {parseInline(stripList(l), `${keyPrefix}-ml${bi}-li${li}`)}
            </li>
          ))}
        </ListEl>,
      );
    } else {
      out.push(
        <p key={`${keyPrefix}-p${bi}`}>
          {parseInline(block.replace(/\n/g, " "), `${keyPrefix}-p${bi}`)}
        </p>,
      );
    }
  });
  return out;
}

/* Convenience wrapper — renders markdown into the .ed-prose scope. */
export function MarkdownProse({
  text,
  style,
  className,
}: {
  text: string;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`ed-prose${className ? ` ${className}` : ""}`}
      style={{ fontFamily: fonts.sans, fontSize: 17, lineHeight: 1.75, color: t.coal, ...style }}
    >
      {markdownToNodes(text)}
    </div>
  );
}
