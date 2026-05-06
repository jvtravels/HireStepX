/* Vercel Edge Function — Dynamic Follow-Up Question Generation */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, sanitizeForLLM, validateContentType } from "./_shared";
import { callLLM, extractJSON } from "./_llm";
import { detectCandidateIntent, extractCandidateSalaryNumber } from "./_follow-up-helpers";
import { classifyCompanyTier, tierPromptSuffix } from "./_company-tier";
import { lookupSalaryContext, getNegotiationStyleContext, INDUSTRY_PACKAGE_CONTEXT, type NegotiationStyle } from "../data/salary-lookup";

declare const process: { env: Record<string, string | undefined> };
const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";

export default async function handler(req: Request): Promise<Response> {
  if (!GROQ_KEY && !GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "LLM not configured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  // Validate Content-Type before preamble (uses its own error path)
  {
    const early = validateContentType(req, withRequestId(corsHeaders(req)));
    if (early) return early;
  }

  // Composed preamble: CORS → body size (512KB) → origin → IP limit → auth → LLM quota
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "follow-up",
    ipLimit: 20,
    checkQuota: true,
    maxBytes: 524288,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  try {
    const { question, answer, type, role, jobDescription, company, currentCity, jobCity, followUpDepth = 0, adaptiveDifficulty, previousFollowUps, persona, conversationHistory, negotiationPhase, questionIndex, totalQuestions, resumeTopSkills, initialOfferText, negotiationFacts, negotiationStyle, negotiationBand, industry, highestOfferMade, candidateTarget, negotiationScenario, candidateState, previousMentions } = await req.json() as {
      question: string; answer: string; type: string; role: string;
      jobDescription?: string; company?: string;
      currentCity?: string; jobCity?: string;
      followUpDepth?: number; adaptiveDifficulty?: "escalate" | "ease" | "hold"; previousFollowUps?: string[];
      persona?: string; conversationHistory?: string;
      negotiationPhase?: string; questionIndex?: number; totalQuestions?: number;
      resumeTopSkills?: string[];
      initialOfferText?: string;
      negotiationFacts?: {
        acceptedImmediately?: boolean;
        rejectedOutright?: boolean;
        candidateCounter?: string;
        candidateAskTotal?: string;
        candidateAskBase?: string;
        candidateCurrentCTC?: string;
        hasCompetingOffers?: boolean;
        topicsRaised?: string[];
        deflectedNumbers?: boolean;
        askedForTime?: boolean;
        usedTacticalSilence?: boolean;
        mentionedBATNA?: boolean;
        expressedSurprise?: boolean;
      };
      negotiationStyle?: NegotiationStyle;
      negotiationBand?: {
        initialOffer: number;
        minOffer: number;
        maxStretch: number;
        walkAway: number;
        bandContext: string;
        hasEquity?: boolean;
      };
      industry?: string;
      highestOfferMade?: number;
      candidateTarget?: number;
      negotiationScenario?: string;
      candidateState?: {
        stress?: "low" | "medium" | "high";
        engagement?: "engaged" | "fading" | "disengaged";
        fillerDensity?: number;
        lengthTrend?: "shortening" | "stable" | "growing";
      };
      previousMentions?: string[];
    };

    if (!question || typeof question !== "string" || !answer || typeof answer !== "string") {
      return new Response(JSON.stringify({ error: "Missing question or answer" }), { status: 400, headers });
    }

    // Whitelist persona values for panel interviews
    if (persona) {
      const validPersonas = new Set(["hiring manager", "technical lead", "hr partner"]);
      if (!validPersonas.has(String(persona).toLowerCase())) {
        return new Response(JSON.stringify({ error: "Invalid persona" }), { status: 400, headers });
      }
    }

    // Detect weak answers that warrant follow-up
    const wordCount = answer.trim().split(/\s+/).length;
    const hasMetrics = /\d+%|\$\d|[0-9]+x|[0-9]+ (users|customers|engineers|people|team|million|billion)/i.test(answer);
    const hasPassiveVoice = /(was done|were made|it was|has been|got done|we had)/i.test(answer);
    const lacksFirstPerson = !(/ I /i.test(answer) || /^I /i.test(answer));
    const isShort = wordCount < 40;

    const jdContext = jobDescription ? `The candidate is targeting this role: ${sanitizeForLLM(jobDescription, 500)}. If relevant, probe for skills mentioned in the JD.` : "";
    const resumeSkillsContext = Array.isArray(resumeTopSkills) && resumeTopSkills.length > 0
      ? `Candidate's key skills from resume: ${resumeTopSkills.slice(0, 6).map(s => sanitizeForLLM(s, 50)).filter(Boolean).join(", ")}. If relevant to the current topic, ask them to demonstrate these skills with specific examples.`
      : "";
    const previousContext = previousFollowUps && previousFollowUps.length > 0
      ? `\nPrevious follow-up exchange:\n${previousFollowUps.map(s => sanitizeForLLM(s, 300)).join("\n")}\n\nDO NOT REPEAT phrasing, opening lines, or core content from your previous follow-ups above. The candidate has already heard those words. If your next message would start with the same opener (e.g. "I heard ₹X — that's the absolute top of what I can approve") that you already said, REPHRASE the entire turn or pivot to a different angle (benefits, levers, role scope, decision timeline). Repeating yourself signals you weren't listening.`
      : "";

    const isSalaryNeg = type === "salary-negotiation";

    /* ─── Anchor derivation ───
       The number the LLM PRESENTED in turn 1 (parsed from initialOfferText)
       is the canonical anchor — not negotiationBand.initialOffer, which is
       a generated band figure that can drift from what the candidate
       actually heard. The headline number is the LARGEST LPA figure in the
       opening offer (component sums like "₹22 fixed + ₹4 variable + ₹4 ESOPs"
       are smaller individual parts; the total CTC headline is the biggest).
       Falls back to band.initialOffer when initialOfferText is missing. */
    function parseHeadlineLPA(text: string): number | null {
      if (!text) return null;
      const re = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs|Cr|cr|crore)/g;
      const nums: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const v = parseFloat(m[1]);
        const isCrore = /cr|crore/i.test(m[0]);
        nums.push(isCrore ? v * 100 : v);
      }
      return nums.length > 0 ? Math.max(...nums) : null;
    }
    const presentedAnchor = isSalaryNeg ? parseHeadlineLPA(initialOfferText || "") : null;
    const canonicalInitialOffer = presentedAnchor ?? negotiationBand?.initialOffer ?? null;

    // For salary negotiation: determine conversation phase from content + index
    // Content-based detection: analyze what's happened so far to pick the right phase
    function detectSalaryPhase(): string {
      if (negotiationPhase) return negotiationPhase; // explicit override from client
      const idx = questionIndex ?? 0;
      const total = totalQuestions ?? 6;
      const progressRatio = idx / Math.max(1, total);
      const facts = negotiationFacts;

      // Early acceptance → skip to closing
      if (facts?.acceptedImmediately && idx >= 2) return "closing";
      // Walk-away detected → closing-pressure (retention attempt)
      const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|decline|pull out|no deal|have to pass)\b/i;
      if (walkAwayPat.test(answer)) return "closing-pressure";
      // Has a counter number + past initial reaction → counter-offer phase.
      // This now wins over the competing-offers probe so we don't keep
      // probing once the candidate has stated a concrete number — that
      // was producing 4 consecutive "tell me more about your number"
      // turns and never a real counter.
      if (facts?.candidateCounter && idx >= 2) return "counter-offer";
      // Competing offers WITHOUT a stated number → probe expectations
      // (we still don't know what they actually want).
      if (facts?.hasCompetingOffers && !facts?.candidateCounter && idx <= 3) return "probe-expectations";
      // Late in conversation → closing phases
      if (progressRatio >= 0.85) return "closing";
      if (progressRatio >= 0.7) return "closing-pressure";
      // Topics raised beyond base → benefits-discussion
      if (facts?.topicsRaised && facts.topicsRaised.length >= 2 && idx >= 3) return "benefits-discussion";
      // Index-based fallback for earlier phases
      if (idx <= 1) return "offer-reaction";
      if (idx === 2) return "probe-expectations";
      if (idx === 3) return "counter-offer";
      if (idx === 4) return "benefits-discussion";
      if (idx === 5) return "closing-pressure";
      return "closing";
    }
    const salaryPhase = isSalaryNeg
      ? detectSalaryPhase()
      : "";

    // Depth 0: probe for detail (existing behavior)
    // Depth 1: challenge / pushback
    // Depth 2: pivot to adjacent competency
    const safeDepth = Math.max(0, Math.min(2, Math.floor(followUpDepth)));
    const followUpTypeLabel = isSalaryNeg
      ? (salaryPhase || "negotiation_response")
      : (safeDepth === 0 ? "probe_detail" : safeDepth === 1 ? "challenge" : "pivot");

    // Determine answer strength for adaptive follow-up behavior
    const hasSpecifics = /specifically|for example|for instance|in particular|one time|at my previous|at our company|we decided/i.test(answer);
    const hasStructure = /first|second|then|finally|result|outcome|impact|as a result|because of this/i.test(answer);
    const qualitySignals = [!isShort, hasMetrics, !hasPassiveVoice, !lacksFirstPerson, hasSpecifics, hasStructure].filter(Boolean).length;
    const answerStrength = qualitySignals >= 5 ? "strong" : qualitySignals >= 3 ? "decent" : qualitySignals >= 1 ? "weak" : "very_weak";

    // Cross-question memory: earlier conversation for thematic connections
    // For salary-negotiation: higher cap and placed prominently — the LLM MUST remember what's been said
    const historyCharLimit = isSalaryNeg ? 4000 : 2500;
    const historyLabel = isSalaryNeg
      ? "FULL NEGOTIATION HISTORY (you MUST reference previous offers, numbers, and promises — never contradict what you said earlier)"
      : "EARLIER IN THIS INTERVIEW (use for thematic connections — reference earlier answers when relevant)";
    const historyContext = conversationHistory
      ? `\n${historyLabel}:\n${sanitizeForLLM(conversationHistory, historyCharLimit)}`
      : "";

    let depthInstructions: string;
    if (isSalaryNeg) {
      // Salary-negotiation: each follow-up is the hiring manager's NEXT conversational turn.
      // The phase determines what the manager should say next — this creates a natural conversation arc.
      const phaseInstructions: Record<string, string> = {
        "offer-reaction": `PHASE: Reacting to the candidate's response to your initial offer.

YOUR GOAL: Understand where they stand and steer toward specifics.
- If they ACCEPTED immediately: acknowledge warmly, BUT gently probe — "That's great! But before we finalize, have you thought about [equity/flexibility/growth]? I want you to feel confident about the full picture." Accepting instantly is a missed opportunity — help them see that.
- If they named a number: MIRROR IT BACK — "I heard ₹X from you. That's [above/within/below] our band for this role in [city]." Then ask what's driving their number — market data, competing offers, or expectations?
- If they asked about breakdown: provide base/bonus/benefits split with EXACT numbers, then ask "Does knowing the structure change your thinking?"
- If they said it's too low: "I hear you — help me understand what range feels right. Are you benchmarking against a specific offer or market data?"
- If they deflected ("what's your offer first?"): recognize the tactic — "Nice try! I've already shared our number. I need to understand your side to see where we can meet. What range are you targeting?"
- If they asked for time to think: "Of course — take a moment. But I should mention, we're looking to close this position by [date]. Can we reconnect in 48 hours?"
- If vague/empty: restate your offer with the exact ₹ number and ask for their target range.
CRITICAL: ALWAYS mirror back what the candidate said before responding. Start with "I heard you say..." or "So you're looking at..." — this makes it feel like a real conversation.`,

        "probe-expectations": `PHASE: Probing deeper into the candidate's expectations.

YOUR GOAL: Understand their number so you can counter BELOW it. You want to close as LOW as possible.
- If they ACCEPTED: acknowledge warmly, transition to package details or closing. That's a win — close quickly.
- If they shared a number BELOW your initial offer: "That works for us — let me finalize this." Close immediately — you're saving money.
- If they shared a number NEAR your initial offer: small stretch — "I can do ₹X" (slightly above your initial). Don't overshoot.
- If they shared a number ABOVE your initial offer: DON'T match it. Probe WHY: "₹X is what you're targeting. Is that based on market research, a competing offer, or your current package progression?" — understanding their reasoning helps you counter LOWER.
- If their number is way above your band (>1.5x maxStretch): REALITY CHECK with empathy — "I appreciate the ambition. ₹X is significantly above our band for this level in [city]. For context, [role] at companies like ours typically falls in the ₹Y-Z range."
- If they mentioned competing offers: probe specifics — "What are they offering? More importantly, what matters most to you — the number, the role, or the team?"
- If they deflected: put your full offer on the table with breakdown, then ask what would make it a yes.
CRITICAL: NEVER offer more than what the candidate asked for. If they said ₹30 LPA, your counter should be ₹25-28 LPA, not ₹35 LPA.`,

        "counter-offer": `PHASE: Making a counter-offer based on everything you've heard.

YOUR GOAL: Close the deal as LOW as possible while keeping the candidate interested. You are the HIRING MANAGER — your job is to save the company money while making a fair offer.
- CRITICAL: Your counter-offer MUST be BELOW the candidate's ask. NEVER offer MORE than what they asked for. If they said ₹30 LPA and your band goes to ₹40 LPA, counter at ₹25-28 LPA — NOT ₹35-40 LPA. You want to save cost.
- ALWAYS make a concrete counter with REAL numbers (substitute the figures from your band — for example "₹14 base, ₹2 variable, plus a ₹1.5 joining bonus, total ₹17.5 LPA"). NEVER write the literal characters ₹X, ₹Y, ₹Z, ₹W, ₹V, [amount], or [number] in your reply — those are placeholders for YOU to fill in. Never say vague things like "some flexibility."
- If their ask is AT or BELOW your initial offer: "That's within our range — I can work with that." Close quickly — that's a win for you.
- If their ask is ABOVE your initial offer but within your band: counter PARTWAY — split the difference. "You asked for ₹X, I started at ₹Y. Let me see if I can stretch to ₹Z" (where Z is between Y and X, closer to Y).
- If they want more base: "I can move base to ₹X if we adjust variable to Y%. Or I could add a ₹Z joining bonus to bridge the gap. Which works better for you?" — restructure to SEEM higher without actually raising total CTC much.
- If they focus only on salary: redirect to non-cash — ${negotiationBand?.hasEquity ? `"I may not be able to match ₹X on base, but let me show you the full picture: joining bonus, ESOPs vesting over 4 years, plus learning budget. The total package value is actually ₹V."` : `"I may not be able to match ₹X on base, but let me show you the full picture: joining bonus, learning budget, and upgraded health insurance. The total package value is actually ₹V." Do NOT mention ESOPs or equity — this role does not include them.`}
- If they pushed hard: be transparent — "₹X is genuinely my ceiling for this band. Beyond that, I'd need to go back to leadership. But here's what I CAN add: [2-3 specific levers with numbers]."
- Notice period as a lever, ONLY if candidate is currently employed with a long notice. Substitute a real ₹ figure (e.g. ₹2 LPA notice buyout). If the candidate already mentioned they're available immediately / their notice already ended / they were laid off / their previous job ended, DO NOT offer a notice buyout — they have nothing to buy out.
- If vague: "What's the minimum package that makes this a clear yes for you? Give me a number and I'll tell you what I can do."`,

        "benefits-discussion": `PHASE: Expanding the conversation to total compensation beyond base salary.

YOUR GOAL: PROACTIVELY suggest creative trade-offs, don't just describe benefits.
- If they only discussed base: "Let me paint the full picture. Beyond ₹X CTC, there's: [list specific benefits with values]. When you add it all up, the real value is closer to ₹Y."
- ${negotiationBand?.hasEquity ? `If they asked about equity/ESOPs: go DEEP — "Great question. We offer X% vesting over 4 years with a 1-year cliff. At our current valuation, that's worth roughly ₹Y annually. What matters more to you — the vesting schedule or the total allocation?"` : `If they asked about equity/ESOPs: be honest — "We don't offer ESOPs at this level/company type. But let me tell you what we DO offer that's valuable: [joining bonus, learning budget, flexible work, health coverage, performance-linked bonuses]. What matters most to you?"`}
- If they asked about flexibility: be concrete — "We do [X days WFH/week]. Team standups are at [time]. As long as you hit your deliverables, we're flexible on hours."
- If they seem stuck on base: brainstorm together — "What if we keep base at ₹X but add a performance-linked ₹Y bonus after 6 months? Plus a ₹Z joining bonus upfront? Would that change the math for you?"
- If they asked about growth: "Typical promotion cycle is [X months]. Our last 3 hires at this level moved to [next level] within [timeline] with a [X-Y%] raise. I can build that trajectory into your offer letter."
- PROACTIVE suggestions: don't wait for them to ask. Offer — "Have you thought about our sabbatical policy? Or the fact that we cover ₹X for certifications annually?"`,

        "closing-pressure": `PHASE: Creating urgency and moving toward a decision.

YOUR GOAL: Close the deal NOW at the current offer level. Do NOT raise the offer further unless absolutely necessary.
- If they seem close: "I genuinely want to close this today. I have one other strong candidate at final stage, and the headcount approval expires end of month. What do I need to do to get a yes?"
- If still pushing: present FINAL offer — but keep it at or slightly above your last offer, NOT at maxStretch. "Here's my absolute best: ₹X base, ₹Y variable, ₹Z joining bonus. Total: ₹W LPA. This is genuinely the top of what I can do."
- If they mention notice period: "What's your notice? If it's 60+ days, I'll add a ₹X buyout bonus for joining within 30. Can you negotiate with your current employer?" (HARD RULE: ₹X here is a NOTICE BUYOUT — formula is roughly (notice_days ÷ 30) × monthly_base × 1.5. Realistic range ₹1–3 LPA. NEVER use the full annual CTC. Never reuse the offer total. If unsure, write ₹1.5 LPA.)
- If they want time to think: don't panic — "Of course. I respect that. Can we touch base by [specific day]? I'll hold the offer till then, but I should be transparent — I can't guarantee the same terms after [date] because budget cycles."
- If they're asking questions (good sign): answer warmly, then close — "Great questions. So now that you have the full picture — are we ready to move forward?"
- Explicit confirmation: ALWAYS end with a clear ask — "So just to confirm — are we agreed on ₹X total, with [key terms]? I want to make sure we're aligned before I send this to HR."`,

        "closing": `PHASE: Finalizing the negotiation.

YOUR GOAL: Bring the conversation to a clean close — but match the candidate's actual stance. Do NOT pretend a deal exists if the candidate hasn't said yes.

CRITICAL — READ THE INTENT BANNER ABOVE BEFORE PICKING A BRANCH:
- If the candidate EXPLICITLY ACCEPTED (banner says "CANDIDATE ACCEPTED"): recap the SPECIFIC agreed deal, set timeline, warm-close. Use the "agreed" branch below.
- If the candidate has NOT explicitly accepted (no acceptance in banner): use the "still-open" branch. Never claim agreement.

[AGREED BRANCH — only when candidate said yes]
- Recap with EXACT numbers: "Great. So here's what we've agreed: ₹X base, ₹Y variable, ₹Z joining bonus, [equity/benefits]. Total CTC: ₹W LPA." (₹X + ₹Y + ₹Z must SUM to ₹W. Sanity-check your arithmetic before writing.)
- Set timeline: "I'll have HR send the formal offer letter by [day]. You'll have [X days] to review and sign."
- Ask about notice: "What's your notice period? We'd love to have you start by [date]."
- Warm close: "I'm really glad we found a number that works. I think you're going to do great things here, and the team is excited to have you."

[STILL-OPEN BRANCH — when no explicit acceptance]
- Acknowledge where things stand WITHOUT claiming agreement: "Where we are right now is — our offer is ₹X total. You've shared your concerns about [specific thing they raised]. I want to be clear: I'm not going to pressure you for a yes today."
- Surface what's still on the table: "The ₹X package is what I can do, and it stands. If there's a number that would change your mind, tell me — and I'll see what's possible."
- Set a soft deadline: "Take a couple of days to think it through. I'll need a final answer by [day] so I can either move forward or give the slot to another candidate."
- DO NOT use: "we've agreed" / "what we agreed on" / "let me put together the final numbers" / "I'll have HR send the offer" / "welcome aboard" / "having you on board" — these all imply a yes that hasn't happened.

[STILL-NEGOTIATING BRANCH — candidate is still pushing]
- "I hear you, but this is genuinely my final offer. I've stretched as far as I can. The next step is either a yes or we part as friends — what's it going to be?"
- "If they want to think: Absolutely. The offer stands until [date]. But I'll be honest — I'd love an answer sooner so I can lock in the headcount."

NUMBER DISCIPLINE: Whenever you write a recap with components (₹A base + ₹B variable + ₹C bonus), the components MUST sum to the stated total. NEVER write "total ₹X comprising ₹X base, ₹X variable, ₹X bonus" — that is mathematically impossible and destroys credibility instantly.`,
      };

      // Extract the initial offer from conversation history so the LLM can reference exact numbers.
      // Pin the headline anchor explicitly so the LLM cannot round or drift.
      // The "WORD BINDING" clause closes the loophole that produced Bug A
      // (image 2 in the user-reported salary-neg report): the LLM said
      // "initial offer of 22 LPA base" several turns after presenting
      // 20 LPA as initial — semantically rebinding "initial" to a new
      // number. Counter-offers must use "revised / updated / best-and-
      // final" — the word "initial" is permanently bound to the anchor.
      const anchorLine = canonicalInitialOffer !== null
        ? `\nPINNED INITIAL OFFER: ₹${canonicalInitialOffer} LPA. This is your starting anchor. NEVER write a different number for "initial offer" — not ₹${(canonicalInitialOffer - 0.4).toFixed(1)}, not ₹${(canonicalInitialOffer + 0.4).toFixed(1)}, not anything close. Echo ₹${canonicalInitialOffer} exactly.
WORD BINDING: The phrase "initial offer" is PERMANENTLY bound to ₹${canonicalInitialOffer} LPA for the rest of this conversation. When you make a counter-offer, NEVER call it "our initial offer" — call it "the revised offer", "the updated offer", "my best-and-final", or simply "the offer". Saying "initial offer of ₹${canonicalInitialOffer + 2} LPA base" or "revisit our initial offer of ₹${canonicalInitialOffer + 2}" rebinds the word "initial" to a new number — that is a contract-breaking error that destroys candidate trust.`
        : "";
      const offerCtx = initialOfferText
        ? `\nINITIAL OFFER YOU PRESENTED: "${sanitizeForLLM(initialOfferText, 500)}"\nYou MUST use these exact numbers when referencing the offer. Do NOT invent different figures.${anchorLine}`
        : anchorLine;

      // Build structured facts context so the LLM has precise anchors
      const factsLines: string[] = [];
      if (negotiationFacts) {
        if (negotiationFacts.acceptedImmediately) factsLines.push("- Candidate ACCEPTED the offer immediately (probe if they've considered the full package)");
        if (negotiationFacts.rejectedOutright) factsLines.push("- Candidate REJECTED the offer outright (stay professional, ask what would work)");
        if (negotiationFacts.candidateCounter) factsLines.push(`- Candidate's counter/target: ${sanitizeForLLM(negotiationFacts.candidateCounter, 30)} — YOU KNOW THIS. Negotiate around it, do NOT re-ask. SPEAKER GUARD: when you write "I heard ₹X from you" / "you mentioned ₹X" / "your target of ₹X", X MUST be ${sanitizeForLLM(negotiationFacts.candidateCounter, 30)}. Never echo your own offer (${canonicalInitialOffer ? `₹${canonicalInitialOffer} LPA` : "the initial offer"}) as if the candidate said it.`);
        if (negotiationFacts.candidateAskTotal && negotiationFacts.candidateAskBase) {
          factsLines.push(`- Candidate split their ask: TOTAL ${sanitizeForLLM(negotiationFacts.candidateAskTotal, 30)}, BASE ${sanitizeForLLM(negotiationFacts.candidateAskBase, 30)}. When you reference "what they asked for", use the TOTAL — not the base. Quoting their base figure as their target is a confusion bug; do not collapse the two.`);
        }
        if (negotiationFacts.candidateCurrentCTC) factsLines.push(`- Candidate's current CTC: ${sanitizeForLLM(negotiationFacts.candidateCurrentCTC, 30)} — YOU KNOW THIS. Do NOT ask again.`);
        if (negotiationFacts.hasCompetingOffers) factsLines.push("- Candidate mentioned COMPETING OFFERS — you MUST address this: ask what they're offering, what matters beyond the number, and where you can differentiate.");
        if (negotiationFacts.deflectedNumbers) factsLines.push("- Candidate DEFLECTED sharing their numbers — recognize this tactic. Stay warm but firm: you need their input to negotiate.");
        if (negotiationFacts.askedForTime) factsLines.push("- Candidate asked for TIME TO THINK — respect this, but set a 48-hour window with a reason. Ask what's giving them pause.");
        if (negotiationFacts.usedTacticalSilence) factsLines.push("- Candidate used TACTICAL SILENCE (short/minimal responses) — they may be creating pressure. Don't rush to fill the silence. Acknowledge it calmly.");
        if (negotiationFacts.mentionedBATNA) factsLines.push("- Candidate mentioned their BATNA/walk-away alternative — take this seriously. Ask what would make them choose you over their alternative.");
        if (negotiationFacts.expressedSurprise) factsLines.push("- Candidate EXPRESSED SURPRISE at the offer — this may be a flinch tactic. Stay composed, reaffirm value, and ask what they were expecting.");
        if (negotiationFacts.topicsRaised && negotiationFacts.topicsRaised.length > 0) {
          factsLines.push(`- Topics the candidate raised: ${negotiationFacts.topicsRaised.join(", ")} — reference these when suggesting trade-offs.`);
          // Proactively suggest levers based on topics NOT yet raised
          const unreasedLevers = ["joining bonus", "notice period/joining", "remote/flexibility", "learning budget", "career growth", "health insurance"]
            .filter(l => !negotiationFacts.topicsRaised!.includes(l));
          if (unreasedLevers.length > 0 && negotiationFacts.topicsRaised!.length >= 1) {
            factsLines.push(`- PROACTIVE LEVER TIP: The candidate hasn't asked about ${unreasedLevers.slice(0, 3).join(", ")} — consider offering one of these to sweeten the deal or create a trade-off.`);
          }
        }
        // Notice period as a proactive lever (even if candidate didn't raise it)
        if (!negotiationFacts.topicsRaised?.includes("notice period/joining")) {
          factsLines.push("- NOTICE PERIOD: You haven't discussed notice period yet. Ask: 'What's your notice period?'. If their answer indicates they're CURRENTLY EMPLOYED with a long notice (60-90 days), then a buyout is a useful lever — substitute a REAL ₹ figure like ₹1.5 LPA. If their answer indicates they're already available (notice ended, laid off, between jobs, freelancing), DO NOT offer a notice buyout — there's nothing to buy out. Never write the literal characters ₹X, ₹Y, ₹Z, ₹W as placeholders.");
        }
      }
      const factsCtx = factsLines.length > 0
        ? `\nCANDIDATE FACTS (from this conversation — use these to personalize your response):\n${factsLines.join("\n")}`
        : "";

      // Negotiation band context (structured authority limits).
      // Limit raised 600 → 2400 because the strengthened bandContext
      // (anti-capitulation + ₹X-placeholder ban + notice-period
      // intelligence) is ~1800 chars and the most important rules
      // were getting truncated, letting the LLM revert to its
      // friendly-coach default.
      const bandCtx = negotiationBand?.bandContext
        ? `\n${sanitizeForLLM(negotiationBand.bandContext, 2400)}`
        : "";

      // Monotonic offer rule + candidate target context
      const offerTrackingCtx = highestOfferMade
        ? `\nIMPORTANT: Your highest previous offer was ₹${highestOfferMade} LPA. Your next offer MUST be >= ₹${highestOfferMade} LPA. Never go backwards.`
        : "";
      const targetCtx = candidateTarget
        ? `\nThe candidate's stated target is ₹${candidateTarget} LPA. Use this to calibrate your offers — if their target is within your band, work toward it. If above, reality-check it.
TARGET WORD BINDING: Whenever you refer to "your target", "the candidate's target", "you're looking for", "you're asking for", "you mentioned", or "you said", you MUST use exactly ₹${candidateTarget} LPA. NEVER substitute a different number for the candidate's target — not your counter-offer, not your stretch number, not a compromise figure. Those are YOUR numbers, not theirs. Mixing them up ("your target of ₹{differentNum}") destroys candidate trust because they remember exactly what they said.`
        : "";

      // Negotiation style context
      const styleCtx = negotiationStyle
        ? `\n${getNegotiationStyleContext(negotiationStyle)}`
        : "";

      // Scenario-specific context
      const scenarioCtx = negotiationScenario === "lowball"
        ? "\nSCENARIO: LOWBALL OFFER. Your initial offer is deliberately 20-30% below market rate. Be prepared for strong pushback. If the candidate negotiates well, gradually move toward market rate but make them earn every increment."
        : negotiationScenario === "exploding"
        ? "\nSCENARIO: EXPLODING OFFER. You have a 24-hour deadline for the candidate to accept. Create time pressure. If they ask for more time, emphasize the urgency but consider a brief extension if they make a strong case."
        : negotiationScenario === "competing"
        ? "\nSCENARIO: COMPETING OFFERS. The candidate claims to have multiple offers. Probe for specifics — ask which companies, what terms. If credible, be more flexible. If vague, call the bluff professionally."
        : "";

      // Industry-specific package flavor
      const industryCtx = industry && INDUSTRY_PACKAGE_CONTEXT[industry.toLowerCase()]
        ? `\n${INDUSTRY_PACKAGE_CONTEXT[industry.toLowerCase()]}`
        : "";

      // Intent detection + salary-number extraction extracted into
      // ./_follow-up-helpers.ts so the regex rules can be unit-tested.
      const intent = detectCandidateIntent(answer);
      const candidateAccepted = intent.accepted;
      const isConditionalAccept = intent.conditionalAccept;
      const candidateRejected = intent.rejected;
      const candidateDeflected = intent.deflected;
      const candidateWalkAway = intent.walkAway;
      const candidateNeedsTime = intent.needsTime;
      const candidateMentionedCompeting = intent.mentionedCompeting;
      const candidateNum = extractCandidateSalaryNumber(answer);

      // Build intent banner — placed at the VERY TOP of the prompt so the LLM can't miss it
      let intentBanner = "";
      if (candidateAccepted && !isConditionalAccept) {
        intentBanner = `
⚠️⚠️⚠️ THE CANDIDATE ACCEPTED THE OFFER. THEY SAID: "${sanitizeForLLM(answer, 350)}" ⚠️⚠️⚠️
YOU MUST acknowledge their acceptance warmly FIRST. Then either:
- If they accepted too quickly (within first 2 questions): gently probe — "That's great! But before we lock this in, have you considered [equity/flexibility/growth path]? I want you to feel confident."
- If later in the negotiation: move to closing — recap the EXACT agreed package with ₹ numbers, mention offer letter timeline, ask about notice period. Rebuild warmth: "I'm really glad we worked this out."
DO NOT counter-offer or act as if they rejected. They said YES.
`;
      } else if (isConditionalAccept) {
        intentBanner = `
THE CANDIDATE CONDITIONALLY ACCEPTED. THEY SAID: "${sanitizeForLLM(answer, 350)}"
They accepted the core offer but have a condition or want to discuss something else (equity, benefits, flexibility, etc.).
YOU MUST:
1. Acknowledge the acceptance warmly FIRST: "Great, I'm glad the base works for you!"
2. Then address their specific condition/question directly with concrete answers and ₹ numbers.
3. Do NOT re-negotiate the base salary — they already accepted that. Focus on what they asked about.
`;
      } else if (candidateWalkAway) {
        intentBanner = `
⚠️⚠️⚠️ THE CANDIDATE IS WALKING AWAY. THEY SAID: "${sanitizeForLLM(answer, 350)}" ⚠️⚠️⚠️
This is a CRITICAL moment. You MUST attempt retention:
- First, acknowledge: "I understand, and I respect that."
- Then, pause and pivot: "But before you make a final decision — I genuinely believe you'd be a great fit here."
- Offer to escalate: "Let me go back to my leadership. I may be able to push this higher." Give a specific stretch number if available.
- Create soft urgency: "Can you give me 24 hours before you decide?"
DO NOT let them walk without an attempt to retain. DO NOT beg or over-promise. Stay professional.
`;
      } else if (candidateRejected) {
        intentBanner = `
⚠️⚠️⚠️ THE CANDIDATE REJECTED/PUSHED BACK. THEY SAID: "${sanitizeForLLM(answer, 350)}" ⚠️⚠️⚠️
YOU MUST acknowledge their pushback FIRST ("I hear you", "I understand"). Then:
- Make a SPECIFIC better counter-offer with exact ₹ numbers (not vague "flexibility").
- If they named a number, mirror it: "You're looking at ₹X — let me see how close I can get."
- If their ask is way above your band: reality-check with empathy — "₹X is significantly above our band. For context, this role in [city] typically ranges ₹Y-Z. Help me understand — is there flexibility on your end?"
DO NOT ignore their rejection. DO NOT close the deal as if they agreed.
`;
      } else if (candidateNeedsTime) {
        intentBanner = `
THE CANDIDATE WANTS TIME TO THINK. THEY SAID: "${sanitizeForLLM(answer, 350)}"
RESPECT their request, but create soft urgency:
- "Of course — take the time you need. Can we reconnect by [specific day]? I should be transparent: the headcount approval has a window, and I'd hate for timing to be an issue."
- Ask what's giving them pause: "Can I ask what's on your mind? Sometimes talking it through helps."
- If they mention family/partner: "Absolutely — it's a big decision. Would it help if I put together a written summary of the full package for you to share with them?"
`;
      } else if (candidateDeflected) {
        intentBanner = `
THE CANDIDATE DEFLECTED. THEY SAID: "${sanitizeForLLM(answer, 350)}"
They're trying to avoid committing to a number. Recognize the tactic:
- "I appreciate the approach, but I've already shared our offer of ₹X. To make this work, I need to understand your side. What range are you targeting?"
- If they asked "what's your best offer?" — "I've shared our opening number. This is a conversation, not an auction — help me understand what you need and I'll see what I can do."
- Stay warm but firm. Don't cave to pressure.
`;
      } else if (candidateMentionedCompeting) {
        intentBanner = `
THE CANDIDATE MENTIONED COMPETING OFFERS. THEY SAID: "${sanitizeForLLM(answer, 350)}"
ENGAGE with this directly:
- "That's helpful to know. Can you share what they're offering? Not to match blindly, but to understand where we need to be competitive."
- "What makes you lean toward us vs them? Is it purely the number, or are there other factors?"
- If appropriate: "We may not be able to match on base, but our [equity/growth/flexibility] is often what makes the difference for candidates choosing between us and [competitor type]."
`;
      } else {
        intentBanner = `
THE CANDIDATE SAID: "${sanitizeForLLM(answer, 350)}"${candidateNum ? `\nTHEY MENTIONED A SPECIFIC NUMBER: ₹${candidateNum} LPA. You MUST mirror this back — "I heard ₹${candidateNum} from you..." — before responding.` : ""}
Your response MUST directly address what they said above. Start by acknowledging their words.
`;
      }

      // Equity availability guard for all salary negotiation phases
      const equityGuard = negotiationBand?.hasEquity === false
        ? "\nEQUITY GUARD: This role does NOT include ESOPs, RSUs, or stock options. Do NOT mention equity in any offer, counter-offer, or benefits discussion. Focus on base, joining bonus, variable pay (if applicable), learning budget, health insurance, and flexibility."
        : "";

      /* Rejection-locks-out-closing guard (Bug B fix). When the
         candidate just rejected ("stick with 26 lakhs"), the LLM
         used to glide into wrap-up language ("we've had a productive
         discussion, let me put together the final numbers") because
         the phase index had advanced past 0.85. That sequence implies
         a deal that does NOT exist — catastrophically dishonest from
         a coaching standpoint. We now (a) force the effective phase
         off "closing" / "closing-pressure" back to "counter-offer"
         when intent.rejected is true, and (b) inject a hard ban-list
         of agreement phrases into the prompt. The LLM may still close
         later — but only after the candidate has actually agreed. */
      const rejectionLocksClosing = candidateRejected || candidateWalkAway;
      const effectiveSalaryPhase = rejectionLocksClosing && (salaryPhase === "closing" || salaryPhase === "closing-pressure")
        ? "counter-offer"
        : salaryPhase;
      const rejectionGuard = rejectionLocksClosing
        ? `\nREJECTION LOCK — NO DEAL HAS BEEN REACHED. The candidate just pushed back. The following phrases are BANNED in your reply (using any of them fabricates an agreement that doesn't exist):
- "productive discussion" / "great conversation" / "we've had a great chat"
- "what we've agreed" / "what we agreed on" / "the agreed package"
- "final numbers" / "finalize" / "lock this in"
- "have HR send" / "formal offer letter" / "I'll send the offer"
- "welcome aboard" / "excited to have you" / "team is excited"
- "what's your notice period" (do NOT pivot to logistics — the deal isn't closed)
You must either (a) make a CONCRETE counter with a new ₹ number above your previous offer, or (b) probe what would actually move them. Do not behave like the negotiation is over.`
        : "";

      /* Bug F fix — No-agreement guard. The user reported a session
         where the AI said "we've had a productive discussion ... let
         me put together the final numbers based on what we've agreed
         ... we're looking forward to having you on board" — but the
         candidate had not actually accepted ANYTHING. They were just
         answering a notice-period question. The closing-PHASE prompt
         template ("Recap with EXACT numbers: 'here's what we've
         agreed'") was firing as a TEMPLATE without checking whether
         agreement had been reached. This guard fires symmetrically
         to rejectionGuard: when we're in a closing-family phase but
         the candidate has NOT explicitly accepted (current turn or
         ever in conversation history), ban the agreement-implying
         phrases and require a non-presumptive close. */
      const acceptInHistoryRe = /\b(i accept|i agree|sounds good|that works for me|it.?s a deal|happy with|works for me|let.?s go ahead|deal|i.?ll take it|i.?ll take the offer)\b/i;
      const everAcceptedInHistory = conversationHistory ? acceptInHistoryRe.test(conversationHistory) : false;
      const candidateExplicitlyAccepted = candidateAccepted || isConditionalAccept || negotiationFacts?.acceptedImmediately === true || everAcceptedInHistory;
      const noAgreementGuard = !candidateExplicitlyAccepted && !rejectionLocksClosing
        && (effectiveSalaryPhase === "closing" || effectiveSalaryPhase === "closing-pressure")
        ? `\nNO-AGREEMENT GUARD — THE CANDIDATE HAS NOT ACCEPTED THIS OFFER. Do not write the close as if a deal was reached. The following phrases are BANNED:
- "what we've agreed" / "what we agreed on" / "we've agreed" / "the agreed package"
- "having you on board" / "welcome aboard" / "excited to have you" / "team is excited"
- "let me put together the final numbers" (you can't finalize numbers without a yes)
- "I'll have HR send the offer" / "formal offer letter" / "I'll send the paperwork"
- "I'm glad we worked this out" / "great that we landed on" / "found a number that works"
INSTEAD, use non-presumptive closing language that respects the candidate's open status:
- "The offer of ₹X stands. Take some time to think it through, and let me know your decision by [day]."
- "I appreciate the conversation. Whenever you're ready to give me a yes or a counter, I'm here."
- "We've shared what we can do. The next move is yours — what do you need to make a decision?"
You may STILL ask about notice period, joining timeline, or remaining concerns — just frame them as "if you decide to accept" hypotheticals, not as faits accomplis.`
        : "";

      depthInstructions = `You are a HIRING MANAGER in a salary negotiation. You MUST stay in character. ALWAYS set needsFollowUp to true.
${intentBanner}${equityGuard}${rejectionGuard}${noAgreementGuard}${historyContext}
${factsCtx}${offerCtx}${bandCtx}${offerTrackingCtx}${targetCtx}${styleCtx}${industryCtx}${scenarioCtx}

CURRENT PHASE: ${effectiveSalaryPhase.toUpperCase()}
${phaseInstructions[effectiveSalaryPhase] || phaseInstructions["offer-reaction"]}

RULES:
- REPAIR FIRST: If the candidate's answer is a confusion / clarification signal — e.g. "what?", "what are you offering me?", "I don't understand", "can you repeat", "wait what", "huh?", "say that again", "I'm confused", "didn't catch that", a question back to you about the offer itself, or under 8 words asking for clarification — DO NOT push forward with a new probe. Recap your most recent offer plainly with the exact ₹ numbers (base / variable / bonus / total CTC) and ask if that's clear. One short paragraph. Don't add new asks until the candidate signals they're tracking. This rule overrides the rest of the phase script.
- HEAR THEM: If the candidate's answer signals frustration that you're repeating yourself — "already mentioned", "as I said", "I told you", "multiple times", "already said", "told you before", "again" used reproachfully, "for the third/Nth time", or any short answer that references having previously answered — you MUST: (1) explicitly acknowledge ("you're right, you already mentioned that — apologies"), (2) make a CONCRETE move on the same turn (a real ₹ counter, a specific trade, or an explicit concession). Asking another open-ended question after this signal is the failure mode of this whole interview type. Do NOT do it.
- NO COUNTER-DODGE: If the candidate has ALREADY stated a number (CANDIDATE FACTS shows candidateCounter) AND they directly ask for your counter ("what's your counter?", "what can you offer?", "what's your best?", "give me a number"), you MUST respond with a SPECIFIC ₹ figure — not another probe. Do NOT say "to make progress I need to understand your expectations first" — they've given you their expectations. Counter with a real number from your band, ideally between your initial offer and their ask. Saying "tell me more about your reasoning" after they've already shared market data + asked for a counter feels evasive and unrealistic.
- TOPICAL COHERENCE: Stay on the topic the candidate just raised. If they were sharing market data, your next move is to acknowledge or counter that data — NOT to suddenly ask "what about joining bonus?". If they just talked about base salary, follow up on base or total CTC, not equity. Topic switches are allowed only when (a) you've genuinely closed the previous thread, or (b) you're using a non-cash lever as a deliberate trade ("I can't move on base, but I can add ₹X joining bonus"). Random topic jumps make the conversation feel like a script, not a negotiation.
- NO WORD SALAD: Re-read your draft before finishing. Reject phrasings that don't parse — "absolute top of what I can approve earlier", "let me revisit the breakdown of our offer to see if we can meet you somewhere in the middle" without specifying NEW numbers, etc. If a sentence doesn't say a concrete thing (a number, a trade, a clear next step, an acknowledgement), cut it.
- MATCH INTENT: Re-read the candidate's answer above. Accepted → acknowledge and close. Rejected → acknowledge and counter. Question → answer it. NEVER ignore what they said.
- MIRROR FIRST: Start by paraphrasing what the candidate said. "I heard ₹X from you..." or "So your concern is..."
- BE SPECIFIC: Use exact ₹ numbers in any counter-offer. Never say "some flexibility" — say "I can stretch to ₹X."
- DON'T RE-ASK: Never ask for info already in CANDIDATE FACTS above.
- OFFERS GO UP ONLY: Every offer >= your initial offer. But never offer MORE than the candidate asked for.
- Near maxStretch: "That's at the top of my authority. Let me check with leadership on ₹X."
- Tone: Real Indian hiring manager — professional, warm, direct. 2-4 sentences. Use ₹ and LPA.
- Stay in character. Never give coaching tips.

SCOPE FENCE — THIS IS A SALARY NEGOTIATION, NOT A BEHAVIORAL OR TECHNICAL INTERVIEW.
The candidate has ALREADY been offered the role. The interview's only job now is to close the package. Therefore:
- DO NOT ask about past projects, work history, or "tell me about a time you…" stories
- DO NOT ask "walk me through what you've done in the last 6-12 months" — that's a behavioral probe, not a negotiation move
- DO NOT ask about technical depth, design process, system design, or domain expertise
- DO NOT ask "what would you bring to the role" / "build your X muscle" / "show me your impact" / "demonstrate your skills" — none of that is on the table at this stage
- DO NOT pivot to "how would you approach problem Y" or "what's your experience with Z"

ALLOWED topics ONLY: salary numbers (base / variable / ESOPs / joining bonus), expectations and reasoning behind them, current CTC, competing offers, market data, equity terms (vesting / cliff / strike), benefits (health / learning / flex / WFH), notice period and joining timeline, leadership-approval check-ins, deal close. If you find yourself drafting a question about something OTHER than these topics, rewrite — you are off-script.`;
    } else if (safeDepth === 0) {
      depthInstructions = `Analysis of candidate's answer:
- Word count: ${wordCount} ${isShort ? "(SHORT — likely needs follow-up)" : "(adequate length)"}
- Contains metrics/numbers: ${hasMetrics ? "yes" : "NO — probe for quantified impact"}
- Uses passive voice: ${hasPassiveVoice ? "YES — probe for their specific role" : "no"}
- Uses first-person 'I': ${lacksFirstPerson ? "NO — probe for individual contribution" : "yes"}
- Contains specifics: ${hasSpecifics ? "yes" : "NO — too generic"}
- Answer strength: ${answerStrength}

${answerStrength === "strong" ? `The answer is strong. Follow up ONLY if:
- You spot an interesting claim that deserves a "tell me more" probe
- There's a deeper insight to unlock ("What would you do differently at 10x scale?")
- The answer hints at a challenge or conflict worth exploring
If the answer fully addresses the question with specifics and metrics, set needsFollowUp to false.` :
answerStrength === "decent" ? `The answer is decent but could be stronger. Follow up to:
- Push for specific numbers/metrics ("Can you quantify the impact?")
- Clarify their specific role vs team effort ("What was YOUR contribution specifically?")
- Ask for the outcome/result if they stopped at the action ("What happened as a result?")` :
`The answer is weak. You SHOULD follow up. Choose the most pressing gap:
- If too vague: "Can you walk me through a specific example of that?"
- If no metrics: "What were the actual numbers — users, revenue, timeline?"
- If passive/team: "I want to understand YOUR role specifically — what did YOU decide?"
- If too short: "Tell me more about that — what was the situation and what did you do?"
Tone: Be encouraging but firm. A real interviewer would probe, not just move on.`}`;
    } else if (safeDepth === 1) {
      depthInstructions = `This is a CHALLENGE follow-up (depth 1). You MUST generate a follow-up — set needsFollowUp to true.

Your goal: Test depth, conviction, and ownership. Real interviewers do this — it's not adversarial, it's thorough.

${answerStrength === "strong" ? `The candidate gave a strong answer. RAISE THE BAR:
- "That's impressive. But what if the constraints were different — say, half the budget and twice the timeline pressure?"
- "You mentioned [specific thing]. I'm curious — what was the biggest risk you took, and how did you mitigate it?"
- "If you had to do this again with a completely new team, what would you change?"
- "What's the counterfactual — what would have happened if you hadn't intervened?"` :
`The candidate's answer has gaps. PUSH FOR DEPTH:
- "I hear what you're saying, but walk me through the specific steps you took — not what the team did, what YOU did."
- "That's interesting, but I'm not seeing the numbers. What was the measurable impact?"
- "Let me play devil's advocate — couldn't you have achieved the same thing with [simpler approach]?"
- "What would someone who disagreed with your approach say? How would you respond?"`}

Be conversational but direct. Sound like a senior interviewer at a top Indian product company. 2-3 sentences max.`;
    } else {
      depthInstructions = `This is a PIVOT follow-up (depth 2). You MUST generate a follow-up — set needsFollowUp to true.

Your goal: Pivot to an adjacent competency revealed by the candidate's answer. This tests breadth.

Choose based on what's most relevant to their answer:
- Leadership/influence: "That shows strong execution. How did you bring others along — especially skeptics?"
- Failure/learning: "Every approach has downsides. What didn't go well, and what did you learn?"
- Scale/future: "Now imagine this at 10x scale, or at a company like ${company || "a fast-growing startup"}. What breaks?"
- Cross-functional: "How did you navigate the politics around that decision? Who pushed back?"
- Self-awareness: "What would your manager or skip-level say about how you handled this?"

Be genuinely curious, not interrogative. 2-3 sentences max.`;
    }

    const panelContext = persona ? `\nYou are the "${sanitizeForLLM(persona, 30)}" panelist in a panel interview. Your follow-up should reflect your role's perspective.` : "";

    // Salary context for salary-negotiation follow-ups (prevents losing city-adjusted rates)
    const salaryFollowUpCtx = (type === "salary-negotiation" || type === "hr-round")
      ? `\n${lookupSalaryContext({ role, company, currentCity, jobCity })}\nUse ₹ and LPA. Follow-up offers/counters MUST stay within these ranges.
CRITICAL: You are the HIRING MANAGER making a salary offer. Stay in character — do NOT switch to behavioral interview questions. Your follow-ups must be about compensation, benefits, joining timeline, notice buyout, or counter-offers.

NUMBER DISCIPLINE — non-negotiable rules for every salary follow-up:
  1. NEVER output literal "₹X", "₹Y", "₹Z" or any letter placeholders. The hiring manager always speaks in concrete rupee figures (e.g. ₹28 LPA, ₹2 LPA, ₹1.5 LPA bonus). If you can't pick a number, pick one — but never leak the template letter.
  2. NEVER output unfilled tokens like "joining bonus of ₹X" or "₹Z buyout". Always a specific number.
  3. MATH MUST CHECK OUT. If the candidate said ₹50 LPA and your initial offer was ₹28-45 LPA, ₹50 is ABOVE not below. Read carefully before saying "below" or "above" — ₹50 LPA > ₹45 LPA, period. Ranges work: "below ₹45" / "above ₹45". Don't say "slightly below" of an upper-bound when the candidate's number exceeds it.
  4. NOTICE PERIOD vocabulary: notice periods are "served", "completed", "30 days long", or "60 days remaining". They do NOT "end on a date" — that's an employment end-date, which is different. Use phrasing like "if you can serve a 30-day notice", "if your notice is shorter than 60 days", "we'd want you to start within 45 days of accepting".
  5. RECAPS must include EVERY agreed item with a real number. If joining bonus wasn't agreed yet, don't recap one. If ESOPs weren't discussed, don't recap them. The recap is the agreed package, not a wishlist.`
      : "";

    const prompt = `You are an expert interviewer. Given a candidate's answer to an interview question, decide if a follow-up question is needed.${panelContext}

Interview type: ${sanitizeForLLM(type, 50) || "behavioral"}
Role: ${sanitizeForLLM(role, 100) || "senior role"}${company ? `\nCompany: ${sanitizeForLLM(company, 100)}` : ""}${salaryFollowUpCtx}${jdContext ? `\n${jdContext}` : ""}${resumeSkillsContext ? `\n${resumeSkillsContext}` : ""}${historyContext}

Question asked: "${sanitizeForLLM(question, 500)}"
Candidate's answer: "${sanitizeForLLM(answer, 1000)}"${previousContext}

${depthInstructions}

CANDIDATE-ASKS-BACK DETECTION (reverse interview):
If the candidate's most recent answer ENDS WITH or PRIMARILY CONTAINS a question they're asking YOU (the interviewer) — e.g. "What does success look like in 90 days?", "What's the team like?", "How is performance measured?", "What's one thing you like about working here?" — then your follow-up should ANSWER that question first, IN CHARACTER as the hiring manager / panelist for "${sanitizeForLLM(role, 100) || "this role"}" at ${company ? sanitizeForLLM(company, 100) : "the company"}.

  Rules for answering candidate questions:
   • Stay in character. You ARE the hiring manager — speak as one would on a Zoom call. No meta ("As an AI..."), no apologies for being a simulator.
   • Be plausible and role-and-company-specific. A TCS hiring manager talks about onsite/offshore, structured processes, certifications. A Razorpay PM-hiring-manager talks about UPI volumes, ownership culture, fast iteration. A Google senior eng manager talks about Bayer-style design docs, scope, L4/L5 expectations. Match that texture.
   • DO NOT make up specific numbers (headcount, salary specifics, compensation bands, board-level strategy) the candidate would know are unknowable to a single hiring manager. If they ask one, redirect: "Honestly, that's something I'd want HR / our compensation team to walk you through — I can connect you after this round."
   • Keep it tight: 2-4 sentences. Then add a soft re-pivot: "Anything else, or should we wrap up?" / "Does that help, or do you want me to go deeper on any of it?"
   • If the question is generic ("What's the company culture like?"), give a SPECIFIC honest answer rather than corporate platitudes — name one real thing you like and one thing the company is still working on.

ROLE FENCE (mandatory): The candidate is interviewing for "${sanitizeForLLM(role, 100) || "this role"}". Your follow-up MUST stay within the discipline that role would actually be evaluated on. Specifically:
  • An SEO Content Writer is NOT graded on user-research metrics, product roadmaps, or PM-style hypotheses. Stay on writing craft, content strategy, search intent, brand voice, editorial workflow.
  • A Software Engineer is NOT graded on go-to-market strategy. Stay on system design, code, debugging, trade-offs.
  • A Designer is NOT graded on quarterly OKRs. Stay on craft, user research, design systems, hand-off.
  • If the candidate's answer drifted off-role (e.g. they talked about product strategy in a content-writer round), gently bring it back: "That's interesting — bringing it back to the writing craft itself, what was your editorial process for…"
NEVER ask a follow-up that would only make sense for a different role. If you're tempted to ask about "user metrics" or "scale" for a writing role, stop and reframe.

CROSS-QUESTION MEMORY: If the candidate mentioned something interesting in an earlier answer (visible in the conversation history above), you SHOULD reference it naturally roughly every 3rd question: "Earlier you mentioned X — how does that connect to what you just described?" This makes the interview feel like a real conversation, not a checklist.

PUSHBACK RULE: Real interviewers push back on weak or vague answers — they don't just nod and move on. If the answer is high-level, generic, or lacks specifics (no metrics, no concrete actions, no "I" voice), your follow-up MUST press for specifics ONCE before changing topic. Examples: "That's high-level — what specifically did *you* do?", "Give me a concrete number.", "Walk me through one moment, not the general approach." Do NOT pile on with multiple challenges; one sharp pushback per weak answer.

MIRRORING (rapport): Echo 1-2 distinctive nouns or phrases from the candidate's last answer in your follow-up. If they said "the migration" use "the migration" not "the project". If they said "my team of six" use "your team of six". Research shows verbal mirroring lifts perceived rapport ~30%. Don't be heavy-handed — one or two echoes per follow-up is enough.

ADAPTIVE DIFFICULTY: ${adaptiveDifficulty === "escalate" ? "The candidate is performing strongly across recent answers. Push harder — go deeper, ask more challenging follow-ups, probe for trade-offs and edge cases. Don't go easy." : adaptiveDifficulty === "ease" ? "The candidate is struggling across recent answers. Ease the pressure — phrase the follow-up gently, offer a smaller scope, give them a chance to recover with a more concrete or familiar angle. Do NOT give up; just calibrate down." : "The candidate is performing as expected. Hold steady on difficulty."}
${previousMentions && previousMentions.length > 0 ? `
PREVIOUS MENTIONS (specific things the candidate has said this session — pickable hooks for cross-question references):
${previousMentions.slice(-8).map(p => `  • ${sanitizeForLLM(p, 80)}`).join("\n")}
USAGE: When following up, you may reference one of these explicitly: "Earlier you mentioned <X> — how does that connect to what you just described?" or "You said <X> a moment ago. Tell me more about that." Use at most ONE per follow-up; don't enumerate.
` : ""}
${candidateState ? `
CANDIDATE EMOTIONAL STATE (from recent answers — use this to modulate TONE, not difficulty):
- Stress level: ${candidateState.stress ?? "unknown"} (high = lots of "uhm", "let me think", hesitation markers)
- Engagement: ${candidateState.engagement ?? "unknown"} (fading = answers shrinking; disengaged = very short)
- Filler density: ${(candidateState.fillerDensity ?? 0) * 100}% of words
- Length trend: ${candidateState.lengthTrend ?? "stable"}
TONE GUIDANCE:
${candidateState.stress === "high" ? "- Stress is high. Open with warmth: \"Take your time.\" Use a smaller, more concrete scope. Avoid stacked clauses." : ""}
${candidateState.engagement === "disengaged" ? "- They're checking out. Try a more interesting angle — a hypothetical, a story prompt, or pivot to a new topic entirely. Re-engage, don't drill." : candidateState.engagement === "fading" ? "- Engagement is dropping. Acknowledge the work so far before the follow-up: \"Got it — quick one before we move on.\" Keep it short." : ""}
${candidateState.lengthTrend === "shortening" && candidateState.stress !== "high" ? "- Answers are getting shorter. They might be tired or you've gone too deep on this thread. Pick a fresher angle." : ""}` : ""}

RECOVERY MODE: If the candidate completely bombed the immediate answer (gave up, said 'I don't know', or produced <20 words of substantive content), the next follow-up MUST be a soft recovery offer: rephrase from a smaller angle, give a familiar starter, or pivot to a related topic where they can rebuild confidence. Never stack a hard challenge on top of a fail — that's punitive, not coaching.

QUESTION LENGTH: Mix lengths like a real interviewer. About 30% of follow-ups should be ≤8 words ("So why now?", "And the team's reaction?", "What was the actual number?"). The rest can be longer. Avoid every follow-up being 25+ words — it sounds scripted.

INDIAN INTERVIEWER VOICE: This is a mock for the Indian job market. Speak in natural Indian English. Light fillers like "Got it", "Right right", "One more thing —" are appropriate occasionally — don't overdo. Use ₹ / LPA / CTC, not $ / annual salary. AVOID Americanisms: "awesome", "totally", "reach out", "circle back", "touch base", "let's dive in", "killer", "rockstar". Currency, college tiers (IIT/IIM/NIT), and city references (Bangalore, Hyderabad, Pune, Gurgaon) should feel native, not exotic.

LANGUAGE: Conduct the interview in English only. Do not mix in Hindi or other languages — MVP is English-first. If the candidate uses a non-English word, do not echo it; respond in standard Indian English.

${tierPromptSuffix(classifyCompanyTier(company))}

Respond JSON only:
{"needsFollowUp":true/false,"followUpText":"The follow-up question (2-3 sentences, conversational). Only include if needsFollowUp is true.","followUpType":"${followUpTypeLabel}","reason":"Brief reason"}`;

    // Salary-neg fallback: generate a context-aware response when LLM fails
    // This prevents the static pre-generated script (with wrong numbers) from playing
    const salaryNegFallback = (): Response => {
      const numMatch = answer.match(/₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lakhs|l\b)/i);
      let fallbackText: string;
      if (numMatch) {
        fallbackText = `I hear you — ₹${numMatch[1]} LPA is what you're looking at. Let me see what flexibility I have in the package structure. Can you help me understand what's driving that number — is it based on market data, a competing offer, or your current package progression?`;
      } else if (/\b(accept|sounds good|that works|deal|agreed|fine with me|okay|ok|sure|yes)\b/i.test(answer) && !/\b(but|however|only if|unless)\b/i.test(answer)) {
        fallbackText = `That's great to hear! I'm glad we could find something that works. Let me put together the final numbers and have HR send you the formal offer letter. What's your notice period situation?`;
      } else if (/\b(too low|not enough|can.?t accept|not acceptable|walk away|not interested)\b/i.test(answer)) {
        fallbackText = `I hear your concern, and I appreciate you being direct. Help me understand — what range would work for you? I want to see if there's a way to bridge the gap.`;
      } else {
        fallbackText = `I appreciate you sharing that. What's most important to you in this package — is it the base number, the overall CTC, or are there specific benefits that would move the needle for you?`;
      }
      return new Response(JSON.stringify({ needsFollowUp: true, followUpText: fallbackText, followUpType: "negotiation_response" }), { status: 200, headers });
    };

    let result: { text: string };
    try {
      result = await callLLM({ prompt, temperature: 0.3, maxTokens: 500, jsonMode: true, fast: true }, 12000, { userId: auth.userId, endpoint: "follow-up" });
    } catch (llmErr) {
      console.error("Follow-up LLM call failed:", llmErr);
      if (isSalaryNeg) return salaryNegFallback();
      return new Response(JSON.stringify({ needsFollowUp: false, error: "LLM call failed" }), { status: 502, headers });
    }
    const parsed = extractJSON<{ needsFollowUp?: boolean; followUpText?: string; followUpType?: string }>(result.text);
    if (!parsed || typeof parsed !== "object") {
      if (isSalaryNeg) return salaryNegFallback();
      return new Response(JSON.stringify({ needsFollowUp: false, error: "LLM response parsing failed" }), { status: 502, headers });
    }
    // Sanitize LLM response fields
    if (typeof parsed.followUpText !== "string") parsed.followUpText = "";
    if (typeof parsed.needsFollowUp !== "boolean") parsed.needsFollowUp = false;

    // Salary hallucination guard: clamp any salary numbers in LLM response to negotiation band limits
    if (isSalaryNeg && negotiationBand && parsed.followUpText) {
      const offerNumRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs|Cr|cr|crore)/g;
      let match: RegExpExecArray | null;
      let clamped = parsed.followUpText;
      const approvalRe = /\b(approval|leadership|sign.?off|check with|go back to)\b/i;
      while ((match = offerNumRe.exec(parsed.followUpText)) !== null) {
        const rawNum = parseFloat(match[1]);
        // Convert Crore to LPA (1 Cr = 100 LPA)
        const isCrore = /cr|crore/i.test(match[0]);
        const num = isCrore ? rawNum * 100 : rawNum;
        if (num > negotiationBand.maxStretch * 1.05) {
          // LLM hallucinated well above max stretch — clamp to maxStretch
          // If LLM already included approval language, just fix the number.
          // If not, the text may sound inconsistent after clamping — add approval framing.
          console.warn(`[follow-up] LLM offered ₹${num} LPA, above maxStretch ₹${negotiationBand.maxStretch} — clamping`);
          clamped = clamped.replace(match[0], `₹${negotiationBand.maxStretch} LPA`);
          if (!approvalRe.test(clamped)) {
            // Inject approval framing since the clamped number IS the ceiling
            clamped = clamped.replace(
              `₹${negotiationBand.maxStretch} LPA`,
              `₹${negotiationBand.maxStretch} LPA — that's the absolute top of what I can approve`,
            );
          }
        } else if (num > negotiationBand.maxStretch && !approvalRe.test(clamped)) {
          // Between maxStretch and 1.05x — within tolerance but add approval framing
          console.warn(`[follow-up] LLM offered ₹${num} LPA near maxStretch ₹${negotiationBand.maxStretch} — adding approval context`);
          clamped = clamped.replace(match[0], `${match[0]}, which I'd need leadership sign-off for,`);
        } else if (num < negotiationBand.walkAway) {
          // LLM offered below walk-away — clamp to the canonical initial offer
          // (the value actually presented in turn 1, not the band's seed).
          const clampTo = canonicalInitialOffer ?? negotiationBand.initialOffer;
          console.warn(`[follow-up] LLM offered ₹${num} LPA, below walkAway ₹${negotiationBand.walkAway} — clamping to ₹${clampTo}`);
          clamped = clamped.replace(match[0], `₹${clampTo} LPA`);
        }
      }
      // Monotonic enforcement: no offer can go below the highest previous offer
      // Fixed: removed the `>= walkAway` condition that created a loophole allowing regressions
      // between highestOfferMade and walkAway. Now ALL numbers below highestOffer get clamped.
      if (highestOfferMade && highestOfferMade > 0) {
        const monoRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs)/g;
        let monoMatch: RegExpExecArray | null;
        // Collect all offer numbers to check total CTC monotonicity
        const allOfferNums: number[] = [];
        const tempStr = clamped;
        let tempMatch: RegExpExecArray | null;
        const tempRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs)/g;
        while ((tempMatch = tempRe.exec(tempStr)) !== null) {
          allOfferNums.push(parseFloat(tempMatch[1]));
        }
        // If the MAX number in the response (proxy for total CTC) is still >= highestOfferMade,
        // only clamp individual components that look like the "main" offer (the largest number).
        // Otherwise, clamp all sub-highestOffer numbers unconditionally.
        const maxOfferedInResponse = allOfferNums.length > 0 ? Math.max(...allOfferNums) : 0;
        const totalCTCMaintained = maxOfferedInResponse >= highestOfferMade;
        while ((monoMatch = monoRe.exec(clamped)) !== null) {
          const monoNum = parseFloat(monoMatch[1]);
          // Skip numbers that are clearly not offer amounts (e.g., "₹2 LPA learning budget")
          const isSmallComponent = monoNum < highestOfferMade * 0.3;
          if (monoNum < highestOfferMade && !isSmallComponent && !totalCTCMaintained) {
            console.warn(`[follow-up] Monotonic violation: ₹${monoNum} < previous highest ₹${highestOfferMade} — clamping`);
            clamped = clamped.replace(monoMatch[0], `₹${highestOfferMade} LPA`);
          }
        }
      }
      // Cost-saving guard: if candidate stated a target, clamp offers that exceed it
      // A real hiring manager would NEVER offer more than what the candidate asked for
      if (candidateTarget && candidateTarget > 0) {
        const costRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs)/g;
        let costMatch: RegExpExecArray | null;
        while ((costMatch = costRe.exec(clamped)) !== null) {
          const costNum = parseFloat(costMatch[1]);
          // If this is clearly the "main" offer number (not a small component like bonus)
          const isMainOffer = costNum > candidateTarget * 0.5;
          if (costNum > candidateTarget && isMainOffer) {
            // Calculate a realistic counter: partway between initial offer and candidate's target
            const realisticCounter = Math.round(
              (negotiationBand.initialOffer + candidateTarget) / 2 * 10,
            ) / 10;
            const clampedVal = Math.max(realisticCounter, highestOfferMade || negotiationBand.initialOffer);
            console.warn(`[follow-up] Cost guard: ₹${costNum} exceeds candidate target ₹${candidateTarget} — clamping to ₹${clampedVal}`);
            clamped = clamped.replace(costMatch[0], `₹${clampedVal} LPA`);
          }
        }
      }
      // Final pass: catch the "above our initial offer of ₹X LPA" pattern
      // where X drifted from the actual presented anchor. Replace any
      // "initial offer of ₹N LPA" with the canonical anchor.
      // Also catch "₹A — which is ₹B above our initial offer of ₹C" where
      // B is the delta (A - canonicalInitialOffer); LLMs frequently get
      // this arithmetic wrong (the user-reported "29.6 above offer of 29.6"
      // bug). Recompute B from A and the canonical anchor.
      if (canonicalInitialOffer !== null) {
        /* Bug A fix — broader sweep. The previous regex caught "initial
           offer of ₹N LPA" but missed "revisit our initial offer of
           ₹N LPA base", "the initial offer was ₹N", and "our initial
           offer of ₹N (base|total)". The new regex matches any
           initial/original/starting/opening offer prefix followed by
           a number and an LPA-family suffix, optionally with "base /
           total / CTC" trailing words — and rewrites the number to
           the canonical anchor. */
        clamped = clamped.replace(
          /((?:revisit\s+(?:our|the)\s+|come\s+back\s+to\s+(?:our|the)\s+|our\s+|the\s+|my\s+)?(?:initial|original|starting|opening)\s+offer\s+(?:of|was|is|stood\s+at)\s+)₹\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crore)(\s+(?:base|total|CTC|fixed))?/gi,
          (_full, prefix, trailer) => `${prefix}₹${canonicalInitialOffer} LPA${trailer || ""}`,
        );
        /* Also catch the bare "our offer of ₹N" / "starting offer of
           ₹N" prefix without the "initial" anchor word — these are
           still references to the opening anchor. */
        clamped = clamped.replace(
          /(our\s+offer\s+of\s+|original\s+offer\s+of\s+|starting\s+offer\s+of\s+)₹\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakh|lakhs)/gi,
          (_full, prefix) => `${prefix}₹${canonicalInitialOffer} LPA`,
        );
        // Recompute the "₹A — that's ₹B above our initial offer of ₹C" delta.
        clamped = clamped.replace(
          /₹\s*(\d+(?:\.\d+)?)\s*LPA([^.]*?)which is\s+₹\s*(\d+(?:\.\d+)?)\s*LPA\s+above\s+our\s+(initial|original|starting)\s+offer\s+of\s+₹\s*(\d+(?:\.\d+)?)\s*LPA/gi,
          (_full, hi, mid, _delta, kind, _anchor) => {
            const top = parseFloat(hi);
            const realDelta = Math.round((top - canonicalInitialOffer) * 10) / 10;
            return `₹${top} LPA${mid}which is ₹${realDelta} LPA above our ${kind} offer of ₹${canonicalInitialOffer} LPA`;
          },
        );
      }
      // Echo-verification guard: when the LLM paraphrases the candidate's
      // own stated number ("I understand you're asking for ₹X"), it must
      // match what the candidate actually said. The user-reported bug
      // where "50 lakhs" became "5 lakhs" was a digit-drop in this echo.
      // Scan the candidate's most recent turn for a target number and
      // patch any obvious mis-echo in the LLM's reply.
      const candTargetRe = /(\d+(?:\.\d+)?)\s*(lakhs?|lpa|l\b|crore|cr)/gi;
      let lastCandNum: number | null = null;
      let lastCandLabel: "LPA" | "Cr" = "LPA";
      let cm: RegExpExecArray | null;
      candTargetRe.lastIndex = 0;
      while ((cm = candTargetRe.exec(answer || "")) !== null) {
        const v = parseFloat(cm[1]);
        const isCrore = /cr|crore/i.test(cm[2]);
        if (Number.isFinite(v) && v > 0) {
          lastCandNum = isCrore ? v * 100 : v;
          lastCandLabel = isCrore ? "Cr" : "LPA";
        }
      }
      if (lastCandNum !== null && clamped) {
        // Look for "you're asking for ₹X" or "you mentioned ₹X" patterns
        // where X is wildly different from the candidate's stated number.
        const echoRe = /(asking for|requesting|mentioned|you said|targeting)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore|l\b)/gi;
        let em: RegExpExecArray | null;
        while ((em = echoRe.exec(clamped)) !== null) {
          const echoed = parseFloat(em[2]);
          // 10x off (digit-drop or digit-add) is the obvious failure mode
          if (echoed > 0 && (echoed * 10 === lastCandNum || echoed / 10 === lastCandNum)) {
            console.warn(`[follow-up] Echo mismatch: candidate said ${lastCandNum}, LLM echoed ${echoed} — patching`);
            const replacement = em[0].replace(
              /(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore|l\b)/i,
              `₹${lastCandNum} ${lastCandLabel}`,
            );
            clamped = clamped.replace(em[0], replacement);
          }
        }
      }

      /* Bug E fix — Target-echo binding. The user-reported session
         showed: user said "12 lakhs", AI replied "I heard ₹12 from
         you ... what's driving your target of ₹8.5 LPA?" — relabeling
         the candidate's target as a different number (likely confusing
         it with the AI's intended counter-offer). The pattern "your
         target of ₹N" / "the candidate's target of ₹N" / "you're
         looking for ₹N" must always cite the canonical candidateTarget
         (the engine-tracked number, more reliable than the last-turn
         parse since the candidate may have stated their target in an
         earlier turn). Patch any drift. */
      if (candidateTarget && candidateTarget > 0 && clamped) {
        /* Round-3 expansion: the previous regex caught "your target of
           ₹N" / "you're looking for ₹N" but missed the most common
           drift pattern — "I heard ₹N from you" / "you mentioned ₹N" /
           "your expectation of ₹N" / "you said ₹N". User reported a
           session where they said 48 LPA and the AI replied "I heard
           ₹38 LPA from you" — the new patterns below catch this. */
        const targetEchoRe = /((?:your|the\s+candidate'?s?|their)\s+(?:target|expectation|ask|number|figure|ballpark)(?:\s+of)?|(?:i\s+)?heard\s+(?:you\s+say\s+)?(?:₹?\s*)?(?=\d)|you\s+mentioned|you\s+said|you\s+stated|you\s+shared|you\s+told\s+me|you\s+gave\s+me|you'?re\s+(?:looking\s+for|asking\s+for|targeting|aiming\s+for|hoping\s+for|expecting)|you\s+(?:want|need|expect))\s+(?:a\s+(?:salary|target|number|figure|package)\s+of\s+)?(?:around\s+|about\s+|roughly\s+|approximately\s+|from\s+you\s+)?₹?\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?|cr|crore)/gi;
        let teMatch: RegExpExecArray | null;
        while ((teMatch = targetEchoRe.exec(clamped)) !== null) {
          const echoedTarget = parseFloat(teMatch[2]);
          if (!Number.isFinite(echoedTarget) || echoedTarget <= 0) continue;
          // If the echoed value matches the AI's OWN offer AND the
          // candidate stated a different number, this is a speaker-
          // confusion bug — the AI is telling the candidate "I heard
          // ₹18 from you" when ₹18 was the AI's offer. Patch with the
          // candidate's real ask. (We only skip when there's no better
          // value to substitute — i.e. candidate's target is unknown
          // OR matches the offer too.)
          const matchesOwnOffer =
            (canonicalInitialOffer !== null && Math.abs(echoedTarget - canonicalInitialOffer) < 0.5) ||
            (typeof highestOfferMade === "number" && Math.abs(echoedTarget - highestOfferMade) < 0.5);
          const haveDifferentCandidateTarget =
            candidateTarget !== null &&
            Math.abs(echoedTarget - candidateTarget) > 0.5;
          if (matchesOwnOffer && !haveDifferentCandidateTarget) continue;
          // Tolerance: 0.5 LPA — anything further off is a misattribution.
          if (Math.abs(echoedTarget - candidateTarget) > 0.5) {
            console.warn(`[follow-up] Target echo mismatch: candidate target=${candidateTarget}, AI echoed as ${echoedTarget} — patching`);
            const fixed = teMatch[0].replace(
              /₹?\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crore)/i,
              `₹${candidateTarget} LPA`,
            );
            clamped = clamped.replace(teMatch[0], fixed);
            // Reset the regex's lastIndex so we don't skip overlapping matches
            targetEchoRe.lastIndex = 0;
          }
        }
      }

      /* Bug D fix — Component-sum validator. The user-reported session
         showed: "the offer at ₹8.5 LPA total compensation, comprising
         ₹8.5 LPA base, ₹8.5 LPA variable pay, and a ₹8.5 LPA joining
         bonus" — total 8.5 but components sum to 25.5. The LLM fell
         into a token-fill loop, slotting the same number into every
         component slot. Symptoms: (a) all three components numerically
         identical, (b) sum >5% off from total. Either case is a
         catastrophic dishonesty bug — patch by recomposing components
         to a realistic 78/15/7 split that sums correctly. */
      const breakdownRe = /(₹\s*(\d+(?:\.\d+)?)\s*LPA[^.?!]*?(?:total\s+(?:compensation|CTC|package)?|in\s+total|all\s+up)[^.?!]*?(?:comprising|including|consisting\s+of|made\s+up\s+of|broken\s+down\s+(?:as|into)|with\s+a\s+breakdown\s+of)[^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+base([^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+variable(?:\s+pay)?([^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+(?:joining\s+)?bonus/gi;
      clamped = clamped.replace(breakdownRe, (full, prefix, totalStr, baseStr, midA, varStr, midB, bonusStr) => {
        const total = parseFloat(totalStr);
        const base = parseFloat(baseStr);
        const variable = parseFloat(varStr);
        const bonus = parseFloat(bonusStr);
        if (![total, base, variable, bonus].every((n) => Number.isFinite(n) && n > 0)) return full;
        const sum = base + variable + bonus;
        const allEqual = base === variable && variable === bonus;
        const sumWayOff = Math.abs(sum - total) > Math.max(0.5, total * 0.05);
        if (allEqual || sumWayOff) {
          // 78/15/7 split — realistic for Indian tech CTCs at the
          // junior-to-mid level. Bonus may be 0 if total is small.
          const newBase = Math.round(total * 0.78 * 10) / 10;
          const newVar = Math.round(total * 0.15 * 10) / 10;
          const newBonus = Math.round((total - newBase - newVar) * 10) / 10;
          console.warn(`[follow-up] Component-sum bug: total=${total}, components=${base}/${variable}/${bonus} — recomposing to ${newBase}/${newVar}/${newBonus}`);
          return `${prefix}₹${newBase} LPA base${midA}₹${newVar} LPA variable${midB}₹${newBonus} LPA joining bonus`;
        }
        return full;
      });

      parsed.followUpText = clamped;

      /* Notice-buyout sanity cap. Real-world bug: LLM produced
         "I'll add a ₹18 LPA buyout bonus for joining within 30" —
         using the full annual CTC as a notice buyout. A notice
         buyout is (notice_days ÷ 30) × monthly_base × ~1.5x, almost
         always ₹1–3 LPA. Anything ≥ ₹5 LPA in a buyout phrase is
         the model misreading "X" as the offer total. Cap to ₹1.5. */
      const buyoutCapRe = /(buyout(?:\s+bonus)?|joining\s+within\s+30)/i;
      parsed.followUpText = parsed.followUpText.replace(
        /₹\s*(\d+(?:\.\d+)?)\s*(LPA|lpa|lakhs?)\s*(buyout(?:\s+bonus)?)/gi,
        (full: string, amtStr: string, unit: string, label: string) => {
          const amt = parseFloat(amtStr);
          if (Number.isFinite(amt) && amt >= 5) {
            console.warn(`[follow-up] Buyout cap: ${amt} ${unit} → 1.5 LPA (label="${label}")`);
            return `₹1.5 ${unit} ${label}`;
          }
          return full;
        },
      );
      // Also catch the inverted phrasing: "buyout … of ₹X LPA"
      parsed.followUpText = parsed.followUpText.replace(
        /(buyout(?:\s+bonus)?\s+(?:of|for|at)?\s*)₹\s*(\d+(?:\.\d+)?)\s*(LPA|lpa|lakhs?)/gi,
        (full: string, lead: string, amtStr: string, unit: string) => {
          const amt = parseFloat(amtStr);
          if (Number.isFinite(amt) && amt >= 5) {
            console.warn(`[follow-up] Buyout cap (inverted): ${amt} ${unit} → 1.5 LPA`);
            return `${lead}₹1.5 ${unit}`;
          }
          return full;
        },
      );
      void buyoutCapRe;

      /* Counter-offer enforcement. If the phase is counter-offer (we
         have a candidate number + we're past idx 1) AND the LLM
         response contains NO ₹ figure at all, the model probed
         instead of countering. Substitute a deterministic counter
         pulled from the band so the user sees an actual move. The
         user-visible failure mode this fixes: 5-turn sessions where
         the AI never counters with numbers despite the candidate
         having stated their target + market data. */
      /* Repetition guard. If the next AI question is too similar to a
         recent AI turn, the candidate experiences "you keep asking
         the same thing" — exactly the failure mode in the Lollypop
         session ("Mentioned multiple times"). Compute Jaccard
         similarity over content words against the last 2 AI turns.
         If above threshold, pivot deterministically: acknowledge,
         then make a concrete move (counter or close) instead of
         re-asking. */
      if (parsed.followUpText && previousFollowUps && previousFollowUps.length > 0) {
        const tokens = (s: string): Set<string> => {
          const stop = new Set(["the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for","and","or","but","with","what","how","do","does","can","could","would","should","let","me","just","me","in","on","at","by","as","so","if","like","than","then","its","it"]);
          return new Set(
            s.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
              .filter(w => w.length > 3 && !stop.has(w)),
          );
        };
        const cur = tokens(parsed.followUpText);
        const recent = previousFollowUps.slice(-2);
        let maxSim = 0;
        for (const prev of recent) {
          const prevT = tokens(prev);
          if (cur.size === 0 || prevT.size === 0) continue;
          let inter = 0;
          for (const w of cur) if (prevT.has(w)) inter++;
          const union = cur.size + prevT.size - inter;
          const sim = union > 0 ? inter / union : 0;
          if (sim > maxSim) maxSim = sim;
        }
        if (maxSim >= 0.55) {
          console.warn(`[follow-up] Repetition guard fired: similarity=${maxSim.toFixed(2)} — replacing with progress move`);
          const candidateNum =
            (typeof candidateTarget === "number" && candidateTarget > 0)
              ? candidateTarget
              : (negotiationFacts?.candidateCounter
                ? parseFloat(negotiationFacts.candidateCounter.replace(/[^\d.]/g, "")) || null
                : null);
          if (negotiationBand && typeof candidateNum === "number") {
            const initial = canonicalInitialOffer ?? negotiationBand.initialOffer;
            const hi = Math.min(negotiationBand.maxStretch, initial + Math.max(1, (candidateNum - initial) * 0.5));
            const counter = Math.round(hi * 10) / 10;
            parsed.followUpText = `You're right, you've already shared that — apologies for re-asking. Let me make a concrete move: I can stretch to ₹${counter} LPA total CTC. That bumps base, keeps the variable structure, and includes our standard benefits. Does that get us closer to a yes, or is there a specific lever you want me to pull instead?`;
          } else {
            parsed.followUpText = `You're right, I've been circling — apologies. Let me be straight: I've shared where I can land today. If the package doesn't work, I'd rather know now than keep asking the same question. What would actually move you to yes?`;
          }
        }
      }

      if (salaryPhase === "counter-offer" && parsed.followUpText) {
        const hasRupee = /₹\s*\d/.test(parsed.followUpText);
        if (!hasRupee && negotiationBand) {
          const initial = canonicalInitialOffer ?? negotiationBand.initialOffer;
          const targetN =
            (typeof candidateTarget === "number" && candidateTarget > 0)
              ? candidateTarget
              : (negotiationFacts?.candidateCounter
                ? parseFloat(negotiationFacts.candidateCounter.replace(/[^\d.]/g, ""))
                : null);
          // Counter PARTWAY: split the difference, weighted toward our
          // anchor, capped by maxStretch / minOffer so we never invent
          // an out-of-band number.
          const lo = initial;
          const hi = Math.min(negotiationBand.maxStretch, Math.max(lo + 0.5, lo + 1));
          let counter = (typeof targetN === "number" && Number.isFinite(targetN) && targetN > lo)
            ? Math.min(hi, lo + (targetN - lo) * 0.45)
            : Math.min(hi, lo + 1);
          counter = Math.round(counter * 10) / 10;
          const acknowledgement =
            (typeof targetN === "number" && Number.isFinite(targetN))
              ? `You're at ₹${targetN} LPA, I'm at ₹${initial} LPA — let me close some of that gap. `
              : "";
          parsed.followUpText = `${acknowledgement}I can stretch to ₹${counter} LPA total CTC for this role. Where I'd land that: bump base by the difference, keep the variable structure, and I'll throw in our standard benefits. Does that move us closer to a yes, or is there a specific lever you'd want me to revisit?`;
          console.warn(`[follow-up] Counter-offer enforcement fired: substituted deterministic counter at ₹${counter} LPA (no ₹ in LLM output during counter-offer phase)`);
        }
      }
    }

    // Intent-mismatch validator: catch cases where LLM ignores the detected intent
    if (isSalaryNeg && parsed.followUpText) {
      /* Last-resort placeholder scrubber. Despite the explicit prompt
         rule "never write ₹X/₹Y/₹Z", LLMs occasionally still copy a
         literal placeholder into the output (user-reported: closing
         step said "joining bonus of ₹X"). Strip any ₹<single-letter>
         token by deleting the trailing clause that contains it — that
         clause was meant to hold a real figure but didn't, and
         showing the placeholder is worse than dropping the sentence.
         Also catches "[amount]" / "[number]" / "₹TBD". */
      const placeholderRe = /(?:[,;.\s]+)?\b(?:and\s+)?(?:[^.,;]*?(?:₹\s*[XYZWV]\b|\bTBD\b|\[amount\]|\[number\]|\[\.\.\.\])[^.,;]*?)([.,;])/gi;
      const before = parsed.followUpText;
      parsed.followUpText = parsed.followUpText.replace(placeholderRe, "$1");
      // If a fragment couldn't be cleanly excised, fall back to a
      // plain replacement that drops the placeholder token itself.
      parsed.followUpText = parsed.followUpText.replace(/₹\s*[XYZWV]\b\s*(LPA|lpa|lakhs?|cr|crore)?/g, "[figure pending]");
      parsed.followUpText = parsed.followUpText.replace(/\bTBD\b|\[amount\]|\[number\]|\[\.\.\.\]/gi, "[figure pending]");
      if (before !== parsed.followUpText) {
        console.warn("[follow-up] scrubbed ₹X-style placeholder from salary-neg output");
      }

      const text = parsed.followUpText.toLowerCase();
      const counterOfferPat = /how about|what if I offer|counter.*with|we could do|let me offer/i;
      // Re-detect intent here since the original detection is block-scoped
      const acceptRe = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|it.?s a deal|i.?m happy with|fine with me|i agree|agreed|let.?s go ahead)\b/i;
      const walkRe = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline the offer|i decline|pull out|not worth|won.?t work|move on|have to pass)\b/i;
      const hedgeRe = /\b(but|however|only if|unless|provided|on condition|contingent|except|though)\b/i;
      const didAccept = acceptRe.test(answer) && !hedgeRe.test(answer.slice(answer.search(acceptRe)));
      const didWalkAway = walkRe.test(answer) && !acceptRe.test(answer);
      if (didAccept && counterOfferPat.test(parsed.followUpText)) {
        // LLM is counter-offering when candidate already accepted — reject and signal fallback
        console.warn("[follow-up] Intent mismatch: candidate accepted but LLM counter-offered — rejecting");
        parsed.needsFollowUp = false;
      } else if (didWalkAway && /congratulations|glad you accepted|welcome aboard/i.test(text)) {
        // LLM is congratulating when candidate is walking away — reject
        console.warn("[follow-up] Intent mismatch: candidate walking away but LLM congratulated — rejecting");
        parsed.needsFollowUp = false;
      } else if (parsed.followUpText.length < 30) {
        // Response too short to be meaningful — reject
        console.warn("[follow-up] Response too short (<30 chars) — rejecting");
        parsed.needsFollowUp = false;
      }
    }

    // Salary-negotiation: continue the conversation, but allow early close if candidate accepted
    // and we're past the initial offer phase (don't force 5 more turns after "I accept")
    const candidateAcceptedEarly = isSalaryNeg && negotiationFacts?.acceptedImmediately
      && (questionIndex ?? 0) >= 2; // past the first question
    const needsFollowUp = isSalaryNeg
      ? (candidateAcceptedEarly ? !!parsed.needsFollowUp : true)
      : (safeDepth >= 1 ? true : !!parsed.needsFollowUp);

    return new Response(JSON.stringify({
      needsFollowUp,
      followUpText: parsed.followUpText || "",
      followUpType: followUpTypeLabel,
      persona: persona ? ({"hiring manager": "Hiring Manager", "technical lead": "Technical Lead", "hr partner": "HR Partner"} as Record<string, string>)[persona.toLowerCase()] || persona : undefined,
    }), { status: 200, headers });
  } catch (err) {
    console.error("Follow-up generation error:", err);
    // Return needsFollowUp: false so the interview continues, but use 502 status
    // so client-side can distinguish between "no follow-up needed" and "error occurred"
    return new Response(JSON.stringify({ needsFollowUp: false, error: "Follow-up generation failed" }), { status: 502, headers });
  }
}
