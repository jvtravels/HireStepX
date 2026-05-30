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

  let verdict: string;
  if (outcome.outcome === "accepted" && delta !== null && delta > 0) {
    verdict = `You moved the offer from ₹${opening} LPA up to ₹${closing} LPA, ₹${delta * 4}L extra over four years before tax.${askGap !== null ? ` You closed ${askGap}% of the gap to your stated ask.` : ""}`;
  } else if (outcome.outcome === "accepted" && delta === 0) {
    verdict = `You accepted at ₹${closing} LPA, the same as their first offer. No counter, no movement. Comparable candidates typically push 15 to 35% above the opening number.`;
  } else if (outcome.outcome === "walked_away") {
    verdict = `You walked away from a ₹${closing} LPA offer for ${role} at ${company}. The panels below help you decide whether the next round of this role (or a similar one) is worth a counter-anchor.`;
  } else {
    verdict = `You explored ${offers.length} offer point${offers.length !== 1 ? "s" : ""} but didn't close. Part 2 has the email draft you can send to keep the conversation alive.`;
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
    } else {
      stats.push({
        label: "Money you left on the table",
        value: "—",
        hint: "you accepted at the first number; no counter named",
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
  stats.push({
    label: "How far you got",
    value: `${phaseCount} of ${TOTAL_PHASES} stages`,
    hint:
      phaseCount === TOTAL_PHASES ? "you closed the deal" :
      phaseCount >= 4 ? "one short of the close" :
      phaseCount >= 2 ? "made it past the counter" :
      phaseCount === 1 ? "you named a counter. Part 2 below shows the next move" :
      "you didn't push past the first offer. Part 2 has the email draft",
    tone: phaseCount >= 4 ? "good" : phaseCount >= 2 ? "warn" : "bad",
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
