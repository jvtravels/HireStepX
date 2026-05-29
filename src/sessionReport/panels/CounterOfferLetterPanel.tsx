import React, { useState } from "react";
import type { NegotiationOutcome } from "../derivations";
import { SectionHeader, EyebrowLabel, t, f, radius, space } from "./_primitives";

/* Inline glossary — terms in the counter-offer letter that first-time
   negotiators (especially first-job-in-family) won't know. The browser's
   native title attribute is used for the tooltip so it works on
   touch devices via long-press without a JS dependency. */
const GLOSSARY: Record<string, string> = {
  "variable pay":
    "The portion of your salary tied to performance: bonus, profit-share, or commission. 'Target with upside' means it can exceed the target; 'hard cap' means the target is the maximum.",
  "stock-option grant":
    "Shares of the company you can buy at a fixed price after a waiting period. The grant is the total number of shares promised; vesting is how they unlock over time.",
  "front-loaded":
    "An ESOP grant that vests faster in the early years (e.g. 40% in year 1). Better for you than even vesting because you get value faster.",
  "refresh policy":
    "Whether the company gives you additional stock-option grants each year (typically year 2 onwards) to keep your total package competitive.",
  "signing component":
    "An upfront one-time bonus paid when you sign. Usually used to offset unvested ESOPs you're leaving behind at your current employer.",
};

/* PlaceholderPill — the yellow `<Recruiter>` / `<Your name>` tag the
 * counter-offer letter renders for every `<...>` token. */
function PlaceholderPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        background: t.warning100,
        border: `1px dashed ${t.warning}`,
        color: t.coal,
        fontFamily: f.mono,
        fontSize: 12,
        fontWeight: 600,
        borderRadius: radius.sm,
        margin: "0 1px",
      }}
    >
      {children}
    </span>
  );
}

/* GlossaryTerm — dotted-underline + native `title` tooltip. */
function GlossaryTerm({ definition, children }: { definition: string; children: React.ReactNode }) {
  return (
    <span
      title={definition}
      style={{
        borderBottom: `1px dotted ${t.inkFaint}`,
        cursor: "help",
      }}
    >
      {children}
    </span>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decorateGlossary(text: string): React.ReactNode {
  const terms = Object.keys(GLOSSARY);
  if (terms.length === 0) return text;
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const segments = text.split(pattern);
  return segments.map((seg, j) => {
    const def = GLOSSARY[seg.toLowerCase()];
    if (def) {
      return (
        <GlossaryTerm key={j} definition={def}>
          {seg}
        </GlossaryTerm>
      );
    }
    return seg;
  });
}

function renderLetterWithPlaceholders(letter: string): React.ReactNode {
  const parts = letter.split(/(<[^>]+>)/g);
  return parts.map((part, i) => {
    if (/^<[^>]+>$/.test(part)) {
      return <PlaceholderPill key={i}>{part}</PlaceholderPill>;
    }
    return <React.Fragment key={i}>{decorateGlossary(part)}</React.Fragment>;
  });
}

export function CounterOfferLetterPanel({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  const closing = outcome.finalTotal ?? (outcome.offers[outcome.offers.length - 1]?.total ?? null);
  const [copied, setCopied] = useState(false);

  if (closing === null) return null;

  let letter: string;
  let commentary: string[];

  if (outcome.outcome === "accepted") {
    letter = `Hi <Recruiter>,

Thank you for the offer for the ${role} role at ${company}. I'm happy to formally accept the package at ₹${closing} LPA total CTC.

Could you send the formal offer letter at your convenience? Happy to confirm notice period and start date once that's in hand.

Best,
<Your name>`;
    commentary = [
      "Confirms acceptance in plain language, no ambiguity for the recruiter",
      "Asks for the formal letter without making it adversarial",
      "Closes with notice period, surfaces the next concrete step",
    ];
  } else if (outcome.candidateAsk !== null) {
    letter = `Hi <Recruiter>,

Thanks for the productive call. I want to keep the conversation alive, I'm genuinely interested in the ${role} role at ${company}.

Where I think we are: you're at ₹${closing} LPA, I'm anchored at ₹${outcome.candidateAsk} LPA. A few questions that might help us close the gap:

  · Is the variable pay a target with upside, or a hard cap?
  · What's the standard stock-option grant at this level, front-loaded or evenly vested?
  · Is a signing component a lever you have at this band?

Happy to jump on a call. Looking forward to closing this together.

Best,
<Your name>`;
    commentary = [
      `Re-anchors with the specific number you named (₹${outcome.candidateAsk} LPA), so the recruiter can't reset the conversation`,
      "Asks 3 specific lever questions, opening 3 negotiation surfaces at once",
      "Stays collaborative: 'looking forward to closing this together' invites a counter, not a refusal",
    ];
  } else {
    letter = `Hi <Recruiter>,

Thanks for the offer for the ${role} role at ${company}. I'd like to take a moment to think it through against the market for this band before responding fully.

A few questions that would help me put together a thoughtful response:

  · Is the variable pay a target with upside, or a hard cap?
  · What's the standard stock-option grant at this level, and the refresh policy at year 2?
  · Is a signing component a lever you have at this band?
  · What flexibility is there on work-from-home days?

Once I have a clearer picture, I'd like to come back with a specific number. Could we set up a follow-up call this week?

Best,
<Your name>

— — —
Before you send: name a specific counter number in your follow-up call. Look up the band on Levels.fyi or
Glassdoor for "${role}" at companies similar to ${company} this quarter. A defended range
("I was anchoring at ₹X–Y based on what I'm seeing") is stronger than a single number.`;
    commentary = [
      "Buys time without committing to a number you haven't researched yet",
      "Asks 4 specific lever questions, keeping the conversation alive on multiple fronts",
      "Sets up a follow-up where you can name a specific counter, once you've done the research",
      "The footer reminds you to research the market band before naming a number. Strong anchors are defended ranges, not single numbers",
    ];
  }

  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span className="nfr-pill nfr-pill-good">MOST ACTIONABLE</span>
      </div>
      <SectionHeader
        index="07"
        title="Your counter-offer email, ready to send"
        subtitle="We wrote this from your call. Replace the highlighted placeholders, then copy and send."
      />
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", marginBottom: 10,
          background: "#FEF3C7", border: `1px solid ${t.warning}`,
          borderRadius: radius.lg, fontSize: 12, color: t.coal,
        }}
      >
        <span style={{ fontWeight: 600, color: t.warning }}>Heads up</span>
        <span>Replace the yellow placeholders before you press send.</span>
      </div>
      <div
        style={{
          margin: "0 0 16px",
          padding: space.panelPad, background: t.cream, border: `1px solid ${t.lineStrong}`,
          borderRadius: radius.xl, fontFamily: f.sans, fontSize: 14,
          color: t.coal, lineHeight: 1.65, whiteSpace: "pre-line",
          wordBreak: "break-word", overflow: "auto",
        }}
      >
        {renderLetterWithPlaceholders(letter)}
      </div>
      <div>
        <EyebrowLabel>WHY THIS DRAFT</EyebrowLabel>
        {commentary.map((c, i) => (
          <div key={i} style={{ fontSize: 13, color: t.coal, marginBottom: 6, paddingLeft: 16, position: "relative" }}>
            <span style={{ position: "absolute", left: 0, color: t.indigo }}>·</span>
            {c}
          </div>
        ))}
      </div>
      <div className="nfr-letter-actions">
        <button
          className="nfr-btn-primary"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(letter).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }
          }}
          aria-live="polite"
        >
          {copied ? "✓ Copied" : "Copy as email"}
        </button>
      </div>
    </div>
  );
}
