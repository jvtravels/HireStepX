/* HireStepX — Full Salary Negotiation Report (production)
 *
 * Replaces the legacy `NegotiationOutcomeSection` for sessions where
 * `data.negotiationOutcome` is present. Renders a multi-panel deep-dive
 * organised in 4 chapters:
 *
 *   Part 1 — What happened in this call (diagnosis)
 *   Part 2 — What to do next (action: counter-offer email + checklist)
 *   Part 3 — What it's worth in rupees (cohort + NPV math)
 *   Part 4 — Your pattern across sessions (archetype + drills)
 *
 * Design principles:
 *
 *   • Plain English. No jargon (BATNA, anchor delta, NPV, p18) unaided.
 *     Every metric reads as a question or sentence. A first-time
 *     negotiator can read every section without a glossary.
 *
 *   • Honest about empty states. Each panel renders only when its
 *     slice of data is present. The component degrades gracefully if
 *     the backend hasn't wired a particular signal yet — we don't
 *     show "coming soon" placeholders.
 *
 *   • Mobile-first reflow. All 2-up and 3-up grids collapse to single
 *     column at ≤768px via the `nfr-*` classes in styles.ts. The TL;DR
 *     stats grid drops to 2-up on phones, then 1-up under 420px.
 *
 *   • View-mode aware. The "Start here" hint above the TL;DR adapts
 *     to the outcome state — accepted, walked away, no agreement —
 *     and (when present) to daysUntilInterview urgency.
 *
 *   • Production tokens. All colours come from `./tokens` so the
 *     surface stays editorial cream/coal/copper/indigo rather than
 *     freelancing. The TL;DR hero is the one exception (a dark
 *     gradient card) — it earns the contrast as the most-read piece.
 *
 * The legacy NegotiationOutcomeSection is preserved (offer trajectory
 * pill row + acceptance email + transcript export) and rendered as
 * the canonical "outcome record" inside Part 1, alongside the new
 * concession analysis and anchor-bracket panels. Nothing is lost. */

import type { Question } from "./types";
import type { InterviewResultData } from "./types";
import { t, f, shadows } from "./tokens";

type NegotiationOutcome = NonNullable<InterviewResultData["negotiationOutcome"]>;

/* Brand-derived "on-dark" colors for the TL;DR hero card. The stat
   values sit on a coal→indigo gradient so the cream-background tokens
   (success #15803D, error #B91C1C) lack contrast. These are brand
   hues lightened to ~70% lightness for AA contrast against the
   gradient. They are NOT generic Tailwind 300-series colors — each
   maps directly to a design-system hue. */
const ON_DARK = {
  good: "#7BD9A3",     // brand success (#15803D), lightened
  bad: "#F2A0A0",      // brand error (#B91C1C), lightened
  warn: "#E8B97D",     // brand copper (#B45309), lightened
  neutral: "#FFFFFF",
} as const;

interface Props {
  outcome: NegotiationOutcome;
  role: string;
  company: string;
  questions: Question[];
  daysUntilInterview?: number;
  priorSessionCount?: number;
}

/* ─── Inline primitives ─────────────────────────────────────── */

function FreshnessChip({ source, n, asOf }: { source: string; n?: number; asOf?: string }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", background: t.cream, border: `1px solid ${t.line}`,
        borderRadius: 999, fontSize: 10, fontFamily: f.mono,
        color: t.inkSoft, letterSpacing: 0.3,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.success }} />
      <span style={{ fontWeight: 600 }}>{source}</span>
      {typeof n === "number" && <span>· n={n}</span>}
      {asOf && <span>· {asOf}</span>}
    </span>
  );
}

function PlayableTime({ at }: { at: string }) {
  return (
    <span
      className="nfr-time-pill"
      title="Jump to this moment in the recording"
      role="button"
      tabIndex={0}
    >
      <span style={{ fontSize: 9 }}>▶</span>
      {at}
    </span>
  );
}

