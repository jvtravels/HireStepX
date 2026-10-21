import type { NegotiationOutcome } from "../derivations";
import { atCompany } from "../roleLabel";
import type React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/* Bottom CTA — closes the report with a clear next move. The previous
   version of the report ended on the transcript collapsible. Users
   finished scrolling and had nowhere to go. */
export function NextRoundCTA({
  outcome, role, company, practiceHref,
}: { outcome: NegotiationOutcome; role: string; company: string; practiceHref?: string }) {
  let title: string;
  let body: string;
  let primaryLabel: string;
  if (outcome.outcome === "accepted") {
    title = "Take this into your next negotiation";
    body = `You closed the deal on ${role}${atCompany(company)}. Run a session for the next role you're targeting, and practise the moves you missed before they cost you on the real one.`;
    primaryLabel = "Practise next round";
  } else if (outcome.outcome === "walked_away") {
    title = "Run the next round";
    body = "You walked away. The right call needs a clear walk-away point. Practise a session for the same band with a stronger anchor + BATNA prepared.";
    primaryLabel = "Run a stronger session";
  } else if (outcome.candidateAsk === null) {
    title = "Practise naming a counter";
    body = "You didn't name a counter-anchor in this session. Run the same scenario again, this time walking in with a specific number + bracket prepared.";
    primaryLabel = "Practise the counter";
  } else {
    title = "Push past where you stalled";
    body = `You named ₹${outcome.candidateAsk} LPA but didn't close. Run another round and practise the lever-exploration phase where this session ended.`;
    primaryLabel = "Practise the next phase";
  }
  return (
    <div className="nfr-rise mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-hx-line pt-6" style={{ "--i": 7 } as React.CSSProperties}>
      <div className="min-w-[240px] flex-1">
        <h3 className="m-0 text-[16px] font-semibold tracking-[-0.01em] text-hx-coal">{title}</h3>
        <p className="m-0 mt-1 max-w-[65ch] text-[13px] leading-relaxed text-hx-ink-soft">{body}</p>
      </div>
      <Button asChild size="lg" className="shrink-0">
        <Link href={practiceHref ?? "/session/new"}>{primaryLabel}</Link>
      </Button>
    </div>
  );
}
