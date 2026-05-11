/* HireStepX — Negotiation tactic recognition
 *
 * Pure function: scan the AI hiring manager's spoken text for known
 * negotiation tactics, return the first hit (most-specific first) so
 * the candidate gets a "the AI just used X — here's what that means"
 * coaching note + verbatim counter-scripts. Drives the salary-neg
 * coaching layer in Interview.tsx (via a CanvasHintBubble) and
 * survives in the report for review.
 *
 * Each tactic ships with:
 *   - one-line `coaching` (the WHY)
 *   - 3-4 `counterScripts` (the verbatim WHAT-TO-SAY) so the candidate
 *     has a ready-made line they can deliver, not generic advice.
 *
 * Tactic list focuses on what Indian recruiters actually use — current-CTC
 * probes, level caps, signing-bonus clawbacks, notice-period pressure,
 * equity-dazzle. Detecting too many produces coaching noise; detecting
 * the canonical 12-13 covers ~90% of real Indian salary-neg conversations.
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
    | "loss_framing"
    | "level_cap"
    | "equity_dazzle"
    | "signing_clawback"
    | "notice_pressure"
    | "competing_offer_skepticism";
  /** Human-readable label shown in the coaching note. */
  label: string;
  /** One-sentence "what this tactic means + what to do" coaching. */
  coaching: string;
  /** Verbatim counter-scripts the candidate can deliver. Keep each
   *  ≤ 25 words so they sound natural spoken aloud. */
  counterScripts: string[];
}