function SectionHeader({ index, title, subtitle, accent = t.indigo }: {
  index: string; title: string; subtitle?: string; accent?: string;
}) {
  return (
    <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
      <span
        style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          color: accent, fontFamily: f.mono,
        }}
      >
        {index}
      </span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: t.coal, letterSpacing: -0.2, fontFamily: f.serif }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 13, color: t.inkSoft, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function SectionBand({
  label, title, subtitle, accent, bg,
}: { label: string; title: string; subtitle: string; accent: string; bg: string }) {
  return (
    <div className="nfr-section-band" style={{ background: bg, borderTopColor: accent, borderTopWidth: 2, borderTopStyle: "solid" }}>
      <div
        style={{
          padding: "5px 11px", background: accent, color: "#FFFFFF",
          fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
          borderRadius: 4, textTransform: "uppercase", fontFamily: f.mono,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: t.coal, letterSpacing: -0.2, fontFamily: f.serif }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: t.inkSoft, marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

/* ─── Derivations from the existing negotiationOutcome shape ─── */

function derivePhases(outcome: NegotiationOutcome) {
  const offers = outcome.offers ?? [];
  const reachedReaction = offers.length >= 1;
  const reachedCounter = outcome.candidateAsk !== null;
  const reachedJustification = reachedCounter; // can't separate without transcript classify
  const reachedPushback = offers.length >= 2; // multiple offer rounds = pushbacks
  const reachedLevers = offers.length >= 3;
  const reachedClose =
    outcome.outcome === "accepted" || outcome.outcome === "walked_away";
  return [
    { num: 1, name: "You reacted to the offer", reached: reachedReaction, note: reachedReaction ? "First offer received" : undefined },
    { num: 2, name: "You named your counter number", reached: reachedCounter, note: outcome.candidateAsk ? `Asked for ₹${outcome.candidateAsk} LPA` : "No counter named" },
    { num: 3, name: "You justified your number", reached: reachedJustification },
    { num: 4, name: "You handled their pushback", reached: reachedPushback, note: offers.length >= 2 ? `${offers.length - 1} round(s) of back-and-forth` : undefined },
    { num: 5, name: "You explored package levers", reached: reachedLevers },
    { num: 6, name: "You closed the deal", reached: reachedClose, note: outcome.outcome === "accepted" ? "Accepted" : outcome.outcome === "walked_away" ? "Walked away" : undefined },
  ];
}

function deriveConcessionsFromOffers(outcome: NegotiationOutcome): { pushback: string; outcome: "held" | "deflected" | "conceded"; detail: string }[] {
  // Each new offer signals a pushback — was the candidate's response a hold or fold?
  // We approximate: if the offer moved up, candidate held. If candidate accepted at offer N
  // without pushing for N+1, last move counts as conceded.
  const offers = outcome.offers ?? [];
  if (offers.length < 2) return [];
  const events: { pushback: string; outcome: "held" | "deflected" | "conceded"; detail: string }[] = [];
  for (let i = 1; i < offers.length; i++) {
    const prev = offers[i - 1];
    const cur = offers[i];
    const moved = cur.total - prev.total;
    if (moved > 0) {
      events.push({
        pushback: `After your push, they came back at ₹${cur.total} LPA`,
        outcome: "held",
        detail: `They moved up ₹${moved} LPA — your push worked.`,
      });
    } else {
      events.push({
        pushback: `They held at ₹${cur.total} LPA`,
        outcome: i === offers.length - 1 && outcome.outcome === "accepted" ? "conceded" : "deflected",
        detail: i === offers.length - 1 && outcome.outcome === "accepted" ? "You accepted at this number." : "You held — kept the conversation going.",
      });
    }
  }
  return events;
}

function deriveAnchorBracket(outcome: NegotiationOutcome): NonNullable<NegotiationOutcome["anchorBracket"]> | null {
  if (outcome.anchorBracket) return outcome.anchorBracket;
  if (outcome.candidateAsk === null) {
    return {
      type: "none",
      quote: "(no counter-anchor named)",
      verdict:
        "You didn't name a counter-number. Without a number, the recruiter's first offer becomes the ceiling. Even a vague range ('I was thinking mid-40s') would have shifted the negotiation surface.",
    };
  }
  // We have a number but no transcript classification — call it "single" by default.
  return {
    type: "single",
    quote: `I'd be looking at around ₹${outcome.candidateAsk} LPA.`,
    verdict:
      "You named a single number — better than nothing. Strong negotiators name a defended range ('I was anchoring at ₹X based on the cohort and where I am in conversations elsewhere') instead, so the recruiter can't pull the anchor down without producing a counter-justification.",
  };
}

function computeNpvRows(outcome: NegotiationOutcome) {
  const offers = outcome.offers ?? [];
  if (offers.length === 0) return [];
  const opening = offers[0].total;
  const closing = outcome.finalTotal ?? offers[offers.length - 1].total;
  const delta = closing - opening;
  if (delta === 0) return [];
  const sign = delta >= 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const tone: "good" | "bad" = delta >= 0 ? "good" : "bad";
  const fourYr = abs * 4;
  const afterTax = Math.round(fourYr * 0.7 * 10) / 10; // 30% tax slab
  const npv = Math.round(afterTax * 0.79 * 10) / 10; // 6% inflation × 4 years
  return [
    { label: `${delta >= 0 ? "Extra" : "Missed"} base salary over 4 years`, value: `${sign}₹${fourYr}L`, tone },
    { label: "After 30% income tax", value: `${sign}₹${afterTax}L take-home`, tone },
    { label: "After 6% inflation (today's rupees)", value: `${sign}₹${npv}L`, tone },
    { label: delta >= 0 ? "Total: extra rupees you negotiated" : "Total: what accepting cost you", value: `${sign}₹${npv}L`, tone },
  ];
}

/* ─── Panels ─────────────────────────────────────────────────── */

function StartHereHint({ outcome, daysUntilInterview }: { outcome: NegotiationOutcome; daysUntilInterview?: number }) {
  let msg = "Read the headline below for the 30-second answer. Scroll for the full breakdown.";
  if (typeof daysUntilInterview === "number" && daysUntilInterview <= 7) {
    msg = `Real round in ${daysUntilInterview} day${daysUntilInterview === 1 ? "" : "s"}. Skip to Part 2 for the email draft + checklist.`;
  } else if (outcome.outcome === "accepted") {
    msg = "You accepted. The most useful section here is Part 4 — what to take into your next negotiation.";
  } else if (outcome.outcome === "walked_away") {
    msg = "You walked away. Part 3 (what it's worth in rupees) and Part 4 (your pattern) are the most useful.";
  }
  return (
    <div className="nfr-start-here">
      <span style={{ fontSize: 18 }}>👇</span>
      <span><strong>Start here:</strong> {msg}</span>
    </div>
  );
}

function TLDRHero({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  const offers = outcome.offers ?? [];
  const opening = offers[0]?.total ?? null;
  const closing = outcome.finalTotal ?? (offers[offers.length - 1]?.total ?? null);
  const delta = (opening !== null && closing !== null) ? closing - opening : null;
  const askGap = (outcome.candidateAsk !== null && opening !== null && closing !== null && outcome.candidateAsk > opening)
    ? Math.round(((closing - opening) / (outcome.candidateAsk - opening)) * 100)
    : null;

  const phaseCount = derivePhases(outcome).filter(p => p.reached).length;

  let verdict: string;
  if (outcome.outcome === "accepted" && delta !== null && delta > 0) {
    verdict = `You moved the offer from ₹${opening} LPA up to ₹${closing} LPA — that's ₹${delta * 4}L extra over 4 years before tax. ${askGap !== null ? `You closed ${askGap}% of the gap to your stated ask.` : ""}`;
  } else if (outcome.outcome === "accepted" && delta === 0) {
    verdict = `You accepted at ₹${closing} LPA — the same as their first offer. No counter, no movement. Comparable candidates typically push for 15–35% above the opening number.`;
  } else if (outcome.outcome === "walked_away") {
    verdict = `You walked away from a ₹${closing} LPA offer for ${role} at ${company}. Use the panels below to decide whether the next round of this role (or a similar one) is worth a counter-anchor.`;
  } else {
    verdict = `You explored ${offers.length} offer point${offers.length !== 1 ? "s" : ""} but didn't close. Read Part 2 (what to do next) for the email draft you can send the recruiter to keep the conversation alive.`;
  }

  type StatTone = "good" | "bad" | "warn" | "neutral";
  const stats: Array<{ label: string; value: string; hint?: string; tone: StatTone }> = [];
  if (delta !== null) {
    stats.push({
      label: delta >= 0 ? "What you won" : "What it cost you",
      value: `${delta >= 0 ? "+" : "−"}₹${Math.abs(delta * 4)}L`,
      hint: "extra rupees over 4 years, before tax",
      tone: delta > 0 ? "good" : delta < 0 ? "bad" : "neutral",
    });
  }
  if (typeof outcome.percentileWithinBand === "number") {
    const p = outcome.percentileWithinBand;
    stats.push({
      label: "How you ranked",
      value: p < 30 ? `Bottom ${p}%` : p > 70 ? `Top ${100 - p}%` : `Middle ${p}%`,
      hint: "vs others who got the same offer",
      tone: p < 30 ? "bad" : p > 70 ? "good" : "warn",
    });
  }
  stats.push({
    label: "How far you got",
    value: `${phaseCount} of 6 stages`,
    hint:
      phaseCount === 6 ? "you closed the deal" :
      phaseCount >= 5 ? "one short of the close" :
      phaseCount >= 3 ? "made it past the counter" :
      "stalled at the very first reaction",
    tone: phaseCount >= 5 ? "good" : phaseCount >= 3 ? "warn" : "bad",
  });
  if (delta !== null && opening !== null) {
    const askedFor = outcome.candidateAsk;
    if (askedFor !== null && askedFor > opening) {
      const askPct = Math.round(((askedFor - opening) / opening) * 100);
      stats.push({
        label: "How much you pushed back",
        value: `+${askPct}%`,
        hint: "above their first offer",
        tone: askPct >= 25 ? "good" : askPct >= 10 ? "warn" : "bad",
      });
    } else {
      stats.push({
        label: "How much you pushed back",
        value: "0%",
        hint: "you didn't name a counter-number",
        tone: "bad",
      });
    }
  }

  const toneColor: Record<StatTone, string> = ON_DARK;

  return (
    <div className="nfr-tldr-card">
      <div
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          textTransform: "uppercase", color: "rgba(255,255,255,0.6)",
          marginBottom: 12, fontFamily: f.mono,
        }}
      >
        TL;DR · 30-second read
      </div>
      <div
        style={{
          fontSize: 18, lineHeight: 1.45, fontWeight: 500,
          marginBottom: 24, maxWidth: 820, color: "rgba(255,255,255,0.92)",
          fontFamily: f.sans,
        }}
      >
        {verdict}
      </div>
      <div className="nfr-tldr-stats">
        {stats.map((s, i) => (
          <div key={i}>
            <div
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
                marginBottom: 6,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 26, fontWeight: 700, fontFamily: f.mono,
                color: toneColor[s.tone], letterSpacing: -0.5, lineHeight: 1.1,
              }}
            >
              {s.value}
            </div>
            {s.hint && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                {s.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseLadderPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const phases = derivePhases(outcome);
  const reached = phases.filter(p => p.reached).length;
  const reachedColor = reached >= 5 ? t.success : reached >= 3 ? t.copper : t.error;
  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="01"
          title="How far you got in the negotiation"
          subtitle="A strong negotiation moves through 6 stages — from reacting to the offer all the way to closing."
        />
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: f.mono, color: reachedColor, lineHeight: 1 }}>
            {reached}<span style={{ color: t.inkFaint, fontWeight: 500 }}> / 6</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.inkSoft, textTransform: "uppercase", marginTop: 4 }}>
            Stages
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, marginTop: 4 }}>
        {phases.map((p) => (
          <div key={p.num} style={{ flex: 1, height: 8, borderRadius: 4, background: p.reached ? t.success : t.line }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {phases.map((p) => (
          <div
            key={p.num}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 14px",
              background: p.reached ? t.success100 : t.creamSoft,
              border: `1px solid ${p.reached ? t.success : t.line}`,
              borderRadius: 10,
              opacity: p.reached ? 1 : 0.6,
            }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: p.reached ? t.success : "#FFFFFF",
                color: p.reached ? "#FFFFFF" : t.inkFaint,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 13, fontFamily: f.mono,
                border: p.reached ? "none" : `1px solid ${t.lineStrong}`,
                flexShrink: 0,
              }}
            >
              {p.reached ? "✓" : p.num}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.coal }}>{p.name}</div>
              {p.note && <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{p.note}</div>}
            </div>
            <span className={`nfr-pill ${p.reached ? "nfr-pill-good" : "nfr-pill-neutral"}`}>
              {p.reached ? "Reached" : "Not reached"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConcessionAnalysisPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const events = outcome.pushbacks ?? deriveConcessionsFromOffers(outcome);
  if (events.length === 0) return null;
  const held = events.filter(e => e.outcome === "held").length;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="02"
        title="When they pushed back, did you fold?"
        subtitle={`You held ${held} of ${events.length} pushbacks.`}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {events.map((e, i) => {
          const accent = e.outcome === "held" ? t.success : e.outcome === "deflected" ? t.copper : t.error;
          return (
            <div
              key={i}
              style={{
                display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
                padding: "12px 14px", background: t.creamSoft,
                borderLeft: `3px solid ${accent}`, borderRadius: 6,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.coal, marginBottom: 3 }}>
                  "{e.pushback}"
                </div>
                <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{e.detail}</div>
              </div>
              <span
                className={`nfr-pill ${e.outcome === "held" ? "nfr-pill-good" : e.outcome === "deflected" ? "nfr-pill-warn" : "nfr-pill-bad"}`}
                style={{ alignSelf: "flex-start" }}
              >
                {e.outcome}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnchorBracketPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const bracket = deriveAnchorBracket(outcome);
  if (!bracket) return null;
  const map = {
    single: { label: "Single number", tone: "warn" as const, ladder: 1 },
    range: { label: "Range only", tone: "warn" as const, ladder: 2 },
    range_with_justification: { label: "Range + justification", tone: "good" as const, ladder: 3 },
    none: { label: "No counter named", tone: "bad" as const, ladder: 0 },
  };
  const m = map[bracket.type];
  const toneColor = m.tone === "good" ? t.success : m.tone === "warn" ? t.copper : t.error;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="03"
        title="The way you named your number"
        subtitle="There are 4 ways to counter an offer — from weakest to strongest."
      />
      <div style={{ marginBottom: 12 }}>
        <span className={`nfr-pill nfr-pill-${m.tone}`}>{m.label}</span>
      </div>
      <div
        style={{
          padding: 12, background: t.creamSoft, borderRadius: 8,
          marginBottom: 12, fontSize: 13, color: t.coal, fontStyle: "italic",
          borderLeft: `3px solid ${t.lineStrong}`,
        }}
      >
        "{bracket.quote}"
      </div>
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.55 }}>{bracket.verdict}</div>
      <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 6, borderRadius: 3,
              background: i <= m.ladder ? toneColor : t.line,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 6, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
        }}
      >
        <span>NONE</span><span>SINGLE</span><span>RANGE</span><span>RANGE + JUSTIFY</span>
      </div>
    </div>
  );
}

function VerbalHabitsPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.verbalHabits || outcome.verbalHabits.length === 0) return null;
  const leaks = outcome.disclosureLeaks ?? [];
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="04"
        title="Words you said that hurt your offer"
        subtitle="Phrases like 'I think', 'kind of', or 'sounds fair' make recruiters lower their offer. Click the timestamp to listen back."
      />
      <div style={{ marginBottom: leaks.length > 0 ? 18 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.inkSoft, marginBottom: 8 }}>
          TOP COSTLY PHRASES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {outcome.verbalHabits.map((h, i) => (
            <div
              key={i}
              style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                gap: 12, alignItems: "center",
                padding: "10px 12px", background: t.creamSoft, borderRadius: 6,
              }}
            >
              <div style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 700, color: t.error, minWidth: 32 }}>
                ×{h.count}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.coal, fontFamily: f.mono }}>
                  "{h.phrase}"
                </div>
                <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{h.cost}</div>
              </div>
              {h.timestamps && h.timestamps.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 180 }}>
                  {h.timestamps.map((ts, j) => <PlayableTime key={j} at={ts} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {leaks.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.error, marginBottom: 8 }}>
            DISCLOSURE LEAKS · {leaks.length}
          </div>
          {leaks.map((l, i) => (
            <div key={i} style={{ padding: "10px 12px", background: t.error100, borderRadius: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: t.error, fontFamily: f.mono, marginBottom: 2 }}>
                <PlayableTime at={l.at} />
                <span>· {l.leak}</span>
              </div>
              <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{l.cost}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SilenceMapPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.silenceMoments || outcome.silenceMoments.length === 0) return null;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="05"
        title="When you went quiet — and whether it helped"
        subtitle="Silence after you name a number is your friend. Silence when you should be pushing back is your enemy."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {outcome.silenceMoments.map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              gap: 12, alignItems: "center",
              padding: "10px 14px",
              background: s.healthy ? t.success100 : t.error100,
              borderRadius: 6,
            }}
          >
            <PlayableTime at={s.at} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{s.duration} silence</div>
              <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{s.context}</div>
            </div>
            <span className={`nfr-pill ${s.healthy ? "nfr-pill-good" : "nfr-pill-bad"}`}>
              {s.healthy ? "Served you" : "Filled too fast"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnaskedLeversPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.unaskedLevers || outcome.unaskedLevers.length === 0) return null;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="06"
        title="Questions you should have asked but didn't"
        subtitle="Each of these would likely have unlocked more money. We explain what each is worth."
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {outcome.unaskedLevers.map((l, i) => (
          <div key={i} style={{ paddingLeft: 14, borderLeft: `3px solid ${t.copper}`, padding: "8px 0 8px 14px" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.coal, fontFamily: f.mono, marginBottom: 4 }}>
              {l.question}
            </div>
            <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{l.whyItMatters}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CounterOfferLetterPanel({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  const closing = outcome.finalTotal ?? (outcome.offers[outcome.offers.length - 1]?.total ?? null);
  if (closing === null) return null;
  // Differentiate the letter by outcome state.
  let letter: string;
  let commentary: string[];
  if (outcome.outcome === "accepted") {
    letter = `Hi <Recruiter>,

Thank you for the offer for the ${role} role at ${company}. I'm happy to formally accept the package at ₹${closing} LPA total CTC.

Could you send the formal offer letter at your convenience? Happy to confirm notice period and start date once that's in hand.

Best,
<Your name>`;
    commentary = [
      "Confirms acceptance in plain language — no ambiguity for the recruiter",
      "Asks for the formal letter without making it adversarial",
      "Closes with notice period — surfaces the next concrete step",
    ];
  } else if (outcome.outcome === "no_agreement" && outcome.candidateAsk !== null) {
    letter = `Hi <Recruiter>,

Thanks for the productive call yesterday. I want to keep the conversation alive — I'm genuinely interested in the ${role} role at ${company}.

Where I think we are: you're at ₹${closing} LPA, I'm anchored at ₹${outcome.candidateAsk} LPA. A few questions that might help us close the gap:

  · Is the variable pay a target with upside, or a hard cap?
  · What's the standard ESOP grant for this level — front-loaded or evenly vested?
  · Is signing a lever you have at this band?

Happy to jump on a call. Looking forward to closing this together.

Best,
<Your name>`;
    commentary = [
      "Re-anchors with a specific number (₹" + outcome.candidateAsk + " LPA) so the recruiter doesn't reset the conversation",
      "Asks 3 specific lever questions — opens 3 negotiation surfaces at once",
      "Stays collaborative — 'looking forward to closing this together' invites a counter, not a refusal",
    ];
  } else {
    letter = `Hi <Recruiter>,

Thanks for the offer for the ${role} role at ${company}. I've thought it through against where I am in conversations elsewhere and against the current market for this band.

I'd like to go back with a counter at a number closer to ₹${Math.round(closing * 1.15)} LPA, plus a few questions on the package shape:

  · Is the variable a target with upside or a hard cap?
  · What's the ESOP grant for this level, and the refresh policy at year 2?
  · Is signing a lever you have for an external hire at this band?

I want to make this work — happy to jump on a call.

Best,
<Your name>`;
    commentary = [
      "Suggests a +15% counter against the existing offer — strong but defensible anchor",
      "Decomposes the package into 3 levers — opens 3 negotiation surfaces, not 1",
      "Implicit BATNA reference ('conversations elsewhere') without committing to a specific competing offer",
      "Stays collaborative — 'I want to make this work' invites them to defend, not dismiss",
    ];
  }
  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <span className="nfr-pill nfr-pill-good">MOST ACTIONABLE</span>
      </div>
      <SectionHeader
        index="07"
        title="Your counter-offer email — ready to send"
        subtitle="We wrote this from your call. Read through, edit a line or two, and send it."
      />
      <pre
        style={{
          margin: "0 0 16px",
          padding: 22, background: t.cream, border: `1px solid ${t.lineStrong}`,
          borderRadius: 10, fontFamily: f.sans, fontSize: 14,
          color: t.coal, lineHeight: 1.65, whiteSpace: "pre-wrap",
          wordBreak: "break-word", overflow: "auto",
        }}
      >
        {letter}
      </pre>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.inkSoft, marginBottom: 8 }}>
          WHY THIS DRAFT
        </div>
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
              navigator.clipboard.writeText(letter);
            }
          }}
        >
          Copy as email
        </button>
        <button className="nfr-btn-secondary">Edit in your voice</button>
        <button className="nfr-btn-secondary">Show alternatives</button>
      </div>
    </div>
  );
}

function CohortPlacementPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (typeof outcome.percentileWithinBand !== "number") return null;
  const p = outcome.percentileWithinBand;
  const tone = p < 30 ? t.error : p > 70 ? t.success : t.copper;
  const phrase = p < 30 ? `Bottom ${p}% of candidates` : p > 70 ? `Top ${100 - p}% of candidates` : `Middle ${p}% of candidates`;
  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="08"
          title="Where your offer sits vs others like you"
          subtitle={outcome.cohortLabel ?? "Compared to candidates with the same role + level + company tier."}
        />
        {(outcome.cohortN || outcome.cohortFreshness) && (
          <FreshnessChip
            source="Cohort data"
            n={outcome.cohortN}
            asOf={outcome.cohortFreshness ?? "last 90d"}
          />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 56, fontWeight: 700, fontFamily: f.mono,
            color: tone, letterSpacing: -2, lineHeight: 1,
          }}
        >
          p{p}
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: tone, lineHeight: 1.2 }}>{phrase}</div>
      </div>
      <div
        style={{
          height: 12, background: t.line, borderRadius: 6,
          position: "relative", marginBottom: 8, marginTop: 16,
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: t.error100, borderRadius: "6px 0 0 6px" }} />
        <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "50%", background: "rgba(180,83,9,0.18)" }} />
        <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, right: 0, background: t.success100, borderRadius: "0 6px 6px 0" }} />
        <div style={{ position: "absolute", left: `${p}%`, top: -4, bottom: -4, width: 4, background: t.coal, borderRadius: 2, transform: "translateX(-2px)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
        <span>p25</span><span>p50</span><span>p75</span>
      </div>
    </div>
  );
}

function NPVMathPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const rows = computeNpvRows(outcome);
  if (rows.length === 0) return null;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="09"
        title="What this offer is really worth, after tax"
        subtitle="The headline rupee number minus tax and inflation — actual rupees that hit your bank account."
      />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {rows.map((r, i) => {
            const tone = r.tone === "bad" ? t.error : r.tone === "good" ? t.success : t.coal;
            const isLast = i === rows.length - 1;
            return (
              <tr
                key={i}
                style={{
                  borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
                  background: isLast ? t.creamSoft : "transparent",
                }}
              >
                <td style={{ padding: "12px 8px", color: isLast ? t.coal : t.inkSoft, fontWeight: isLast ? 700 : 400 }}>
                  {r.label}
                </td>
                <td
                  style={{
                    padding: "12px 8px", textAlign: "right", fontFamily: f.mono,
                    fontWeight: isLast ? 800 : 600, fontSize: isLast ? 16 : 13, color: tone,
                  }}
                >
                  {r.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CounterpartyPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.counterpartyFacts || outcome.counterpartyFacts.length === 0) return null;
  return (
    <div className="nfr-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <SectionHeader
          index="10"
          title="How this company usually negotiates"
          subtitle="What we've learned about this employer specifically — where they're flexible, where they're not."
        />
        {outcome.counterpartySource && (
          <FreshnessChip source={outcome.counterpartySource} asOf="last 30d" />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {outcome.counterpartyFacts.map((f, i) => {
          const accent = f.tone === "good" ? t.success : f.tone === "bad" ? t.error : t.copper;
          return (
            <div
              key={i}
              style={{
                display: "flex", gap: 12, padding: "10px 14px",
                background: t.creamSoft, borderLeft: `3px solid ${accent}`,
                borderRadius: 6, fontSize: 13, color: t.coal, lineHeight: 1.55,
              }}
            >
              {f.fact}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchetypePanel({ outcome, priorSessionCount }: { outcome: NegotiationOutcome; priorSessionCount?: number }) {
  if (!outcome.archetype) {
    if ((priorSessionCount ?? 0) < 2) {
      return (
        <div className="nfr-panel">
          <SectionHeader
            index="11"
            title="The pattern across your sessions"
            subtitle="We need at least two negotiation sessions to spot a pattern."
          />
          <div
            style={{
              padding: 16, background: t.creamSoft, borderRadius: 10,
              fontSize: 13, color: t.inkSoft, lineHeight: 1.55,
            }}
          >
            Run one more negotiation session and we'll show you the habit you keep repeating — and the single move
            that breaks the pattern.
          </div>
        </div>
      );
    }
    return null;
  }
  const a = outcome.archetype;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="11"
        title="The pattern we see across all your sessions"
        subtitle="What you keep getting right, and the one habit that keeps holding you back."
      />
      <div style={{ marginBottom: 12 }}>
        <span className="nfr-pill nfr-pill-warn">REPEATED PATTERN</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: t.coal, marginBottom: 10, letterSpacing: -0.2, fontFamily: f.serif }}>
        {a.title}
      </div>
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6, marginBottom: 18 }}>{a.body}</div>

      {a.arc && a.arc.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.inkSoft, marginBottom: 10 }}>
            {(a.arcMetric ?? "TREND").toUpperCase()} ACROSS SESSIONS
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${a.arc.length}, 1fr)`,
              gap: 10, alignItems: "end", height: 110,
            }}
          >
            {a.arc.map((p, i) => {
              const max = Math.max(...a.arc!.map(x => x.score));
              const color = p.score < 35 ? t.error : p.score > 70 ? t.success : t.copper;
              const bg = p.score < 35 ? t.error100 : p.score > 70 ? t.success100 : "rgba(180,83,9,0.12)";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ fontSize: 11, fontFamily: f.mono, fontWeight: 700, color }}>
                    {p.score}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: `${(p.score / max) * 70 + 8}px`,
                      background: bg, border: `1px solid ${color}`,
                      borderRadius: "6px 6px 2px 2px",
                    }}
                  />
                  <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: f.mono, marginTop: 2 }}>
                    {p.label}
                  </div>
                  {p.highlight && (
                    <div style={{ fontSize: 9, color: t.inkFaint, fontStyle: "italic", textAlign: "center", lineHeight: 1.3 }}>
                      {p.highlight}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: 14, background: t.success100, borderRadius: 8, fontSize: 13, color: t.coal }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.success, marginBottom: 4 }}>
          THE FIX
        </div>
        {a.fix}
      </div>
    </div>
  );
}

function DrillPlanPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.drills || outcome.drills.length === 0) return null;
  return (
    <div className="nfr-panel">
      <SectionHeader
        index="12"
        title="Drills for the next 5 days"
        subtitle="Each drill targets one specific habit you can fix this week."
      />
      <div className="nfr-grid-3up">
        {outcome.drills.map((d, i) => (
          <div
            key={i}
            style={{
              padding: 18, background: t.creamSoft, borderRadius: 10,
              border: `1px solid ${t.line}`,
              display: "flex", flexDirection: "column", gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.indigo, fontFamily: f.mono }}>
                DRILL {i + 1}
              </div>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
                {d.effort}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.coal, lineHeight: 1.3, fontFamily: f.serif }}>
              {d.title}
            </div>
            <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5, flex: 1 }}>{d.goal}</div>
            <button className="nfr-btn-primary" style={{ marginTop: 4, width: "100%" }}>
              Start drill →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Top-level component ────────────────────────────────────── */

export function NegotiationFullReport({
  outcome, role, company, questions, daysUntilInterview, priorSessionCount,
}: Props) {
  const offers = outcome.offers ?? [];
  const finalTotal = outcome.finalTotal ?? offers[offers.length - 1]?.total ?? null;

  return (
    <section
      aria-labelledby="ir-section-negotiation"
      style={{
        background: t.white, border: `1px solid ${t.line}`, borderRadius: 16,
        padding: "28px clamp(16px, 4vw, 32px)", boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "inline-block", padding: "3px 10px",
            background: t.copperSoft, color: t.copper,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
            borderRadius: 6, textTransform: "uppercase", fontFamily: f.mono,
          }}
        >
          Salary Negotiation · Full Report
        </div>
        <h2
          id="ir-section-negotiation"
          style={{ fontFamily: f.serif, fontSize: 26, margin: "10px 0 6px", color: t.coal, letterSpacing: -0.4 }}
        >
          The full breakdown of your negotiation
        </h2>
        <div style={{ fontSize: 13, color: t.inkSoft, marginBottom: 16, maxWidth: 720 }}>
          Each panel below turns one negotiation skill into something you can act on — not a score.
        </div>
        <StartHereHint outcome={outcome} daysUntilInterview={daysUntilInterview} />
      </div>

      {/* TL;DR — single-glance summary */}
      <TLDRHero outcome={outcome} role={role} company={company} />

      {/* PART 1 — DIAGNOSIS · indigo (analytical / cool tone) */}
      <SectionBand
        label="Part 1 of 4"
        title="What happened in this call"
        subtitle="Every moment that mattered — what you said, what you missed, what it cost."
        accent={t.indigo}
        bg={t.indigo100}
      />

      {/* Offer trajectory pill row — preserved from legacy section */}
      {offers.length > 0 && <OfferTrajectory outcome={outcome} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <PhaseLadderPanel outcome={outcome} />
        <div className="nfr-grid-2up">
          <ConcessionAnalysisPanel outcome={outcome} />
          <AnchorBracketPanel outcome={outcome} />
        </div>
        {(outcome.verbalHabits || outcome.silenceMoments) && (
          <div className="nfr-grid-2up">
            <VerbalHabitsPanel outcome={outcome} />
            <SilenceMapPanel outcome={outcome} />
          </div>
        )}
      </div>

      {/* PART 2 — ACTION */}
      <SectionBand
        label="Part 2 of 4"
        title="What to do before your real round"
        subtitle="A draft email you can send, the questions to ask next time, and the things to prepare."
        accent={t.copper}
        bg="rgba(180,83,9,0.08)"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <UnaskedLeversPanel outcome={outcome} />
        <CounterOfferLetterPanel outcome={outcome} role={role} company={company} />
      </div>

      {/* PART 3 — COHORT & MATH · warning gold (money / market value framing) */}
      {(typeof outcome.percentileWithinBand === "number" ||
        finalTotal !== null ||
        (outcome.counterpartyFacts && outcome.counterpartyFacts.length > 0)) && (
        <>
          <SectionBand
            label="Part 3 of 4"
            title="What this offer is worth in rupees"
            subtitle="Where your offer sits vs others — and what accepting really costs after tax."
            accent={t.warning}
            bg={t.warning100}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <CohortPlacementPanel outcome={outcome} />
            <div className="nfr-grid-2up">
              <NPVMathPanel outcome={outcome} />
              <CounterpartyPanel outcome={outcome} />
            </div>
          </div>
        </>
      )}

      {/* PART 4 — SKILL ARC · indigoDeep (introspective; distinct from Part 1 indigo) */}
      {(outcome.archetype || (priorSessionCount !== undefined && priorSessionCount < 2) || (outcome.drills && outcome.drills.length > 0)) && (
        <>
          <SectionBand
            label="Part 4 of 4"
            title="Your pattern across sessions"
            subtitle="What you keep doing right (and wrong), and the drills to break the pattern."
            accent={t.indigoDeep}
            bg={t.indigo100}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <ArchetypePanel outcome={outcome} priorSessionCount={priorSessionCount} />
            <DrillPlanPanel outcome={outcome} />
          </div>
        </>
      )}

      {/* Transcript export — preserved from legacy section */}
      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: "pointer", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
          Conversation transcript — copy for your records
        </summary>
        <pre
          style={{
            marginTop: 10, padding: 14, borderRadius: 10,
            background: t.cream, border: `1px solid ${t.line}`,
            fontFamily: f.mono, fontSize: 11, lineHeight: 1.55,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            color: t.coal, overflow: "auto", maxWidth: "100%", maxHeight: 360,
          }}
        >
          {(() => {
            const lines: string[] = [
              `Salary negotiation — ${role} at ${company}`,
              `Outcome: ${
                outcome.outcome === "accepted" ? `Accepted at ₹${finalTotal} LPA` :
                outcome.outcome === "walked_away" ? "Walked away" :
                "No agreement"
              }`,
              "",
            ];
            questions.forEach((q, i) => {
              lines.push(`— Turn ${i + 1} —`);
              if (q.text) lines.push(`AI: ${q.text}`);
              const answerText = (q.answer || []).map(s => s.text).join(" ").trim();
              if (answerText) lines.push(`You: ${answerText}`);
              lines.push("");
            });
            return lines.join("\n");
          })()}
        </pre>
      </details>
    </section>
  );
}

/* ─── Legacy offer trajectory pill row ─────────────────────────
   Preserved from the original NegotiationOutcomeSection — still
   the single most legible visualisation of the call's actual
   movement. Lives at the top of Part 1 to anchor the rest of
   the breakdown. */
function OfferTrajectory({ outcome }: { outcome: NegotiationOutcome }) {
  const offers = outcome.offers ?? [];
  if (offers.length === 0) return null;
  const initial = offers[0].total;
  const final = outcome.finalTotal !== null && outcome.finalTotal > initial
    ? Math.round((outcome.finalTotal - initial) * 10) / 10
    : null;
  return (
    <div
      style={{
        background: t.white, border: `1px solid ${t.line}`,
        borderRadius: 14, padding: 22, marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: t.inkSoft, textTransform: "uppercase", marginBottom: 10 }}>
        Offer progression
      </div>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {offers.map((o, i) => (
          <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontFamily: f.serif, fontSize: 16, fontWeight: 600, color: t.coal,
                padding: "6px 12px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 999,
              }}
            >
              ₹{o.total} LPA
            </span>
            {i < offers.length - 1 && <span aria-hidden style={{ color: t.inkFaint, fontSize: 14 }}>→</span>}
          </li>
        ))}
        {outcome.candidateAsk !== null && (
          <>
            <span aria-hidden style={{ color: t.inkFaint, fontSize: 14, marginLeft: 4 }}>•</span>
            <li style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>
                your ask
              </span>
              <span
                style={{
                  display: "inline-flex", alignItems: "center",
                  fontFamily: f.serif, fontSize: 16, fontWeight: 600, color: t.copper,
                  padding: "6px 12px", background: t.copperSoft, border: "1px solid rgba(180,83,9,0.20)", borderRadius: 999,
                }}
              >
                ₹{outcome.candidateAsk} LPA
              </span>
            </li>
          </>
        )}
      </ol>
      {final !== null && (
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 10 }}>
          You moved the offer up by <strong style={{ color: t.coal }}>₹{final} LPA</strong> from the opening number.
          {typeof outcome.percentileWithinBand === "number" && (
            <> {" "}You closed <strong style={{ color: t.coal }}>{outcome.percentileWithinBand}%</strong> of the gap to your stated ask.</>
          )}
        </div>
      )}
    </div>
  );
}
