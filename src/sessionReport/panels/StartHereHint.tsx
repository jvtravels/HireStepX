import React from "react";
import type { NegotiationOutcome } from "../derivations";
import { t } from "./_primitives";

/* Anchor IDs for in-page jumps from the start-here hint. */
export const ANCHOR_ACTION = "nfr-action";
export const ANCHOR_WORTH = "nfr-worth";
export const ANCHOR_PATTERN = "nfr-pattern";

const anchorStyle: React.CSSProperties = {
  color: t.indigo,
  textDecoration: "underline",
  textUnderlineOffset: 2,
  fontWeight: 600,
};

/* Render the start-here hint only for state-specific guidance — when
   we actually have something useful to say (real round imminent, or
   the outcome was accepted/walked-away). For the default case, the
   TL;DR hero IS the start-here cue, so an additional arrow is just
   redundant chrome. */
export function StartHereHint({ outcome, daysUntilInterview }: { outcome: NegotiationOutcome; daysUntilInterview?: number }) {
  let body: React.ReactNode = null;
  if (typeof daysUntilInterview === "number" && daysUntilInterview <= 7) {
    body = (
      <>
        Real round in {daysUntilInterview} day{daysUntilInterview === 1 ? "" : "s"}. Jump to{" "}
        <a href={`#${ANCHOR_ACTION}`} className="nfr-anchor" style={anchorStyle}>What to do next</a> for the email draft you can send.
      </>
    );
  } else if (outcome.outcome === "accepted") {
    body = (
      <>
        You accepted. The most useful section here is{" "}
        <a href={`#${ANCHOR_PATTERN}`} className="nfr-anchor" style={anchorStyle}>Your pattern</a>: what to take into your next negotiation.
      </>
    );
  } else if (outcome.outcome === "walked_away") {
    body = (
      <>
        You walked away.{" "}
        <a href={`#${ANCHOR_WORTH}`} className="nfr-anchor" style={anchorStyle}>What it&apos;s worth</a> and{" "}
        <a href={`#${ANCHOR_PATTERN}`} className="nfr-anchor" style={anchorStyle}>Your pattern</a> are the most useful for your next round.
      </>
    );
  }
  if (body === null) return null;
  return (
    <div className="nfr-start-here">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
        <path d="M2 7h9M7 3l4 4-4 4" stroke={t.indigo} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span><strong>Start here:</strong> {body}</span>
    </div>
  );
}