const TACTICS: Array<NegotiationTactic & { pattern: RegExp }> = [
  {
    id: "current_ctc_probe",
    label: "Current-CTC probe",
    coaching: "They're trying to anchor on what you already make. Deflect — focus on the value of this role and the market range, not your current number.",
    counterScripts: [
      "I'd rather anchor on what this role is worth in the market than what I'm paid today — current CTC reflects past decisions, not current scope.",
      "Happy to share expectations: based on the role + my experience, I'm targeting ₹X-Y. Where does your band sit?",
      "I'd prefer to keep current comp out of this — it's confidential under my offer letter. Can you share your range first?",
      "Let's talk about expected, not current. For this role and level I'm looking at ₹X.",
    ],
    pattern: /\b(?:what(?:'?s|\s+is)\s+your\s+current|your\s+current\s+(?:ctc|salary|package|comp(?:ensation)?)|how\s+much\s+(?:are|do)\s+you\s+(?:make|earn|get|making|earning|getting)|what\s+(?:are|do)\s+you\s+(?:make|earn|get|making|earning|getting)|present\s+(?:ctc|salary|package))\b/i,
  },
  {
    id: "deadline",
    label: "Deadline / urgency",
    coaching: "Manufactured urgency — pause. Real deadlines are firm; manufactured ones soften when you ask. \"What happens if I need a couple more days?\"",
    counterScripts: [
      "I want to give this the consideration it deserves — what happens if I come back to you Monday instead?",
      "I'm closing two other processes this week. Can the offer hold until then so I can compare cleanly?",
      "I'd rather take 48 hours and say a confident yes than a rushed maybe. Is that workable on your side?",
      "What's actually driving the timeline? If it's headcount approval, I understand — if not, I'd like more time.",
    ],
    pattern: /\b(?:by\s+(?:end\s+of\s+(?:day|week)|tomorrow|friday|monday|eod|cob)|need\s+to\s+(?:close|know)\s+(?:today|tonight|this\s+week|by)|expire(?:s)?\s+(?:end|by)|hold(?:ing)?\s+(?:headcount|the\s+role)|last\s+open\s+slot|approval\s+expires|window\s+closes|other\s+strong\s+candidate)\b/i,
  },
  {
    id: "flinch",
    label: "Flinch / band-ceiling",
    coaching: "They're saying \"that's the top of my band\" to anchor you down. It rarely is — push once: \"What would it take to go higher?\" or trade.",
    counterScripts: [
      "What would it take to go higher? An additional interview round, a level-up justification, anything I can help with?",
      "If base is capped, can we move on signing bonus, equity refresh, or guaranteed first-year bonus instead?",
      "I hear you — and I'd hate for the band to be the reason this doesn't close. Can you escalate once for me?",
      "Levels.fyi has this role at ₹X median for similar TC at peer companies — happy to walk through if useful.",
    ],
    pattern: /\b(?:top\s+of\s+(?:my|our|the)\s+(?:band|range|approval|authority)|absolute\s+(?:top|max|ceiling|best)|that(?:'?s|\s+is)\s+(?:my|our)\s+(?:limit|ceiling|max|cap)|can(?:not|'?t)\s+go\s+(?:any\s+)?higher|that(?:'?s|\s+is)\s+(?:where|all)\s+I\s+(?:can|could)\s+land|outside\s+(?:our|the)\s+band)\b/i,
  },
  {
    id: "split_authority",
    label: "Split authority",
    coaching: "\"Let me check with leadership\" creates artificial scarcity. Use the wait — restate your number cleanly, don't drop it before they come back.",
    counterScripts: [
      "Sounds good — while you check, my ask is ₹X total. That's the number I'd like you to take in.",
      "Happy to wait. Can you let me know who's making the final call so I know what's possible?",
      "When you check, please flag that my expectation is firm at ₹X — and that I'd accept on the spot at that.",
      "Take the time you need. I'd rather not move my number until I hear what comes back.",
    ],
    pattern: /\b(?:let\s+me\s+(?:check|run\s+this|talk)\s+(?:with|to)\s+(?:leadership|hr|finance|comp(?:ensation)?\s+committee|my\s+manager|the\s+team)|need\s+to\s+(?:check|run\s+by|get\s+approval\s+from)|go\s+back\s+to\s+(?:leadership|comp|hr)|see\s+if\s+I\s+can\s+pull\s+in)\b/i,
  },
  {
    id: "fake_empathy",
    label: "Fake-empathy framing",
    coaching: "\"I genuinely want this to work\" is a closing tactic, not a concession. If they mean it, they'll show it with numbers — ask for them.",
    counterScripts: [
      "I appreciate that — and the way I'd know it's working is if the number lands at ₹X. Can we get there?",
      "I want this to work too. The cleanest path is closing the gap on base. What can you do?",
      "Thanks — let's make it real. Where can you actually move?",
      "I trust you mean that. Show me with a revised offer and I'll close today.",
    ],
    pattern: /\b(?:i\s+(?:genuinely|really)\s+(?:want|believe)|i\s+want\s+to\s+make\s+this\s+work|i'?m\s+on\s+your\s+side|we\s+both\s+want|trust\s+me\s+(?:on|when)|we'?re\s+(?:trying|trying\s+hard)\s+to|hand(?:s)?\s+(?:are\s+)?tied)\b/i,
  },
  {
    id: "package_redirect",
    label: "Package redirect (away from base)",
    coaching: "They can't move base, so they're pushing you toward variable / bonus / equity. Variable isn't guaranteed cash — value it conservatively.",
    counterScripts: [
      "Happy to value the full package — but base is what compounds. Can we move base by ₹X, then talk variable?",
      "I value variable at 50% of target until I see prior-year payouts. What was the actual payout last cycle?",
      "Equity is great upside, but my expenses are paid in cash. Where can we move on fixed?",
      "I'm open to creative structure. But let's land base first — variable and equity layered on top.",
    ],
    pattern: /\b(?:beyond\s+(?:the\s+)?base|let(?:'?s| us)?\s+(?:talk\s+about|focus\s+on|look\s+at)\s+(?:the\s+)?(?:full\s+package|total\s+comp|variable|equity|bonus|esop)|total\s+package\s+value|the\s+real\s+value|on\s+top\s+of\s+(?:the\s+)?base|in\s+addition\s+to\s+(?:the\s+)?base)\b/i,
  },
  {
    id: "loss_framing",
    label: "Loss framing",
    coaching: "Framing the offer as something to lose, not gain. Stay outcome-focused: walk away from the framing, return to numbers.",
    counterScripts: [
      "I'm choosing between options on the upside — not avoiding loss. What's the best you can do on base?",
      "I hear you — but the right offer makes this an easy yes. Where can you land?",
      "I'd hate to walk away too. Help me not have to — what's the actual ceiling?",
      "Let's keep this concrete: my number is ₹X. Can you meet it or not?",
    ],
    pattern: /\b(?:you'?d\s+be\s+walking\s+away\s+from|you\s+might\s+regret|don'?t\s+throw\s+(?:this|the\s+offer)\s+away|hard\s+to\s+come\s+back\s+from|opportunity\s+cost|miss(?:ing)?\s+out\s+on)\b/i,
  },
  {
    id: "anchor",
    label: "Anchor / market-citation",
    coaching: "They're citing market data to justify their number. Ask for the source — \"which benchmark are you using?\" — and counter with yours (Levels.fyi, AmbitionBox).",
    counterScripts: [
      "Which benchmark — Levels.fyi, AmbitionBox, internal comp survey? I'm seeing higher numbers on the public sources for this role.",
      "Could be a sample-size issue. Levels.fyi median for this role+level in India is ₹X. Want to compare data?",
      "Recent hires are useful, but offers shift quarterly. The current 2026 market for this role is ₹X-Y on Levels.fyi.",
      "Fair — and my counter-anchor is ₹X based on three current offers I'm weighing. Where can we meet?",
    ],
    pattern: /\b(?:our\s+(?:band|range)\s+for\s+this\s+(?:role|level)|market\s+(?:rate|data|benchmark)\s+for\s+this|benchmark(?:ed|ing)?\s+(?:against|to)|levels\.fyi|ambitionbox|glassdoor\s+says|industry\s+(?:standard|average)|we\s+(?:just\s+)?hired\s+(?:someone|a\s+designer|an\s+engineer)\s+at|last\s+(?:three|few)\s+(?:hires|offers)\s+at\s+this)\b/i,
  },
  {
    id: "level_cap",
    label: "Level-cap excuse",
    coaching: "They're using the level system to justify a low offer. Levels are negotiable — push for level-up evaluation, not just band-up within the level.",
    counterScripts: [
      "Can we revisit the level? My scope and prior tenure suggest L+1 — happy to walk through if useful.",
      "If the level is fixed, can we discuss accelerated review at 6 months instead of 12?",
      "I understand the policy. Is there a level-exception process for strong external hires?",
      "What does level promotion typically look like here, and what's the timeline if I outperform?",
    ],
    pattern: /\b(?:level\s+(?:cap|ceiling)|don'?t\s+(?:hire|bring\s+in)\s+(?:above|at)\s+(?:l|level)\s*\d|external\s+hire\s+cap|junior\s+to\s+(?:the\s+)?role|new\s+to\s+the\s+team|need\s+to\s+(?:earn|prove)\s+(?:the\s+)?next\s+level)\b/i,
  },
  {
    id: "equity_dazzle",
    label: "Equity dazzle / IPO upside",
    coaching: "\"If we IPO, your equity is worth ₹Cr\" — pre-IPO ESOPs in India have ~10% historical hit rate. Discount aggressively, ask about buybacks not IPO.",
    counterScripts: [
      "Exciting upside — but I value pre-IPO ESOPs at the last buyback price, not target valuation. When was your last buyback and at what price?",
      "What's the strike price, fair-market value at grant, and tax treatment on exercise? Those drive actual take-home.",
      "Happy to take equity — but at FMV, not promised IPO upside. Can I see the cap table summary or a recent valuation letter?",
      "I'd rather take 5% less in equity face-value and 5% more in cash. ESOPs vest, salaries pay rent.",
    ],
    pattern: /\b(?:if\s+we\s+ipo|when\s+we\s+ipo|exit\s+(?:scenario|event)|dilut(?:ion|ed)|target\s+valuation|implied\s+valuation|upside|wealth\s+creation|life-changing|series\s+[a-h]\s+valuation|next\s+round)\b/i,
  },
  {
    id: "signing_clawback",
    label: "Signing-bonus clawback",
    coaching: "A signing bonus with 2-3 year clawback is debt, not income. Negotiate the clawback duration down or the trigger conditions.",
    counterScripts: [
      "Happy to take the signing bonus — can we shorten the clawback to 12 months instead of 24?",
      "Can you carve out the clawback for involuntary termination or role change? Resignation-only is fairer.",
      "I'd rather take a smaller signing bonus with no clawback than a large one with a 2-year leash.",
      "What does the clawback document look like? I'd like legal review before agreeing.",
    ],
    pattern: /\b(?:signing\s+(?:bonus|amount)\s+with|joining\s+bonus.*claw|claw[\s-]?back|recoverable|return\s+(?:if|on\s+exit)|prorated\s+(?:if|on\s+exit)|tied\s+to\s+(?:tenure|2\s+year|3\s+year))\b/i,
  },
  {
    id: "notice_pressure",
    label: "Notice-period pressure",
    coaching: "\"Can you join in 30 days?\" creates urgency that benefits them, not you. Your notice period is leverage — use it to negotiate joining bonus or relax start date.",
    counterScripts: [
      "My notice is 60 days. Buyout is possible if you cover it — what's typical for this role?",
      "I can do early release if you can adjust the joining bonus to cover the recovery from my current employer.",
      "Standard notice for me is X days. Pushing it shorter is possible but it'll cost me — how do we make that whole?",
      "Can we lock the offer with a flexible start date? I'd rather not rush an exit and burn the bridge.",
    ],
    pattern: /\b(?:join\s+(?:in|by|within)\s+(?:30|45|14|two|three)\s+(?:days|weeks)|early\s+(?:release|joining|start)|how\s+(?:soon|quickly)\s+can\s+you\s+(?:join|start)|notice\s+(?:period|buyout)|short(?:en)?\s+(?:your\s+)?notice|negotiate\s+with\s+(?:current|your)\s+employer)\b/i,
  },
  {
    id: "competing_offer_skepticism",
    label: "Competing-offer skepticism",
    coaching: "They're testing whether your competing offer is real. Don't lie — but don't show the letter either. Competing offers are leverage, not evidence.",
    counterScripts: [
      "I'd rather not share offer letters across companies — but the number I quoted is verifiable. Want me to put my counter in writing?",
      "Yes it's a real offer. What I can confirm: company X, similar role, ₹X total. I'm not comfortable sharing the document.",
      "I get the skepticism — happy to put my final ask in writing once we close, so there's no ambiguity.",
      "Can we focus on what makes this offer compelling vs the others, rather than authenticating the others?",
    ],
    pattern: /\b(?:show\s+(?:me\s+)?(?:the\s+)?(?:offer|letter)|(?:do\s+you\s+have|is\s+it)\s+(?:in\s+)?writing|verify(?:\s+the)?\s+(?:offer|claim)|(?:hard|difficult)\s+to\s+match\s+(?:without|unless)|prove\s+(?:the\s+)?(?:offer|number)|competing\s+offer\s+real)\b/i,
  },
];

export function detectNegotiationTactic(aiText: string): NegotiationTactic | null {
  if (!aiText) return null;
  for (const t of TACTICS) {
    // Re-create the regex with the global flag so .exec gives us an index
    // we can use to inspect surrounding context (false-positive guards).
    const globalRe = new RegExp(t.pattern.source, t.pattern.flags.includes("g") ? t.pattern.flags : t.pattern.flags + "g");
    let mm: RegExpExecArray | null;
    while ((mm = globalRe.exec(aiText)) !== null) {
      // False-positive guard for current-CTC probe: when the matched
      // phrase appears in an options-list context ("is it X, Y, or your
      // current package progression?") the AI isn't actually probing
      // current CTC — they're listing causes. Lemon-Yellow round-5
      // produced this exact wrong-phase tip.
      if (t.id === "current_ctc_probe") {
        const start = mm.index;
        const pre = aiText.slice(Math.max(0, start - 40), start).toLowerCase();
        // Preceded by "or " or ", or " → options-list, not a probe.
        if (/(?:,\s*or|\bor)\s+(?:your\s+)?$/.test(pre)) continue;
        // Followed by "progression" → growth-context, not CTC anchoring.
        const post = aiText.slice(start + mm[0].length, start + mm[0].length + 20).toLowerCase();
        if (/^\s*progression/.test(post)) continue;
      }
      return { id: t.id, label: t.label, coaching: t.coaching, counterScripts: t.counterScripts };
    }
  }
  return null;
}
