import { derivePhases, type NegotiationOutcome } from "../derivations";

export function TLDRHero({
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
  const TOTAL_PHASES = 5;

  /* A counter was named iff the candidate stated an ask — the SAME single
   * source the stage tracker uses (derivePhases → reachedCounter =
   * candidateAsk !== null). Two conflations previously broke this:
   *   1. "The offer didn't move" (delta === 0) is NOT "no counter": the
   *      recruiter can hold firm against a real counter.
   *   2. "No opening was tabled" (opening === null, recruiter never named a
   *      number) is NOT "no counter": the candidate can name ₹X into silence.
   * The prior `&& opening !== null && candidateAsk > opening` guard folded
   * both in, so a live run where the recruiter never verbalized an offer
   * (offers empty → opening null) printed "no counter on the table / never
   * naming a number" beside the report's own "named a counter ✓ Asked ₹50",
   * "1 of 5 stages — you named a counter", and "Numbers stated 100%". Key it
   * on candidateAsk alone; branches that compare to the opening already guard
   * `opening !== null` (verdict) or `delta !== null` (stats) themselves. */
  const counterNamed = outcome.candidateAsk !== null;

  let verdict: string;
  if (outcome.outcome === "accepted" && delta !== null && delta > 0) {
    verdict = `You moved the offer from ₹${opening} LPA up to ₹${closing} LPA, ₹${delta * 4}L extra over four years before tax.${askGap !== null ? ` You closed ${askGap}% of the gap to your stated ask.` : ""}`;
  } else if (outcome.outcome === "accepted" && delta === 0) {
    verdict = counterNamed
      ? `You countered at ₹${outcome.candidateAsk} LPA but accepted their opening ₹${closing} LPA — they held firm and you took it without further movement. Comparable candidates keep pushing 15 to 35% above the opening before accepting.`
      : `You accepted at ₹${closing} LPA, the same as their first offer. No counter, no movement. Comparable candidates typically push 15 to 35% above the opening number.`;
  } else if (outcome.outcome === "accepted") {
    /* R-1 residual (2026-07-13, live staging — report 03bbe2b9, Flipkart EM):
     * an ACCEPTED deal whose offer numbers weren't captured (legacy row with no
     * persisted trajectory, transcript the offer-regex missed → offers empty,
     * finalTotal null → delta null) matched neither `delta > 0` nor `delta === 0`
     * and fell through to the no-agreement `else`, printing "No deal closed …
     * ₹0 gained … walking away" beside this same component's stage tracker
     * ("you closed the deal") and N1's "Outcome: Accepted". The close is
     * authoritative from `outcome.outcome`; the no-deal branch must be reachable
     * ONLY when the deal did not close. State the accept plainly and DON'T
     * fabricate a delta we can't compute. */
    verdict = counterNamed
      ? `You accepted the ${role} offer at ${company} — you'd countered at ₹${outcome.candidateAsk} LPA. The exact offer movement wasn't captured this session, so the panels below work from the kernel's own record of where you landed.`
      : `You accepted the ${role} offer at ${company}. The exact offer movement wasn't captured this session, so the panels below work from the kernel's own record of where you landed.`;
  } else if (outcome.outcome === "walked_away") {
    /* `closing` can be null when the candidate walked before any offer
     * number landed — never interpolate it raw (that renders "₹null LPA"
     * in the user's face). Name the figure only when we actually have it. */
    verdict = closing !== null
      ? `You walked away from a ₹${closing} LPA offer for ${role} at ${company}. The panels below help you decide whether the next round of this role (or a similar one) is worth a counter-anchor.`
      : `You walked away from the ${role} offer at ${company} before a firm number landed. The panels below help you decide whether the next round of this role (or a similar one) is worth a counter-anchor.`;
  } else {
    /* R-10 (2026-07-10, live staging — Senior Product Designer @ Lollypop
     * Design Studio): the no-agreement branch read like a win ("You explored N
     * offer points") when the candidate walked from the table with ₹0 locked
     * in. Name the no-deal plainly — nothing was secured — then point at the
     * recovery play. Distinguish "countered but it never closed" from "never
     * even named a number", since the coaching differs. */
    verdict = counterNamed
      ? `No deal closed. You countered at ₹${outcome.candidateAsk} LPA${opening !== null ? ` against their ₹${opening} LPA opening` : ""}, but the conversation ended with nothing locked in — you're walking away with ₹0 gained. Part 2 has the email draft to reopen it before the offer lapses.`
      : `No deal closed, and no counter on the table — you explored ${offers.length} offer point${offers.length !== 1 ? "s" : ""} but ended with ₹0 gained. The single biggest miss was never naming a number. Part 2 has the email draft to restart the conversation.`;
  }

  type StatTone = "good" | "bad" | "warn" | "neutral";
  const stats: Array<{ label: string; value: string; hint?: string; tone: StatTone }> = [];

  const isSparseFirstSession =
    delta === 0 &&
    outcome.candidateAsk === null &&
    phaseCount <= 1 &&
    typeof outcome.gapClosurePct !== "number";

  if (isSparseFirstSession) {
    stats.push({
      label: "Where you are now",
      value: "Session 1",
      hint: "first negotiation. Part 2 below has the email draft to start from",
      tone: "neutral",
    });
  } else if (delta !== null) {
    if (delta > 0) {
      stats.push({
        label: "What you won",
        value: `+₹${delta * 4}L`,
        hint: "extra rupees over 4 years, before tax",
        tone: "good",
      });
    } else if (delta < 0) {
      stats.push({
        label: "What it cost you",
        value: `−₹${Math.abs(delta * 4)}L`,
        hint: "rupees lost over 4 years, before tax",
        tone: "bad",
      });
    } else if (outcome.outcome === "walked_away") {
      /* L-1 (2026-07-10, live staging — walk-away report cc0a7469): when the
       * offer never moved (delta===0) this branch printed "you countered at ₹X
       * but ACCEPTED THEIR OPENING" — on a WALKED-AWAY outcome, three lines
       * under a "You walked away" verdict. The delta===0 math ("offer didn't
       * move") is true, but "accepted" is categorically false: the candidate
       * rejected the offer, they did not take it. Same class as the PRI-63
       * "closed the deal on walk-away" fix — gate the accept phrasing on the
       * actual outcome. On a walk-away the whole offer was left behind. */
      stats.push({
        label: "What you walked from",
        value: opening !== null ? `₹${opening} LPA` : "—",
        hint: counterNamed
          ? `you countered at ₹${outcome.candidateAsk} but the offer never moved, and you walked`
          : "you walked from their opening without naming a counter",
        tone: "bad",
      });
    } else if (outcome.outcome === "accepted") {
      stats.push({
        label: "Money you left on the table",
        value: "—",
        hint: counterNamed
          ? `you countered at ₹${outcome.candidateAsk} but accepted their opening; the recruiter didn't move`
          : "you accepted at the first number; no counter named",
        tone: "bad",
      });
    } else {
      /* B (2026-07-11, live staging — Senior Product Designer @ Flipkart,
       * session 734493c9): a NO-AGREEMENT run with a flat offer (delta===0,
       * not walked_away) fell into the accept branch and printed "you
       * countered at ₹50 but ACCEPTED THEIR OPENING; the recruiter didn't
       * move" — directly beside the same report's Outcome "In progress · No
       * deal closed · ₹0 gained". The delta===0 math is true, but "accepted"
       * is categorically false: nothing closed. Same class as the walked_away
       * gate above (L-1) and the verdict's own no_agreement branch — gate the
       * accept phrasing on the actual outcome; on no-agreement the offer
       * simply never moved and no deal closed. */
      stats.push({
        label: "Money you left on the table",
        value: "—",
        hint: counterNamed
          ? `you countered at ₹${outcome.candidateAsk} but the offer never moved and no deal closed`
          : "the offer never moved and no deal closed; no counter named",
        tone: "bad",
      });
    }
  }
  if (typeof outcome.gapClosurePct === "number") {
    /* Honest framing (2026-05-30): this is intra-session gap closure
     * between the first offer and the candidate's stated ask — NOT a
     * cohort percentile. Previously surfaced as "How you ranked vs
     * others who got offers in this band", which fabricated a cohort
     * comparison we don't have data for. */
    const p = outcome.gapClosurePct;
    stats.push({
      label: "How much of the gap you closed",
      value: `${p}%`,
      hint: "from the first offer to your stated ask",
      tone: p >= 70 ? "good" : p >= 30 ? "warn" : "bad",
    });
  }
  /* The close (stage 5) is reached whenever the candidate accepted or walked
   * away — the same source derivePhases uses. So "one short of the close" is
   * only honest when the deal did NOT close; if it closed with < 5 stages, the
   * skipped stage is a MIDDLE one (e.g. handling pushback), not the close. The
   * prior copy printed "one short of the close" on a closed-but-incomplete run,
   * contradicting the stage tracker showing the close stage REACHED. */
  const dealClosed = outcome.outcome === "accepted";
  const walkedAway = outcome.outcome === "walked_away";
  const skipped = TOTAL_PHASES - phaseCount;
  stats.push({
    label: "How far you got",
    value: `${phaseCount} of ${TOTAL_PHASES} stages`,
    /* PRI-63 (2026-07-06, live staging) — stage 5 (the close) is reached
     * on EITHER accept OR walk-away (same source derivePhases uses), so a
     * walk-away that traversed all five stages hit phaseCount === TOTAL and
     * printed "you closed the deal — every stage reached" while the outcome
     * record two lines up said "You walked away" (observed verbatim on a
     * live Razorpay walk-away). Gate every "closed the deal" phrasing on the
     * actual outcome; reaching the close STAGE is not closing the DEAL. */
    hint:
      dealClosed
        ? phaseCount === TOTAL_PHASES
          ? "you closed the deal — every stage reached"
          : `you closed the deal, but skipped ${skipped} stage${skipped === 1 ? "" : "s"} along the way`
        : walkedAway
          ? phaseCount === TOTAL_PHASES
            ? "you reached every stage, then walked away. Part 2 has the next-round play"
            : "you walked away. Part 2 has the next-round play"
          : phaseCount >= 4 ? "one short of the close" :
            phaseCount >= 2 ? "made it past the counter" :
            phaseCount === 1 ? "you named a counter. Part 2 below shows the next move" :
            "you didn't push past the first offer. Part 2 has the email draft",
    tone: dealClosed ? "good" : walkedAway ? "warn" : phaseCount >= 4 ? "good" : phaseCount >= 2 ? "warn" : "bad",
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

  return (
    <section className="nfr-tldr" aria-labelledby="nfr-tldr-eyebrow">
      <div id="nfr-tldr-eyebrow" className="nfr-tldr-eyebrow">
        The 30-second read
      </div>
      <p className="nfr-tldr-verdict">{verdict}</p>
      {stats.length > 0 && (
        <div className="nfr-tldr-evidence">
          {stats.map((s, i) => (
            <div key={i} className="nfr-tldr-evidence-row">
              <div className="nfr-tldr-evidence-label">{s.label}</div>
              <div className={`nfr-tldr-evidence-value nfr-tldr-tone-${s.tone}`}>
                {s.value}
              </div>
              {s.hint && <div className="nfr-tldr-evidence-hint">{s.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
