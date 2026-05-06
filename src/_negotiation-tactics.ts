/* HireStepX — Negotiation tactic recognition
 *
 * Pure function: scan the AI hiring manager's spoken text for known
 * negotiation tactics, return the first hit (most-specific first) so
 * the candidate gets a "the AI just used X — here's what that means"
 * coaching note. Drives the salary-neg coaching layer in
 * Interview.tsx (via a CanvasHintBubble) and survives in the report
 * for review.
 *
 * The tactics list is short on purpose. Detecting too many produces
 * coaching noise; detecting the canonical 6-7 maps cleanly to the
 * skills the candidate is being graded on.
 *
 * Tested in src/__tests__/negotiationTactics.test.ts.
 */

export interface NegotiationTactic {
  /** Internal id, also used as the dictionary key. */
  id:
    | "anchor"
    | "flinch"
    | "deadline"
    | "fake_empathy"
    | "split_authority"
    | "package_redirect"
    | "current_ctc_probe"
    | "loss_framing";
  /** Human-readable label shown in the coaching note. */
  label: string;
  /** One-sentence "what this tactic means + what to do" coaching. */
  coaching: string;
}

const TACTICS: Array<NegotiationTactic & { pattern: RegExp }> = [
  {
    id: "current_ctc_probe",
    label: "Current-CTC probe",
    coaching: "They're trying to anchor on what you already make. Deflect — focus on the value of this role and the market range, not your current number.",
    pattern: /\b(?:what(?:'?s|\s+is)\s+your\s+current|your\s+current\s+(?:ctc|salary|package|comp(?:ensation)?)|how\s+much\s+(?:are|do)\s+you\s+(?:make|earn|get|making|earning|getting)|what\s+(?:are|do)\s+you\s+(?:make|earn|get|making|earning|getting)|present\s+(?:ctc|salary|package))\b/i,
  },
  {
    id: "deadline",
    label: "Deadline / urgency",
    coaching: "Manufactured urgency — pause. Real deadlines are firm; manufactured ones soften when you ask. \"What happens if I need a couple more days?\"",
    pattern: /\b(?:by\s+(?:end\s+of\s+(?:day|week)|tomorrow|friday|monday|eod|cob)|need\s+to\s+(?:close|know)\s+(?:today|tonight|this\s+week|by)|expire(?:s)?\s+(?:end|by)|hold(?:ing)?\s+(?:headcount|the\s+role)|last\s+open\s+slot|approval\s+expires|window\s+closes|other\s+strong\s+candidate)\b/i,
  },
  {
    id: "flinch",
    label: "Flinch / band-ceiling",
    coaching: "They're saying \"that's the top of my band\" to anchor you down. It rarely is — push once: \"What would it take to go higher?\" or trade.",
    pattern: /\b(?:top\s+of\s+(?:my|our|the)\s+(?:band|range|approval|authority)|absolute\s+(?:top|max|ceiling|best)|that(?:'?s|\s+is)\s+(?:my|our)\s+(?:limit|ceiling|max|cap)|can(?:not|'?t)\s+go\s+(?:any\s+)?higher|that(?:'?s|\s+is)\s+(?:where|all)\s+I\s+(?:can|could)\s+land|outside\s+(?:our|the)\s+band)\b/i,
  },
  {
    id: "split_authority",
    label: "Split authority",
    coaching: "\"Let me check with leadership\" creates artificial scarcity. Use the wait — restate your number cleanly, don't drop it before they come back.",
    pattern: /\b(?:let\s+me\s+(?:check|run\s+this|talk)\s+(?:with|to)\s+(?:leadership|hr|finance|comp(?:ensation)?\s+committee|my\s+manager|the\s+team)|need\s+to\s+(?:check|run\s+by|get\s+approval\s+from)|go\s+back\s+to\s+(?:leadership|comp|hr)|see\s+if\s+I\s+can\s+pull\s+in)\b/i,
  },
  {
    id: "fake_empathy",
    label: "Fake-empathy framing",
    coaching: "\"I genuinely want this to work\" is a closing tactic, not a concession. If they mean it, they'll show it with numbers — ask for them.",
    pattern: /\b(?:i\s+(?:genuinely|really)\s+(?:want|believe)|i\s+want\s+to\s+make\s+this\s+work|i'?m\s+on\s+your\s+side|we\s+both\s+want|trust\s+me\s+(?:on|when)|we'?re\s+(?:trying|trying\s+hard)\s+to|hand(?:s)?\s+(?:are\s+)?tied)\b/i,
  },
  {
    id: "package_redirect",
    label: "Package redirect (away from base)",
    coaching: "They can't move base, so they're pushing you toward variable / bonus / equity. Variable isn't guaranteed cash — value it conservatively.",
    pattern: /\b(?:beyond\s+(?:the\s+)?base|let(?:'?s| us)?\s+(?:talk\s+about|focus\s+on|look\s+at)\s+(?:the\s+)?(?:full\s+package|total\s+comp|variable|equity|bonus|esop)|total\s+package\s+value|the\s+real\s+value|on\s+top\s+of\s+(?:the\s+)?base|in\s+addition\s+to\s+(?:the\s+)?base)\b/i,
  },
  {
    id: "loss_framing",
    label: "Loss framing",
    coaching: "Framing the offer as something to lose, not gain. Stay outcome-focused: walk away from the framing, return to numbers.",
    pattern: /\b(?:you'?d\s+be\s+walking\s+away\s+from|you\s+might\s+regret|don'?t\s+throw\s+(?:this|the\s+offer)\s+away|hard\s+to\s+come\s+back\s+from|opportunity\s+cost|miss(?:ing)?\s+out\s+on)\b/i,
  },
  {
    id: "anchor",
    label: "Anchor / market-citation",
    coaching: "They're citing market data to justify their number. Ask for the source — \"which benchmark are you using?\" — and counter with yours (Levels.fyi, AmbitionBox).",
    pattern: /\b(?:our\s+(?:band|range)\s+for\s+this\s+(?:role|level)|market\s+(?:rate|data|benchmark)\s+for\s+this|benchmark(?:ed|ing)?\s+(?:against|to)|levels\.fyi|ambitionbox|glassdoor\s+says|industry\s+(?:standard|average)|we\s+(?:just\s+)?hired\s+(?:someone|a\s+designer|an\s+engineer)\s+at|last\s+(?:three|few)\s+(?:hires|offers)\s+at\s+this)\b/i,
  },
];

export function detectNegotiationTactic(aiText: string): NegotiationTactic | null {
  if (!aiText) return null;
  for (const t of TACTICS) {
    if (t.pattern.test(aiText)) {
      return { id: t.id, label: t.label, coaching: t.coaching };
    }
  }
  return null;
}
