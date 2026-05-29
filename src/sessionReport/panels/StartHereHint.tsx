import React from "react";
import type { NegotiationOutcome } from "../derivations";
import { t } from "./_primitives";

/* Anchor IDs for in-page jumps from the start-here hint. */
export const ANCHOR_PART_2 = "nfr-part-2";
export const ANCHOR_PART_3 = "nfr-part-3";
export const ANCHOR_PART_4 = "nfr-part-4";

const anchorStyle: React.CSSProperties = {
  color: t.copper,
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
        Real round in {daysUntilInterview} day{daysUntilInterview === 1 ? "" : "s"}. Skip to{" "}
        <a href={`#${ANCHOR_PART_2}`} className="nfr-anchor" style={anchorStyle}>Part 2</a> for the email draft you can send.
      </>
    );
  } else if (outcome.outcome === "accepted") {
    body = (
      <>
        You accepted. The most useful section here is{" "}
        <a href={`#${ANCHOR_PART_4}`} className="nfr-anchor" style={anchorStyle}>Part 4</a>: what to take into your next negotiation.
      </>
    );
  } else if (outcome.outcome === "walked_away") {
    body = (
      <>
        You walked away.{" "}
        <a href={`#${ANCHOR_PART_3}`} className="nfr-anchor" style={anchorStyle}>Parts 3</a> and{" "}
        <a href={`#${ANCHOR_PART_4}`} className="nfr-anchor" style={anchorStyle}>4</a> (rupees + pattern) are the most useful for your next round.
      </>
    );
  }
  if (body === null) return null;
  return (
    <div className="nfr-start-here">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ flexShrink: 0 }}>
        <path d="M2 7h9M7 3l4 4-4 4" stroke={t.copper} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span><strong>Start here:</strong> {body}</span>
    </div>
  );
}
