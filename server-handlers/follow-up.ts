/* Vercel Edge Function — Dynamic Follow-Up Question Generation */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, sanitizeForLLM, validateContentType } from "./_shared";
import { captureServerEvent, distinctIdFrom } from "./_posthog";
import { detectSalaryPhase as detectSalaryPhaseHelper, pickServerCounter, pickNextMove } from "./_follow-up-helpers";
import { deriveConvState, phaseForState, type ConvState } from "./_negotiation-state";
import { detectAllFailures } from "./_negotiation-failures";
import { callLLM, extractJSON } from "./_llm";
import { detectCandidateIntent, extractCandidateSalaryNumber, extractMirrorTokens } from "./_follow-up-helpers";
import { classifyCompanyTier, tierPromptSuffix } from "./_company-tier";
import { lookupSalaryContext, getNegotiationStyleContext, INDUSTRY_PACKAGE_CONTEXT, generateNegotiationBand, type NegotiationStyle } from "../data/salary-lookup";
import { classifyBehavioralQuestion, frameworkDirective as frameworkDirectiveFor } from "../src/_question-category";
import { detectCulturalRegister, hasAnyIndianRegister } from "../src/_cultural-register";

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
    const { question, answer, type, role, jobDescription, company, currentCity, jobCity, followUpDepth = 0, adaptiveDifficulty, previousFollowUps, persona, conversationHistory, negotiationPhase, questionIndex, totalQuestions, resumeTopSkills, initialOfferText, negotiationFacts, negotiationStyle, negotiationBand: clientNegotiationBand, industry, highestOfferMade, candidateTarget, negotiationScenario, candidateState, previousMentions, personaTrait, candidateWalkAway: prepWalkAway, candidateCompetingOffer: prepCompetingOffer, starGap, weHeavy } = await req.json() as {
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
        competingOfferAmount?: string;
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
      personaTrait?: string;
      candidateWalkAway?: number;
      candidateCompetingOffer?: number;
      starGap?: "action" | "result" | "situation-task";
      weHeavy?: boolean;
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

    // Non-answer short-circuit. When the candidate says "I don't have
    // experience with that" / "not sure" / "haven't faced anything like
    // this", piling a follow-up that asks for more context is punitive.
    // Hand back a soft pivot instead — a hypothetical or an adjacent
    // situation — without asking for impossible detail. This runs BEFORE
    // the LLM call so we save tokens too.
    const isSalaryNegEarly = type === "salary-negotiation";
    const nonAnswerLower = answer.toLowerCase();
    const isExplicitNonAnswer =
      !isSalaryNegEarly && answer.trim().split(/\s+/).length <= 60 && (
        /\b(?:i\s+)?(?:do\s+not|don'?t|have\s+not|haven'?t)\s+(?:have|got)\s+(?:any\s+)?(?:experience|exposure|example)/.test(nonAnswerLower) ||
        /\b(?:no|zero|never\s+had)\s+(?:real\s+)?experience\b/.test(nonAnswerLower) ||
        /\b(?:have\s+not|haven'?t|never)\s+faced\b/.test(nonAnswerLower) ||
        /\bnever\s+(?:done|encountered|been\s+in)\b/.test(nonAnswerLower) ||
        /\b(?:can'?t|cannot|could\s*not|couldn'?t)\s+(?:think|recall|remember)\s+(?:of\s+)?(?:any|a\s+specific|one)\b/.test(nonAnswerLower) ||
        /\bnothing\s+comes\s+to\s+mind\b/.test(nonAnswerLower) ||
        /\bnot\s+(?:really\s+|100%?\s+|entirely\s+|quite\s+)?sure\b.*\b(?:about|on)\s+(?:it|this|that|the)\b/.test(nonAnswerLower)
      );
    if (isExplicitNonAnswer) {
      // Map question intent → tailored hypothetical pivot. Generic "imagine
      // that situation" works, but a probe that mirrors the original
      // question's topic (conflict, failure, leadership, ambiguity) lands
      // closer to what the interviewer was actually testing.
      const qLower = (question || "").toLowerCase();
      let pivotText: string;
      if (/conflict|disagree|argument|tension|push\s*back/.test(qLower)) {
        pivotText = "Fair enough — let's make it hypothetical. A teammate strongly disagrees with your approach in a meeting tomorrow. Walk me through how you'd handle that conversation in real time.";
      } else if (/fail(?:ure|ed)|mistake|went\s+wrong|setback/.test(qLower)) {
        pivotText = "No problem — let's flip it forward. Imagine you ship something next month and it lands flat. What's the first thing you'd do once you realise it isn't working, and how would you talk about it with your team?";
      } else if (/leader|lead\s+a|manage|managed|mentored|mentor/.test(qLower)) {
        pivotText = "That's fine — let's run a hypothetical. You're handed a small team tomorrow and one person is clearly disengaged. What's your first week look like?";
      } else if (/ambig|unclear|uncertain|incomplete\s+(?:data|info)|without\s+(?:clear|enough)/.test(qLower)) {
        pivotText = "Got it — let's make it hypothetical. You're handed a problem with very little information and a tight deadline. Walk me through how you'd structure your first 24 hours on it.";
      } else if (/stake\s*holder|cross[\s-]?functional|alignment|buy[\s-]?in/.test(qLower)) {
        pivotText = "That's okay — imagine this: you have a strong recommendation but a senior stakeholder is leaning the other way. How would you build the case and run that conversation?";
      } else if (/priorit|trade[\s-]?off|deadline|under\s+pressure|time\s+constraint/.test(qLower)) {
        pivotText = "Fair — let's hypothetical it. You wake up tomorrow with three urgent things on your plate and only time for two. Talk me through how you'd decide.";
      } else if (/feedback|criticism|review|growth/.test(qLower)) {
        pivotText = "Okay — imagine this. You get sharp critical feedback in a review next week that you weren't expecting. What's your first move, and how do you act on it over the next month?";
      } else {
        pivotText = "That's fair — let's flip it to a hypothetical. Imagine you walk into that situation tomorrow: how would you approach it? Even a rough first move helps me see your thinking.";
      }
      return new Response(JSON.stringify({
        needsFollowUp: true,
        followUpText: pivotText,
        followUpType: "non_answer_pivot",
      }), { status: 200, headers });
    }

    // Detect weak answers that warrant follow-up
    const wordCount = answer.trim().split(/\s+/).length;
    const hasMetrics = /\d+%|\$\d|[0-9]+x|[0-9]+ (users|customers|engineers|people|team|million|billion)/i.test(answer);
    const hasPassiveVoice = /(was done|were made|it was|has been|got done|we had)/i.test(answer);
    const lacksFirstPerson = !(/ I /i.test(answer) || /^I /i.test(answer));
    const isShort = wordCount < 40;

    // Tense detection: when the candidate describes a project that hasn't
    // launched / shipped / been measured yet ("we are planning", "the idea
    // is to", "we will", "haven't launched yet"), retro-impact probes like
    // "what was the result?" or "how did you measure impact?" misfire —
    // there ARE no results yet. Switch to prospective probes instead.
    const planStageRe = /\b(?:we are|i am|we'?re|i'?m)\s+(?:still\s+)?(?:planning|designing|building|prototyping|working\s+on|in\s+the\s+process)\b|\bhaven'?t\s+(?:launched|shipped|rolled\s+out|gone\s+live|released)\b|\bnot\s+(?:yet\s+)?(?:launched|shipped|live|in\s+production)\b|\bhasn'?t\s+(?:gone\s+live|launched|shipped)\b|\bthe\s+idea\s+is\s+to\b|\bin\s+the\s+(?:planning|design|prototype|concept)\s+(?:phase|stage)\b|\bpre[\s-]?launch\b|\bbefore\s+launch\b/i;
    // Anti-false-positive: if the answer also contains clear past-tense
    // shipping markers ("we launched", "we shipped", "after release"), the
    // candidate is describing completed work that incidentally mentions
    // future plans — don't suppress retro-impact probes in that case.
    const hasPastShipMarkers = /\b(?:we|i|the\s+team)\s+(?:launched|shipped|rolled\s+out|released|deployed|went\s+live|delivered)\b|\bafter\s+(?:launch|release|shipping|going\s+live)\b|\bonce\s+(?:we|it)\s+(?:launched|shipped|went\s+live)\b/i.test(answer);
    const isPlanStage = planStageRe.test(answer) && !hasPastShipMarkers;
    const tenseDirective = isPlanStage
      ? `\nTENSE-AWARE PROBE (mandatory): The candidate's answer describes work that has NOT yet launched or been measured. Do NOT ask retro-impact questions ("what was the result", "how did you measure impact", "what changed after"). Instead, ask PROSPECTIVE probes: "what metrics would you track to know this worked?", "what's your biggest risk going in?", "what would you measure in week one?", "how will you know you got it right?". Asking for results that don't exist yet feels punitive and ignores what they actually said.`
      : "";

    /* Mirroring grounding: extract the candidate's most distinctive
       content nouns/phrases and surface them in the prompt so the LLM
       has concrete words to echo. Without this, "MIRRORING (rapport)"
       was a vague rule the LLM frequently ignored. We pull words ≥4 chars
       that aren't in our stoplist, count frequency, and take the top 5
       (capitalized words win ties — they tend to be proper nouns like
       Stripe, Razorpay, Figma, Q3). Phrase bigrams with "the" / "my" /
       "our" prefix are kept verbatim because they're the most echo-able
       ("the migration", "my team of six"). */
    const mirrorTokens = extractMirrorTokens(answer);
    const mirrorAnchorBlock = mirrorTokens.length > 0
      ? `\nMIRRORING ANCHORS — words/phrases the candidate just used that you SHOULD echo (verbatim, casing preserved): ${mirrorTokens.map(t => `"${t}"`).join(", ")}. Pick ONE and weave it naturally into your follow-up. Do not paraphrase them ("the migration" → keep "the migration", not "the project").`
      : "";

    const jdContext = jobDescription ? `The candidate is targeting this role: ${sanitizeForLLM(jobDescription, 500)}. If relevant, probe for skills mentioned in the JD.` : "";
    const resumeSkillsContext = Array.isArray(resumeTopSkills) && resumeTopSkills.length > 0
      ? `Candidate's key skills from resume: ${resumeTopSkills.slice(0, 6).map(s => sanitizeForLLM(s, 50)).filter(Boolean).join(", ")}. If relevant to the current topic, ask them to demonstrate these skills with specific examples.`
      : "";
    const previousContext = previousFollowUps && previousFollowUps.length > 0
      ? `\nPrevious follow-up exchange:\n${previousFollowUps.map(s => sanitizeForLLM(s, 300)).join("\n")}\n\nDO NOT REPEAT phrasing, opening lines, or core content from your previous follow-ups above. The candidate has already heard those words. If your next message would start with the same opener (e.g. "I heard ₹X — that's the absolute top of what I can approve") that you already said, REPHRASE the entire turn or pivot to a different angle (benefits, levers, role scope, decision timeline). Repeating yourself signals you weren't listening.`
      : "";

    const isSalaryNeg = type === "salary-negotiation";

    /* ─── Server-authoritative band (Gap 1 minimum-viable) ───
       Historically the client supplied negotiationBand on every turn,
       which meant tampered or stale client state could push the LLM
       above maxStretch or below walkAway. Now: on every salary-neg
       turn the server recomputes the band from {role, company, city,
       industry} and uses *that* as the source of truth. The client
       band is only consulted when the server can't derive one (no
       company/role). Divergence from client values is logged so we
       can detect tampering or stale generate-questions cache hits. */
    let negotiationBand: typeof clientNegotiationBand = clientNegotiationBand;
    if (isSalaryNeg && typeof role === "string" && role.length > 0) {
      try {
        const serverBand = generateNegotiationBand({
          role,
          company: typeof company === "string" ? company : undefined,
          currentCity: typeof currentCity === "string" ? currentCity : undefined,
          jobCity: typeof jobCity === "string" ? jobCity : undefined,
        });
        const serverDerived = {
          initialOffer: serverBand.initialOffer,
          minOffer: serverBand.minOffer,
          maxStretch: serverBand.maxStretch,
          walkAway: serverBand.walkAway,
          bandContext: serverBand.bandContext,
          hasEquity: serverBand.hasEquity,
        };
        // Telemetry: detect significant divergence from client-supplied band.
        // >20% delta on maxStretch flags either tampering or a stale
        // band derived under different inputs (eg. company changed).
        if (clientNegotiationBand && typeof clientNegotiationBand.maxStretch === "number") {
          const clientMax = clientNegotiationBand.maxStretch;
          const serverMax = serverDerived.maxStretch;
          if (serverMax > 0) {
            const pct = Math.abs(clientMax - serverMax) / serverMax;
            if (pct > 0.2) {
              void captureServerEvent(
                "negotiation_band_divergence",
                distinctIdFrom(req, auth.userId),
                {
                  client_max_stretch: clientMax,
                  server_max_stretch: serverMax,
                  client_initial: clientNegotiationBand.initialOffer ?? null,
                  server_initial: serverDerived.initialOffer,
                  pct_delta: Math.round(pct * 100) / 100,
                  company: (company || "").slice(0, 80),
                  role: role.slice(0, 80),
                },
                req,
              );
            }
          }
        }
        negotiationBand = serverDerived;
      } catch (e) {
        console.warn("[follow-up] server-band derivation failed, falling back to client band:", e);
      }
    }

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

    const salaryPhase = isSalaryNeg
      ? detectSalaryPhaseHelper({
          negotiationPhase,
          questionIndex,
          totalQuestions,
          facts: negotiationFacts,
          answer,
        })
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
- If they asked about breakdown: set wantsBreakdown=true in your JSON and write a SHORT prose lead-in WITHOUT any ₹ numbers (the server appends the templated breakdown). Example followUpText: "Sure, happy to walk through the structure." Do NOT write base/variable/joining/PF amounts yourself.
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
- COUNTER NUMBER PROTOCOL: When you make a counter-offer, set "proposedCounter" in your JSON to the number you want to offer (just the LPA figure, e.g. 28.5). The server validates this against your band ceiling and your previous offers, then writes the canonical counter sentence. You may still write a prose lead-in in followUpText, but the load-bearing rupee number lives in "proposedCounter". NEVER move backwards: proposedCounter must be >= your highest previous offer.
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
- DO NOT write a component breakdown ("base ₹A, variable ₹B, bonus ₹C, total ₹W") in your reply. The server templates that sentence from the agreed total using a fixed 60/20/10/10 split. You only contribute a short WARMTH lead-in (acknowledge the yes; one warm sentence) — the server appends the recap + offer-letter timeline + notice-period probe automatically.
- Good warmth lead-in examples: "Wonderful — really glad we landed somewhere that works for both sides." / "Excellent. Happy we got there together."
- Do NOT write rupee figures yourself in this branch — leave the load-bearing numbers to the server. If you write ₹ amounts, the server will strip them. Trust the templating.

[STILL-OPEN BRANCH — when no explicit acceptance]
- Acknowledge where things stand WITHOUT claiming agreement: "Where we are right now is — our offer is ₹X total. You've shared your concerns about [specific thing they raised]. I want to be clear: I'm not going to pressure you for a yes today."
- Surface what's still on the table: "The ₹X package is what I can do, and it stands. If there's a number that would change your mind, tell me — and I'll see what's possible."
- Set a soft deadline: "Take a couple of days to think it through. I'll need a final answer by [day] so I can either move forward or give the slot to another candidate."
- DO NOT use: "we've agreed" / "what we agreed on" / "let me put together the final numbers" / "I'll have HR send the offer" / "welcome aboard" / "having you on board" — these all imply a yes that hasn't happened.

[STILL-NEGOTIATING BRANCH — candidate is still pushing]
- "I hear you, but this is genuinely my final offer. I've stretched as far as I can. The next step is either a yes or we part as friends — what's it going to be?"
- "If they want to think: Absolutely. The offer stands until [date]. But I'll be honest — I'd love an answer sooner so I can lock in the headcount."

NUMBER DISCIPLINE: Whenever you write a recap with components (₹A base + ₹B variable + ₹C ESOPs + ₹D bonus), the components MUST sum to the stated total. NEVER write "total ₹X which includes ₹X base, ₹X variable, ₹X ESOPs" — repeating the same number across every component is mathematically impossible and destroys credibility instantly. A real Indian tech CTC of ₹X LPA breaks down roughly as 65-78% base, 10-15% variable, 5-10% ESOPs/year, 2-5% PF + benefits — use those proportions when recapping. If the candidate questions a recap, do NOT apologize and re-emit the same broken breakdown — recompute with realistic component proportions.`,
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
      // Anchor role + employer-naming rules. Two production bugs from the
      // Flipkart round-3 retest motivated these:
      //   • Role drift — user picked "ux-designer" but AI ran the
      //     negotiation as "Senior Product Designer". Rule: the role
      //     title is fixed for the session; never substitute another.
      //   • Hallucinated employer — AI said "your notice period at
      //     3INSYS" when the candidate never named an employer. Likely
      //     ASR garble propagated as fact. Rule: don't invent the
      //     candidate's current company; ask if you need it.
      const roleAnchorRule = isSalaryNeg && role
        ? `\nROLE TITLE LOCK: This negotiation is for the position "${sanitizeForLLM(role, 80)}". When you reference the open role, use this exact title. NEVER substitute a different title (e.g. "Senior Product Designer" when the role is "${sanitizeForLLM(role, 80)}", "Product Manager" when the role is "Engineering Manager"). The candidate picked this role; switching titles mid-conversation breaks the simulation and feels like you weren't listening.`
        : "";
      const employerNameRule = isSalaryNeg
        ? `\nDO NOT INVENT THE CANDIDATE'S CURRENT EMPLOYER: When discussing notice period, joining timeline, or current company context, do NOT name the candidate's current employer unless they have EXPLICITLY said the company name in this conversation. If you need to refer to it, say "your current company" or "your current role" or simply ask "where are you now?". Inventing names like "your notice period at <CompanyName>" — when the candidate never said that name — is a hallucination that destroys trust the moment they notice. ASR transcripts can mishear words; treat any seemingly-named company in transcript context as suspect unless it appears verbatim in the candidate's own words.`
        : "";

      // Build structured facts context so the LLM has precise anchors
      const factsLines: string[] = [];
      if (negotiationFacts) {
        if (negotiationFacts.acceptedImmediately) factsLines.push("- Candidate ACCEPTED the offer immediately. CRITICAL: do NOT probe further about equity, package components, or what's most important — they said yes, take the yes. Move directly to closing: confirm the agreed total CTC with all components, set timeline (formal letter, start date), and warmly close. Asking another probing question after explicit acceptance feels like you're trying to upsell them or having second thoughts about the deal.");
        if (negotiationFacts.rejectedOutright) factsLines.push("- Candidate REJECTED the offer outright (stay professional, ask what would work)");
        if (negotiationFacts.candidateCounter) factsLines.push(`- Candidate's counter/target: ${sanitizeForLLM(negotiationFacts.candidateCounter, 30)} — YOU KNOW THIS. Negotiate around it, do NOT re-ask. SPEAKER GUARD: when you write "I heard ₹X from you" / "you mentioned ₹X" / "your target of ₹X", X MUST be ${sanitizeForLLM(negotiationFacts.candidateCounter, 30)}. Never echo your own offer (${canonicalInitialOffer ? `₹${canonicalInitialOffer} LPA` : "the initial offer"}) as if the candidate said it.`);
        if (negotiationFacts.candidateAskTotal && negotiationFacts.candidateAskBase) {
          factsLines.push(`- Candidate split their ask: TOTAL ${sanitizeForLLM(negotiationFacts.candidateAskTotal, 30)}, BASE ${sanitizeForLLM(negotiationFacts.candidateAskBase, 30)}. When you reference "what they asked for", use the TOTAL — not the base. Quoting their base figure as their target is a confusion bug; do not collapse the two.`);
        }
        if (negotiationFacts.candidateCurrentCTC) factsLines.push(`- Candidate's current CTC: ${sanitizeForLLM(negotiationFacts.candidateCurrentCTC, 30)} — YOU KNOW THIS. Do NOT ask again.`);
        if (negotiationFacts.hasCompetingOffers) factsLines.push("- Candidate mentioned COMPETING OFFERS — you MUST address this: ask what they're offering, what matters beyond the number, and where you can differentiate.");
        if (negotiationFacts.competingOfferAmount) factsLines.push(`- Candidate has a COMPETING / IN-HAND OFFER of ${sanitizeForLLM(negotiationFacts.competingOfferAmount, 30)}. This is their BATNA — distinct from their target/ask. Do NOT conflate the two. When you echo "you said you have an offer of ₹X", X MUST be ${sanitizeForLLM(negotiationFacts.competingOfferAmount, 30)}; when you echo "your target is ₹Y", Y is the candidate's target (separate field), NOT this competing-offer figure.`);
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

      // Round LPA values shown to the LLM so the candidate-visible
      // number (rendered via fmtLPA → integer for ≥10 LPA) matches the
      // number the LLM sees. Prior bug: bandContext rendered "₹30 LPA"
      // but elsewhere we passed the raw 30.4, and the LLM emitted
      // "the ₹30.4 LPA package" — a precision leak. Round to integer
      // for ≥10 LPA, half-LPA below.
      const roundLPA = (n: number): number =>
        n >= 10 ? Math.round(n) : Math.round(n * 2) / 2;
      // Monotonic offer rule + candidate target context
      const offerTrackingCtx = highestOfferMade
        ? `\nIMPORTANT: Your highest previous offer was ₹${roundLPA(highestOfferMade)} LPA. Your next offer MUST be >= ₹${roundLPA(highestOfferMade)} LPA. Never go backwards.`
        : "";
      // Server-deterministic recommended counter. Removes the LLM's
      // hand from picking ₹ values for counter / closing-pressure phases.
      // The LLM still writes prose; the number is computed from the band
      // + session state. Post-LLM clamps remain as safety net.
      const recommendedCounter = isSalaryNeg && negotiationBand
        ? pickServerCounter({
            phase: salaryPhase,
            initialOffer: canonicalInitialOffer ?? negotiationBand.initialOffer,
            maxStretch: negotiationBand.maxStretch,
            walkAway: negotiationBand.walkAway,
            highestOfferMade,
            candidateTarget,
          })
        : null;
      const recommendedCounterDisplay = recommendedCounter !== null ? roundLPA(recommendedCounter) : null;
      const recommendedCounterCtx = recommendedCounterDisplay !== null
        ? `\nRECOMMENDED COUNTER FOR THIS TURN: ₹${recommendedCounterDisplay} LPA. This number is computed from the band + the candidate's stated target + your previous offers. Use this exact figure as your headline counter unless the candidate's last message gives you a specific reason to deviate (e.g. they explicitly accepted a different number, or their ask is below this figure — in which case match their ask). When you write component breakdowns (base + variable + bonus), make sure the components SUM to ₹${recommendedCounterDisplay} LPA.`
        : "";

      /* Typed move recommendation. pickNextMove decides the structural
         move (which lever, monetary or not) deterministically from
         band + state; the LLM only renders prose around it. This stops
         the "ESOPs on a non-equity band" and "same joining-bonus three
         turns in a row" failure modes at the source. Soft hint — the
         LLM still has prose latitude, but the chosen lever is named. */
      const nextMove = isSalaryNeg && negotiationBand
        ? pickNextMove({
            phase: salaryPhase,
            initialOffer: canonicalInitialOffer ?? negotiationBand.initialOffer,
            maxStretch: negotiationBand.maxStretch,
            walkAway: negotiationBand.walkAway,
            highestOfferMade,
            candidateTarget,
            hasEquity: negotiationBand.hasEquity,
            isAccepted: !!negotiationFacts?.acceptedImmediately,
            // leversTried plumbing arrives with Gap 3 (server session
            // memory). Until then, all non-cash levers are eligible
            // every turn — the prompt's no-repeat rule covers the gap.
          })
        : null;
      const nextMoveCtx = nextMove
        ? `\nSTRUCTURAL MOVE FOR THIS TURN: lever=${nextMove.lever}. ${nextMove.rationale}`
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

      // Role-family-specific compensation levers. Salary-neg felt
      // role-agnostic in production sessions — the AI offered the
      // same generic "ESOPs, joining bonus, learning budget" to a
      // product designer that it would to a backend engineer. Real
      // hiring managers reach for craft-specific levers.
      const roleLower = (role || "").toLowerCase();
      let roleFamilyLevers = "";
      if (/(?:product designer|ui designer|ux designer|visual designer|interaction designer|design lead|design manager|product design)/i.test(roleLower)) {
        roleFamilyLevers = "\nROLE-SPECIFIC LEVERS (design): when negotiating beyond base, prioritize design-craft levers: (a) annual conference budget (Config / Awwwards / FigJam world / IxDA — ₹50K–1.5L); (b) design-tool stipend (Figma seat, Adobe CC, Mobbin, Maze — ₹30K–80K); (c) portfolio / IP rights (the candidate retains rights to publish work after embargo); (d) design-system or research ownership (a named scope, not just IC work); (e) headphones / monitor / hardware refresh budget. Avoid offering generic 'learning budget' when one of these would land harder.";
      } else if (/(?:engineer|developer|sde|swe|backend|frontend|full ?stack|sre|devops|platform)/i.test(roleLower)) {
        roleFamilyLevers = "\nROLE-SPECIFIC LEVERS (engineering): prioritize (a) on-call / pager comp (if applicable); (b) hardware budget (laptop spec, monitors, ergonomic chair — ₹1–2L); (c) cloud / API credits for side projects; (d) conference budget (KubeCon / re:Invent / GopherCon — ₹1–2L); (e) protected learning time (1 day / week or 10% time); (f) tech-lead vs IC-only path clarity. Avoid generic 'flexibility' when a real lever fits.";
      } else if (/(?:product manager|pm\b|product lead|associate product)/i.test(roleLower)) {
        roleFamilyLevers = "\nROLE-SPECIFIC LEVERS (product management): prioritize (a) named ownership scope (a real product surface, not 'a feature'); (b) data / analytics tool stipend (Amplitude / Mixpanel / Heap personal seats); (c) customer-research budget (user-interview compensation pool); (d) executive-sponsor / cross-functional access; (e) external speaking allowance. PMs care about scope and access more than perks.";
      } else if (/(?:data scientist|data engineer|ml engineer|machine learning|analyst)/i.test(roleLower)) {
        roleFamilyLevers = "\nROLE-SPECIFIC LEVERS (data / ML): prioritize (a) GPU / compute credits for personal experimentation; (b) Kaggle / NeurIPS / ICML conference budget; (c) protected research time; (d) publication / patent rights; (e) named dataset ownership. Generic 'flexibility' lands flat for this audience.";
      }

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
TAKE THE YES. Acknowledge their acceptance warmly, then move directly to closing — recap the EXACT agreed package with ₹ numbers (base, variable, bonus, total CTC), mention offer letter timeline, ask about notice period.
DO NOT probe further about equity / flexibility / "have you considered". Asking another question after a clear yes feels like you're trying to upsell or regretting the deal. Take it.
DO NOT counter-offer or act as if they rejected. They said YES.
`;
      } else if (isConditionalAccept) {
        intentBanner = `
THE CANDIDATE CONDITIONALLY ACCEPTED. THEY SAID: "${sanitizeForLLM(answer, 350)}"
They accepted the core offer but have ONE specific condition (move base to ₹X, add joining bonus, equity vesting question, etc.).
YOU MUST:
1. Acknowledge the acceptance warmly FIRST: "Great, I'm glad the base works for you!"
2. Address the condition directly with a CONCRETE answer:
   - If their condition is INSIDE your band (within minOffer–maxStretch): GRANT it. "Yes, I can move base to ₹X. Done." Then close.
   - If OUTSIDE band but close: trade — "I can't move base, but I can add ₹Y joining bonus / ₹Z performance bonus to bridge that." Concrete numbers only.
   - If WAY outside band: politely decline with reason, offer alternative — "I can't get to ₹X on base — that's above what's approved for this level. Best I can do is ₹Y. Does that work?"
3. Do NOT re-open the base discussion if they didn't ask to. Do NOT ask another open-ended question — make a concrete move.
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
      /* Conversation state. Single source of truth — replaces the prior
         override ladder (rejectionLocksClosing → pendingQuestionForcesOpen
         → acceptedImmediately sticky). All routing decisions for the
         prompt template are derived from this typed value. New edge
         cases land as new cases in deriveConvState / phaseForState,
         not as another override branch here. See _negotiation-state.ts
         for the reducer. */
      const acceptInHistoryRe2 = /\b(i accept|i agree|sounds good|that works for me|it.?s a deal|happy with|works for me|let.?s go ahead|deal|i.?ll take it|i.?ll take the offer)\b/i;
      const acceptedEverInHistory = conversationHistory ? acceptInHistoryRe2.test(conversationHistory) : false;
      const convState: ConvState = deriveConvState({
        acceptedThisTurn: candidateAccepted,
        conditionalAccept: isConditionalAccept,
        rejectedThisTurn: candidateRejected,
        walkAwayThisTurn: candidateWalkAway,
        deflectedThisTurn: candidateDeflected,
        needsTimeThisTurn: candidateNeedsTime,
        acceptedEverInHistory: acceptedEverInHistory || negotiationFacts?.acceptedImmediately === true,
        answer: typeof answer === "string" ? answer : "",
      });
      const candidateAsked = convState.pendingRequest != null;
      const rejectionLocksClosing = convState.kind === "rejected" || convState.kind === "walking";
      const effectiveSalaryPhase = phaseForState(convState, salaryPhase);
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
      // Derived from convState — kept as a const so the readability of
      // the noAgreementGuard predicate below isn't compromised.
      const candidateExplicitlyAccepted = convState.kind === "accepted" || convState.kind === "conditional-accept";
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

      /* Pending-question banner. Pairs with pendingQuestionForcesOpen
         above. Forces the LLM to ANSWER the candidate's question/request
         before doing anything else. Sized like the rejection/no-agreement
         guards so it lands with the same authority. */
      const pendingQuestionGuard = candidateAsked
        ? `\nPENDING-QUESTION GUARD — THE CANDIDATE ASKED YOU A QUESTION: "${sanitizeForLLM(answer, 350)}"
ANSWER THE QUESTION FIRST, in your next reply, with the specific information they asked for. Only after answering may you move the conversation forward.
The following are BANNED in this reply (they ignore the question):
- "I'll work with HR to put together the formal offer letter"
- "HR will send you the offer letter"
- "put together the final numbers" / "finalize the package"
- "revised offer based on our conversation" (you can't promise a revision before answering the question they actually asked)
- "welcome aboard" / "look forward to having you"
- "is there anything else you'd like to discuss" — this dodges, it doesn't answer
If the question is about a BREAKDOWN of the offer, set wantsBreakdown=true in your JSON (the server appends the templated component breakdown) and write a SHORT prose lead-in like "Sure, happy to walk through the structure." If the question is about something else (notice-period logistics, benefits, equity terms), answer it directly with concrete details.`
        : "";

      depthInstructions = `You are a HIRING MANAGER in a salary negotiation. You MUST stay in character. ALWAYS set needsFollowUp to true.
${intentBanner}${pendingQuestionGuard}${equityGuard}${rejectionGuard}${noAgreementGuard}${historyContext}
${factsCtx}${offerCtx}${roleAnchorRule}${employerNameRule}${bandCtx}${offerTrackingCtx}${recommendedCounterCtx}${nextMoveCtx}${targetCtx}${styleCtx}${industryCtx}${roleFamilyLevers}${scenarioCtx}${personaTrait ? `\nINTERVIEWER PERSONA — ${personaTrait} Let this trait color your phrasing without making the candidate's experience worse. Don't announce the trait; just write in voice.` : ""}${(typeof prepWalkAway === "number" || typeof prepCompetingOffer === "number") ? `\nPRE-SESSION CANDIDATE FACTS (from their own prep — they shared these BEFORE the call):${typeof prepWalkAway === "number" ? ` walk-away ₹${prepWalkAway} LPA;` : ""}${typeof prepCompetingOffer === "number" ? ` competing offer ₹${prepCompetingOffer} LPA.` : ""} Treat these as quietly-known context for calibration. Do NOT cite them back unless the candidate volunteers them in the conversation — otherwise it'd feel like you read their notes.` : ""}

CURRENT PHASE: ${effectiveSalaryPhase.toUpperCase()}
${phaseInstructions[effectiveSalaryPhase] || phaseInstructions["offer-reaction"]}

RULES:
- REPAIR FIRST: If the candidate's answer is a confusion / clarification signal — e.g. "what?", "what are you offering me?", "I don't understand", "can you repeat", "wait what", "huh?", "say that again", "I'm confused", "didn't catch that", a question back to you about the offer itself, or under 8 words asking for clarification — DO NOT push forward with a new probe. Recap your most recent offer plainly with the exact ₹ numbers (base / variable / bonus / total CTC) and ask if that's clear. One short paragraph. Don't add new asks until the candidate signals they're tracking. This rule overrides the rest of the phase script.
- HEAR THEM: If the candidate's answer signals frustration that you're repeating yourself — "already mentioned", "as I said", "I told you", "multiple times", "already said", "told you before", "again" used reproachfully, "for the third/Nth time", or any short answer that references having previously answered — you MUST: (1) explicitly acknowledge ("you're right, you already mentioned that — apologies"), (2) make a CONCRETE move on the same turn (a real ₹ counter, a specific trade, or an explicit concession). Asking another open-ended question after this signal is the failure mode of this whole interview type. Do NOT do it.
- NO COUNTER-DODGE: If the candidate has ALREADY stated a number (CANDIDATE FACTS shows candidateCounter) AND they directly ask for your counter ("what's your counter?", "what can you offer?", "what's your best?", "give me a number"), you MUST respond with a SPECIFIC ₹ figure — not another probe. Do NOT say "to make progress I need to understand your expectations first" — they've given you their expectations. Counter with a real number from your band, ideally between your initial offer and their ask. Saying "tell me more about your reasoning" after they've already shared market data + asked for a counter feels evasive and unrealistic.
- WALK-AWAY HONESTY: If the candidate's stated ask is ABOVE the band's walkAway figure (negotiationBand.walkAway), do NOT pretend it's reachable. Be honest: "That's above what's approved for this level — we can't get there." Then offer your real best (your maxStretch), and let them decide. Faking flexibility you don't have is worse than a clean "no, but here's what I can do."
- ANTI-CAPITULATION: Even when the candidate's ask is ABOVE maxStretch (but below walkAway), you MUST: (1) acknowledge it's above the band ("₹{ask} is at the top end / above our typical band for this role"), (2) make a SMALLER counter that's still within maxStretch, (3) name a non-cash trade you can offer (joining bonus, accelerated promo review, learning budget). DO NOT simply restate their number as your "revised offer" — that's silent capitulation, the worst possible negotiation move.
- COMPONENTS SUM TO TOTAL: When you break a CTC into base + variable + bonus, the parts MUST add up to the total. Before sending, add them mentally. If you say "total ₹18 LPA = base ₹18 + variable ₹18 + bonus ₹18", that sums to ₹54 — that's a hallucination, not an offer. Joining bonus is one-time; either keep it OUTSIDE the total CTC (preferred) or amortize it explicitly. Never let components exceed the stated total.
- INTERNAL CONSISTENCY (re-read your draft): If you say "I can't meet ₹X" or "I can't reach ₹X" in one sentence, you cannot then offer ₹X (or ≥₹X) in the next sentence — that's a self-contradiction. Either commit to "I can't do ₹X — here's my real best ₹Y (which is < X)" OR drop the "can't" framing entirely. Never both.
- DON'T FABRICATE THE CANDIDATE'S MOTIVATION: Only mirror what the candidate has LITERALLY said in the transcript so far. If they only said "based on market research", do NOT invent "this isn't a growth opportunity for you" or "you're looking to make a switch" — those are your projections, not their words. Saying "I hear you that X" when the candidate never said X is a tell that you're confabulating context.
- CONDITIONAL ≠ ACCEPTANCE: If the candidate says "IF you can do ₹X then it's worth switching" or "AS LONG AS the package is at ₹Y", that is a conditional, NOT acceptance. Do NOT respond with "I'm glad you're excited!" / "welcome aboard!" / "happy to have you!". Instead: explicitly confirm the deal terms first ("So if I can confirm ₹X total CTC, you'd accept — is that right?"). Only treat literal yes / I accept / I'm in / let's do it as acceptance.
- NO PHRASE REPETITION (re-read your draft, do not loop): Each phrase appears at most ONCE per message. If you find yourself starting to write the same clause a second time — "that's the absolute top of what I can approve — that's the absolute top of what I can approve" — STOP. That's a generation loop, not communication. Truncate, rewrite the sentence cleanly, and never repeat a clause. A 4-sentence response that says distinct things beats a 12-sentence response that says one thing four times. SPECIFIC BAN: the clause "that's the absolute top of what I can approve" appears AT MOST ONCE in your entire response. If a regex would find it twice, your response is invalid — rewrite.
- COMPONENT ARITHMETIC MUST BE EXACT: When you quote a CTC breakdown (base + variable + ESOP + PF + benefits), the numbers MUST sum to the stated total CTC ± ₹0.1 LPA. Inventing components that don't add up ("base ₹22 + bonus ₹22 + ESOP ₹22 = total ₹22") is the most common LLM failure on this surface and the most trust-destroying for the candidate. If the bandContext above includes an INITIAL-OFFER COMPONENT BREAKDOWN block, copy those numbers VERBATIM. Do not invent your own. Do not equate base/bonus/ESOP to the same number — they are mathematically distinct.
- DO NOT MISREPEAT THE CANDIDATE'S NUMBER: If the candidate says "₹30 to ₹32 LPA", do not echo it as "₹30 to ₹28.1 LPA". The candidate hears the discrepancy and loses trust. When in doubt about what they said, ask: "Just to confirm, you're saying ₹X to ₹Y LPA, correct?" Don't guess.
- MARKDOWN-FREE OUTPUT: Never use markdown asterisks (*) or underscores (_) for emphasis. The interview UI may render them as italic/bold or read them aloud as "asterisk", which breaks the conversation. Plain prose only.
- INDIAN COMPENSATION REALITY: Most Indian companies include PF (Provident Fund, ~5% of CTC, 12% of basic) as part of the standard package — mention it when discussing the breakdown. ESOPs are NOT universal — services firms (TCS, Infosys, Wipro), older PSUs, and many traditional companies don't offer them at all. If the bandContext says "No equity at this level", don't mention ESOPs in your offer breakdown.
- NUMBER OWNERSHIP (track whose number is whose): The candidate's TARGET is what THEY asked for (their counter). Your OFFER is what YOU said you can pay. Do NOT swap them. Wrong: "I hear you saying ₹7.5 LPA is your target" when ₹7.5 was YOUR offer and they asked for ₹20. Before any "I hear you saying" sentence, verify: did the candidate actually say this number, or did I? If unsure, re-read the last user turn.
- RANGES GO LOW TO HIGH: A range "₹X to ₹Y" requires X ≤ Y. "₹12 to ₹8.5 LPA" is not a range — it's gibberish. If you find yourself writing such a thing, your number-tracking is confused; stop, look up your actual numbers from the band, and rewrite cleanly.
- ADDRESS CONFUSION FIRST (do not close on a complaint): If the candidate's last message contains confusion or frustration — "I'm confused", "I don't understand", "what are you saying", "you're confusing me", "this doesn't make sense", a question back to you about the offer — you MUST stop, recap your most recent offer plainly with the exact ₹ numbers (one short paragraph), and ask if that's clear. Do NOT pivot to "Great, thanks. I'll connect with HR" or any other closing language. Closing on a complaint is the worst possible move.
- DON'T REPEAT YOUR PREVIOUS QUESTION: Look at YOUR last message. If you're about to ask the same question again ("What's most important to you?" → "What's most important to you?"), STOP. The candidate already answered or signaled they don't want to keep being asked. Either move to a CONCRETE counter (a real ₹ number) or address a different angle (joining bonus, equity vesting, notice). Asking the same probe twice is the failure mode that makes users say "why are you asking again and again?"
- ANSWER DIRECT ASKS WITH A NUMBER, NOT A QUESTION: When the candidate says "what exactly are you offering?", "can you clarify the offer?", "what's your counter?", or "give me your best" — your reply MUST contain a specific ₹ figure (or a recap of your existing offer with exact numbers). Do NOT respond with "what's most important to you?" or "what would move the needle?". Probing back when asked for a number reads as evasion and breaks trust.
- EVERY SALARY SESSION NEEDS AT LEAST ONE COUNTER: After the candidate has stated their target, you owe them a numeric move within the next 1-2 turns — either "I can stretch to ₹X" (counter) or "₹Y is above my band; my best is ₹Z" (honest no). Going 3+ turns without producing a number after their ask is silent stonewalling. The candidate notices.
- MIRROR THE CANDIDATE'S NUMBERS EXACTLY: When you reference what the candidate said, use the exact figure they used. If they said "22 lakhs as base", write "I heard ₹22 LPA base" — NOT "₹20.2 LPA base". Distorting their number even slightly destroys trust ("did they listen at all?").
- STRETCH-AUTHORITY PACING: When you raise your offer beyond your initial number — especially if it's near maxStretch — DON'T raise instantly. Real hiring managers say "let me check with leadership / comp committee" before stretching. Use a beat: "That's near the top of what I can approve directly. Let me see if I can pull in another lever — give me a moment." Then in the SAME message, after the beat, give the new number. This pacing makes the stretch feel earned, not infinite. Skip the beat for small bumps within initial range.
- INDIAN-CONTEXT SCRIPTS: Recognize and respond authentically to common Indian-context lines from the candidate without making them feel weird:
  • "Let me discuss with my family / parents / wife / husband." → respect it. "Of course — take the evening, talk to them, come back to me by tomorrow EOD." Don't push.
  • "My current company is making a counter-offer." → take it seriously, ask for the figure, position your offer's non-cash strengths (growth, scope, learning).
  • "I have a joining-date constraint" (wedding, parents' health, relocation logistics) → flexibility on start date is a cheap win for you. Offer to delay start or signing bonus to bridge.
  • "I need to consider relocation costs" → quote a real relocation allowance figure if applicable, mention HRA differences city-to-city.
  • "I've already declined another offer for this." → meaningful BATNA signal — don't squeeze further on base.
- EQUITY / VESTING DEPTH: When equity comes up, give a real walk-through, not a buzzword. Cover: 4-year vest, 1-year cliff, what cliff means in cash terms ("if you leave before month 12 you get nothing"), valuation-event risk ("ESOPs at private-company strike are illiquid until exit"), and your typical refresh-grant cadence. Candidates who care about equity tell strong from weak in seconds — don't hand-wave.
- BLUFF-CHECK ON COMPETING OFFERS: If the candidate claims a competing offer but stays VAGUE — no company name, no figure, no role specifics — call it professionally. "Got it — and I'm not going to ask you to share the company, but if you can give me a ballpark, it'll help me figure out where I can land." Don't be aggressive; just don't pretend the bluff is concrete leverage. If they decline to share even a range, treat it as no leverage and stay on your number.
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

    /* Behavioural-mode guard — reciprocal of the salary-neg SCOPE FENCE
       below. Without this, an LLM in a behavioural session can drift into
       compensation probes ("so what's your target salary?") mid-story.
       That breaks the focus and signals to the candidate the interviewer
       isn't actually listening. */
    /* Classify the question shape so non-STAR prompts (self-intro,
       motivation, failure, conflict) get the right coaching framework.
       STAR is the default for story-shaped prompts but is actively wrong
       for self-intro ("tell me about yourself" → PPF) and motivation
       ("why this company" → Hook-Evidence-Fit). The classifier returns
       "generic" for anything ambiguous, which keeps the STAR path
       intact for the common case. */
    const behavioralCategory = type === "behavioral"
      ? classifyBehavioralQuestion(question)
      : "generic";
    const frameworkOverride = type === "behavioral"
      ? frameworkDirectiveFor(behavioralCategory)
      : "";

    /* INDIAN CONVERSATIONAL REGISTER — permits (but does not require)
       the LLM to use lexical / pragmatic markers that real Indian
       interviewers use. Without this block, the LLM defaults to
       American startup English and the interview feels like a
       San Francisco zoom call. With it, the LLM can code-switch
       lightly when the company tone (Razorpay, Flipkart, TCS) and
       the candidate's own register support it.

       Critically: this is PERMISSION, not mandate. A polished English
       answer should still get a polished English follow-up. The block
       also forbids the most common Western mis-grades — hedged
       disagreement read as weak conviction, "sir/ma'am" mocked as
       sycophancy, festival/calendar references treated as filler. */
    const indianRegisterBlock = type === "behavioral"
      ? `\nCONVERSATIONAL REGISTER — Indian context:
- You MAY use light Hinglish discourse markers when the candidate uses them or when the company tone is informal: "achha", "theek hai", "sahi", "haan", "bilkul". One per follow-up at most. Skip entirely if the candidate is speaking polished English — don't force it.
- Indian-English interviewer ACKNOWLEDGEMENT tics are natural and authentic: "right right right", "okay okay understood", "haan haan, go on", "fair enough", "got it got it", and the question-tag closers "no?" / "isn't it?" / "correct?". Use AT MOST ONE per follow-up. Use ZERO if the candidate is speaking polished US-corporate English — over-use reads as caricature. These belong in your acknowledgement opener, not in the question itself.
- Indian-English business idioms ("kindly elaborate", "what is your USP", "revert back with your thoughts", "do the needful", "what is the scenario") are acceptable in services-track / BFSI / consulting contexts (TCS, Infosys, Wipro, Cognizant, Capgemini, Accenture, HDFC, ICICI, McKinsey India, etc.). DO NOT use these in product/startup contexts (Razorpay, Flipkart, Swiggy, CRED, Google India) — there they sound dated. Inferable from the role/company already in context.
- Hedged disagreement ("with respect, I'd suggest..." / "may I push back gently...") is conviction expressed in Indian register, NOT weak conviction. Do NOT probe as if the candidate is uncertain.
- "Sir" / "ma'am" addressed to the interviewer is professional courtesy in Indian English, NOT sycophancy. Do not comment on it, mock it, or coach against it.
- Indirect framing of failure ("there were some challenges with the timeline" / "the rollout had some issues") is the Indian register for ownership; treat the same way you would treat "I missed the deadline" in American English. Probe for what they did, not for them to "own it more directly."
- Relational framing ("kept the team aligned" / "preserved trust with the stakeholder") is a legitimate outcome marker, not soft-skill filler. Accept it as Result content.
- Festival / calendar references (Diwali, Holi, quarter-end, BBD, Sankranti, Navratri) are real operational context in Indian companies, not anecdotal filler.`
      : "";

    const behavioralModeGuard = type === "behavioral"
      ? `\nMODE FENCE — THIS IS A BEHAVIOURAL INTERVIEW, NOT A NEGOTIATION OR HR-ROUND CHECK.
- DO NOT ask about target salary, current compensation, joining timeline, notice period, or location preferences. Those are HR-round / salary-neg probes.
- DO NOT ask about visa, relocation willingness, or family situation.
- STAY on examples and stories: situations the candidate has handled, decisions they made, what they did specifically, and what the outcome was.${frameworkOverride ? "" : " STAR shape (Situation → Task → Action → Result) is what you are probing for."}${frameworkOverride ? `\n${frameworkOverride}` : ""}${indianRegisterBlock}`
      : "";

    /* Behavioural-only: STAR component-gap hint from the engine. When the
       engine has detected which pillar is conspicuously missing, point the
       LLM at it directly — otherwise a generic "tell me more" probe burns
       a turn without surfacing the gap. The engine budgets these per
       question, so we don't drill on a stubbornly weak answer forever.
       Defensive: validate starGap matches one of the documented values
       before constructing the directive. A garbage value (e.g. client
       sent `true` or `"foo"`) would otherwise fall through the ternary
       chain and emit a malformed prompt block. */
    const validStarGaps = new Set(["action", "result", "situation-task"]);
    /* Suppress STAR-gap targeting when the question isn't STAR-shaped.
       Firing "missing the Action" on a "tell me about yourself" answer
       (PPF-shaped) would teach the candidate the wrong lesson. The
       framework override directive above already steers the coach to
       the correct rubric — letting starGap also fire would create
       conflicting guidance in the same prompt. */
    const starGapSuppressed = type === "behavioral" && frameworkOverride !== "";
    const safeStarGap: "action" | "result" | "situation-task" | null =
      (typeof starGap === "string" && validStarGaps.has(starGap) && !starGapSuppressed)
        ? (starGap as "action" | "result" | "situation-task")
        : null;
    // Same suppression rule: pronoun-attribution probe assumes STAR-
    // style "you did X" framing. On a PPF / HEF / SOAR / SBI prompt the
    // framework directive owns the coaching shape; don't double up.
    const safeWeHeavy = type === "behavioral" && weHeavy === true && !starGapSuppressed;
    const starGapDirective = (type === "behavioral" && safeStarGap)
      ? `\nSTAR-GAP TARGETING — the engine detected this answer is missing the "${safeStarGap}" component. Your follow-up MUST probe specifically for that:
${safeStarGap === "action"
  ? (safeWeHeavy
      // Action-gap + "we" attribution: the candidate IS narrating action,
      // but as a collective ("we built / our team shipped"). Don't teach
      // them "we" is wrong (Indian-context cultural humility). Instead
      // ask them to slice out their personal contribution.
      ? `  - The candidate is narrating with "we / our team" — this is normal (esp. for Indian candidates), NOT a failure. Do NOT correct their pronoun usage. Instead, ask them to slice out their individual contribution: "Within the team's work, what was *your* specific slice?" / "When you say 'we built X' — which part did *you* personally own?" / "Walk me through one decision YOU made on this project."`
      : `  - Ask what THEY specifically did. "What were *your* specific actions?" / "Walk me through what *you* did, step by step — not what the team did."`)
  : safeStarGap === "result"
  ? `  - Ask for the outcome / measurable impact. "How did it turn out?" / "What was the impact — any numbers you remember?" / "How did you know it worked?"`
  // Situation/Task framing: "set the scene" alone reads as filler — force
  // a problem/goal anchor so the candidate's next breath is the WHY of
  // the story, not another round of context-padding.
  : `  - Ask for the problem / goal. "What problem were you actually solving?" / "What was the goal — and why did it matter?" / "Before you got to the actions, what was the context that made this hard?"`}
- ONE question, no preamble. Do NOT escalate difficulty — escalation is for follow-ups on already-complete STAR answers.`
      : (safeWeHeavy
        // weHeavy without a starGap firing — answer is STAR-complete on
        // paper but pronoun-ambiguous. Surface the ownership probe as a
        // soft clarification, not a correction.
        ? `\nPRONOUN-ATTRIBUTION CLARIFY — the candidate is narrating in "we / our team" voice without isolating their personal contribution. Do NOT correct the pronoun (cultural humility default, esp. for Indian candidates). Instead, ask ONE clarifying probe that surfaces individual ownership: "Within that team effort, what was *your* specific role?" / "When you say 'we' — which piece did you personally drive?" / "What's one decision *you* made on this that you'd own again?"
- ONE question, no preamble.`
        : "");

    /* Per-answer Indian-register detection. The block above tells the LLM
       what to do *if* the candidate is in Indian register. This directive
       tells the LLM that on THIS specific turn the candidate already used
       at least one Indian-register marker — so light mirroring is in
       bounds, and the specific markers detected MUST NOT be scored as
       weakness. Conservative regexes (see _cultural-register.ts) — false
       negatives are fine, false positives would over-license Hinglish on
       answers that don't warrant it. */
    const culturalReg = type === "behavioral"
      ? detectCulturalRegister(answer)
      : { hedgedDisagreement: false, indirectFailureFraming: false, relationalFraming: false, calendarAnchored: false, deferentialGratitude: false, pedigreeRecital: false };
    const culturalRegisterHint = (type === "behavioral" && hasAnyIndianRegister(culturalReg))
      ? `\nINDIAN-REGISTER DETECTED — the candidate's answer contains: ${[
          culturalReg.hedgedDisagreement ? "hedged disagreement (conviction expressed politely)" : null,
          culturalReg.indirectFailureFraming ? "indirect failure framing (ownership expressed via 'some challenges')" : null,
          culturalReg.relationalFraming ? "relational outcome framing ('kept the team aligned' / 'preserved trust')" : null,
          culturalReg.calendarAnchored ? "Indian calendar / festival / fiscal anchor" : null,
          culturalReg.deferentialGratitude ? "deferential gratitude ('thank you for this opportunity, sir' / 'I appreciate you taking the time') — professional courtesy, NOT low confidence" : null,
          culturalReg.pedigreeRecital ? "pedigree recital (10th/12th board percentages or CGPA) — standard Indian services ritual, NOT padding" : null,
        ].filter(Boolean).join("; ")}. Mirror lightly if appropriate. Do NOT probe these markers as weakness, deflection, or filler — they are legitimate signal in Indian English.`
      : "";

    /* Tenure-defence probe (B4) — Indian interviewers aggressively probe
       short stints ("but you were there only 14 months no?") and re-ask
       the same question from a different angle to test stability narrative
       coherence. Western rubrics rarely do this. Conservative trigger: the
       candidate's answer mentions a short tenure (under 24 months) AND a
       departure verb. We surface this once per turn — the engine won't let
       the LLM dogpile because each turn is independent. */
    const TENURE_SHORT_RE = /\b(?:(?:after\s+)?(?:only\s+|just\s+|barely\s+)?(?:\d{1,2}|a\s+few|six|nine|eight|ten|eleven|twelve|fourteen|fifteen|eighteen|twenty)\s+months?|(?:about\s+|around\s+|nearly\s+|just\s+over\s+)?(?:one|1|a)\s+year(?:\s+and\s+(?:a\s+)?(?:half|few\s+months))?)\b[\s\S]{0,80}\b(?:left|leaving|leave|moved\s+(?:on|out)|quit|resigned|switched|exit(?:ed)?|transitioned)\b|\b(?:left|leaving|quit|resigned|moved\s+on|exited)\b[\s\S]{0,40}\b(?:after\s+(?:only\s+|just\s+|barely\s+)?(?:\d{1,2}\s+months?|(?:one|1|a)\s+year)|in\s+under\s+(?:a\s+|one\s+)?year)\b/i;
    const tenureProbe = (type === "behavioral" && TENURE_SHORT_RE.test(answer))
      ? `\nTENURE-DEFENCE PROBE — the candidate mentioned a short tenure (<24 months) followed by a departure. Indian interviewers aggressively probe these. If a follow-up is warranted, your ONE follow-up MAY re-ask the "why did you leave" angle from a DIFFERENT cut than the original question already covered: the manager-fit angle ("how was the working relationship with your manager?"), the growth angle ("what was missing for you to stay another year?"), or the timing angle ("was there a specific incident, or was it building up?"). Do NOT escalate or shame. Do NOT call the tenure "short" or "concerning" — neutral curiosity only. Treat instability framing as a non-penalty narrative-coherence check, not a red flag.`
      : "";

    // Salary context for salary-negotiation follow-ups (prevents losing city-adjusted rates)
    const salaryFollowUpCtx = (type === "salary-negotiation" || type === "hr-round")
      ? `\n${lookupSalaryContext({ role, company, currentCity, jobCity })}\nUse ₹ and LPA. Follow-up offers/counters MUST stay within these ranges.
CRITICAL: You are the HIRING MANAGER making a salary offer. Stay in character — do NOT switch to behavioral interview questions. Your follow-ups must be about compensation, benefits, joining timeline, notice buyout, or counter-offers.

NUMBER DISCIPLINE — non-negotiable rules for every salary follow-up:
  1. NEVER output literal "₹X", "₹Y", "₹Z" or any letter placeholders. The hiring manager always speaks in concrete rupee figures (e.g. ₹28 LPA, ₹2 LPA, ₹1.5 LPA bonus). If you can't pick a number, pick one — but never leak the template letter.
  2. NEVER output unfilled tokens like "joining bonus of ₹X" or "₹Z buyout". Always a specific number.
  3. MATH MUST CHECK OUT. If the candidate said ₹50 LPA and your initial offer was ₹28-45 LPA, ₹50 is ABOVE not below. Read carefully before saying "below" or "above" — ₹50 LPA > ₹45 LPA, period. Ranges work: "below ₹45" / "above ₹45". Don't say "slightly below" of an upper-bound when the candidate's number exceeds it.
  4. OFFER COMPONENTS MUST SUM TO THE TOTAL. When stating a "total CTC of X LPA", the components must add up: base + variable + (joining bonus if amortized into CTC) ≈ X. NEVER say things like "total ₹18 LPA, which includes a base of ₹18 LPA and a variable component of ₹18 LPA, plus a ₹18 LPA joining bonus" — that's structurally impossible (sums to ₹54, not ₹18). Before sending, mentally re-add the numbers. If they don't sum within ±10%, rewrite. Joining bonus is one-time, NOT part of recurring CTC; mention it separately, e.g. "total recurring CTC ₹14 LPA (₹11 base + ₹2 variable + ₹1 benefits) plus a one-time ₹2 LPA joining bonus".
  5. NOTICE PERIOD vocabulary: notice periods are "served", "completed", "30 days long", or "60 days remaining". They do NOT "end on a date" — that's an employment end-date, which is different. Use phrasing like "if you can serve a 30-day notice", "if your notice is shorter than 60 days", "we'd want you to start within 45 days of accepting".
  6. RECAPS must include EVERY agreed item with a real number. If joining bonus wasn't agreed yet, don't recap one. If ESOPs weren't discussed, don't recap them. The recap is the agreed package, not a wishlist.
  7. BAND-RESPECT: Your initial offer and all counters MUST stay within negotiationBand.initialOffer to negotiationBand.maxStretch. If the candidate's ask exceeds maxStretch, the answer is "I can't get there — my ceiling is ₹{maxStretch} LPA", NOT silently inflating the offer to match. NEVER offer above maxStretch. Never offer total CTC above what the band specifies, even if the candidate is enthusiastic.
  8. ABOVE-MARKET ASKS: When the candidate asks for a number above your maxStretch, you MUST explicitly tell them it's above your authorized range BEFORE making any counter. Use phrases like "₹{ask} is above what's approved for this role at our level — the band caps at ₹{maxStretch}". Do NOT skip this acknowledgement and just match their number — that's silent capitulation, the worst negotiator behavior. Only after the acknowledgement may you offer your real maxStretch as a counter.`
      : "";

    const prompt = `You are an expert interviewer. Given a candidate's answer to an interview question, decide if a follow-up question is needed.${panelContext}${behavioralModeGuard}${starGapDirective}${culturalRegisterHint}${tenureProbe}

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

${tenseDirective}

PUSHBACK RULE: Real interviewers push back on weak or vague answers — they don't just nod and move on. If the answer is high-level, generic, or lacks specifics (no metrics, no concrete actions, no "I" voice), your follow-up MUST press for specifics ONCE before changing topic. Examples: "That's high-level — what specifically did *you* do?", "Give me a concrete number.", "Walk me through one moment, not the general approach." Do NOT pile on with multiple challenges; one sharp pushback per weak answer.

MIRRORING (rapport): Echo 1-2 distinctive nouns or phrases from the candidate's last answer in your follow-up. If they said "the migration" use "the migration" not "the project". If they said "my team of six" use "your team of six". Research shows verbal mirroring lifts perceived rapport ~30%. Don't be heavy-handed — one or two echoes per follow-up is enough.${mirrorAnchorBlock}

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
{"needsFollowUp":true/false,"followUpText":"The follow-up question (2-3 sentences, conversational). Only include if needsFollowUp is true.","followUpType":"${followUpTypeLabel}","reason":"Brief reason"${isSalaryNeg ? ",\"wantsBreakdown\":true_if_giving_a_breakdown,\"proposedCounter\":number_or_null_if_making_a_counter_offer" : ""}}`;

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

    // Lower temperature for salary-neg specifically — number tracking and
    // range/components reasoning need consistency, not creativity. The
    // Yellow Slice generation loop ("absolute top of what I can approve" ×4)
    // suggests the model was sampling itself into a repetition trap; tighter
    // temperature reduces the chance of that.
    const llmTemp = isSalaryNeg ? 0.15 : 0.3;

    // Extract the most recent AI turn from conversationHistory so we can
    // detect and prevent verbatim repetition. The Accenture session showed
    // the AI asking the SAME question 4 times — prompt-only "don't repeat"
    // rules weren't enough; this is a programmatic guard.
    const previousAiTurnText = (() => {
      if (!conversationHistory) return "";
      // History format includes "Interviewer:" or "AI:" prefixes; grab last one.
      const matches = Array.from(conversationHistory.matchAll(/(?:Interviewer|AI|Hiring Manager):\s*([^\n]+(?:\n(?!Interviewer|AI|Hiring Manager|Candidate|User)[^\n]+)*)/g));
      return matches.length > 0 ? (matches[matches.length - 1][1] || "").trim() : "";
    })();

    function jaccardSimilarity(a: string, b: string): number {
      if (!a || !b) return 0;
      // Strip punctuation, drop very short tokens, drop English/interrogative
      // stopwords. Without this, "what", "you", "the", "and" inflate the
      // intersection and false-positive the dedup retry on legitimately
      // distinct probes.
      const stop = new Set([
        "the","and","you","your","what","when","where","which","who","whom","whose",
        "how","why","that","this","these","those","with","from","into","onto","upon",
        "have","has","had","was","were","been","being","are","could","should","would",
        "did","does","but","not","all","any","one","two","three","for","its","their","them",
        "they","there","then","than","also","just","like","about","after","before","each",
        "such","very","over","much","more","most","some","many","most","tell","share","walk",
        "give","make","made","take","took","get","got","said","say","says","really","actually",
      ]);
      const tokens = (s: string) => new Set(
        s.toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length >= 4 && !stop.has(w)),
      );
      const aSet = tokens(a);
      const bSet = tokens(b);
      const inter = Array.from(aSet).filter((w) => bSet.has(w)).length;
      const union = new Set([...aSet, ...bSet]).size;
      return union > 0 ? inter / union : 0;
    }

    let result: { text: string };
    let retriedDueToDuplicate = false;
    try {
      result = await callLLM({ prompt, temperature: llmTemp, maxTokens: 500, jsonMode: true, fast: true }, 12000, { userId: auth.userId, endpoint: "follow-up" });

      // Seed-question dedup: the LLM sometimes paraphrases the very
      // question the candidate just answered ("balance design and
      // business goals, toughest trade-off" → "specific instance
      // balancing design and business goals, outcome of trade-off").
      // The previousAiTurnText regex misses this when conversationHistory
      // is empty (first follow-up). Compare against the seed `question`
      // explicitly and trigger the same anti-repeat retry.
      let seedDupTriggered = false;
      if (!isSalaryNeg && question && question.length > 30) {
        const tentative = extractJSON<{ followUpText?: string }>(result.text);
        const candidateText = (tentative?.followUpText || "").trim();
        const seedSim = candidateText ? jaccardSimilarity(candidateText, question) : 0;
        if (candidateText && seedSim >= 0.5) {
          seedDupTriggered = true;
          retriedDueToDuplicate = true;
          console.warn(`[follow-up] LLM follow-up ${(seedSim * 100).toFixed(0)}% similar to seed question — retrying`);
          const seedRetryPrompt = `${prompt}

CRITICAL ANTI-REPEAT INSTRUCTION:
The original question you already asked was:
<original_question>
${question.slice(0, 400)}
</original_question>

Do NOT paraphrase that question. Your follow-up MUST probe a different dimension — a specific metric, a counterfactual, the candidate's individual role vs the team's, an obstacle they overcame, or a trade-off they didn't yet articulate. Repeating the same probe in different words is FORBIDDEN.`;
          result = await callLLM({ prompt: seedRetryPrompt, temperature: Math.max(llmTemp + 0.15, 0.4), maxTokens: 500, jsonMode: true, fast: true }, 12000, { userId: auth.userId, endpoint: "follow-up-seed-dedup-retry" });
        }
      }
      // Verbatim-duplicate dedup retry: if the LLM's output normalizes to
      // the same string as ANY prior follow-up in this session (case /
      // whitespace / punctuation insensitive), retry once with explicit
      // anti-repeat instruction citing the duplicate. Distinct from the
      // jaccard-similarity check below — that one fires on "feels
      // similar to the LAST turn"; this one fires on "byte-for-byte
      // identical to ANY turn this session", which is the actual stuck-
      // in-a-loop failure mode. Same call budget (one retry max) — we
      // gate them with `seedDupTriggered` and the new
      // `verbatimDupTriggered` flag so we never spend more than two
      // LLM calls per follow-up.
      let verbatimDupTriggered = false;
      if (
        !seedDupTriggered
        && isSalaryNeg
        && previousFollowUps
        && previousFollowUps.length > 0
      ) {
        const tentative = extractJSON<{ followUpText?: string }>(result.text);
        const candidateText = (tentative?.followUpText || "").trim();
        if (candidateText.length >= 80) {
          const { isDuplicateOfRecent } = await import("./_follow-up-helpers");
          if (isDuplicateOfRecent(candidateText, previousFollowUps)) {
            verbatimDupTriggered = true;
            retriedDueToDuplicate = true;
            // Find the matching prior turn so we can quote it back in the
            // retry prompt — "you already said X" is far more steerable
            // than a generic "don't repeat".
            const { normalizeForDuplicate } = await import("./_follow-up-helpers");
            const candNorm = normalizeForDuplicate(candidateText);
            const matched = previousFollowUps.find(p => normalizeForDuplicate(p) === candNorm) || candidateText;
            console.warn("[follow-up] LLM produced verbatim duplicate of a prior follow-up — retrying with anti-repeat instruction citing the duplicate");
            const verbatimRetryPrompt = `${prompt}

CRITICAL ANTI-REPEAT INSTRUCTION:
You already said this exact reply earlier in this session:
<duplicate_reply>
${matched.slice(0, 500)}
</duplicate_reply>

The candidate has now responded. Repeating the SAME reply is forbidden — it makes the candidate feel unheard and breaks trust. Generate a COMPLETELY DIFFERENT response that:
- Does NOT reuse the wording above (no shared 5+ word phrases)
- ADVANCES the conversation — a concrete ₹ counter, a specific lever you can move (joining bonus / notice flexibility / equity), or an honest "I'm at the ceiling for this role" close
- Acknowledges what the candidate just said in their most recent answer specifically
Repeat-text is FORBIDDEN.`;
            result = await callLLM({ prompt: verbatimRetryPrompt, temperature: Math.max(llmTemp + 0.2, 0.4), maxTokens: 500, jsonMode: true, fast: true }, 12000, { userId: auth.userId, endpoint: "follow-up-verbatim-dedup-retry" });
          }
        }
      }
      // Dedup retry: if the LLM's output is too similar to the previous
      // AI turn, retry once with explicit anti-repeat instruction. Hard
      // guarantee, not a prompt request. Skip if we already retried for
      // seed-question dedup — `previousAiTurnText` typically IS the seed
      // question, so retrying twice in a row wastes a third LLM call.
      // Also skip if the verbatim-duplicate retry already fired.
      if (!seedDupTriggered && !verbatimDupTriggered && previousAiTurnText && previousAiTurnText.length > 40) {
        const tentative = extractJSON<{ followUpText?: string }>(result.text);
        const candidateText = (tentative?.followUpText || "").trim();
        const sim = candidateText ? jaccardSimilarity(candidateText, previousAiTurnText) : 0;
        if (candidateText && sim >= 0.65) {
          retriedDueToDuplicate = true;
          console.warn(`[follow-up] LLM produced text ${(sim * 100).toFixed(0)}% similar to previous AI turn — retrying with anti-repeat instruction`);
          const antiRepeatPrompt = `${prompt}

CRITICAL ANTI-REPEAT INSTRUCTION:
Your last turn to the candidate was:
<previous_turn>
${previousAiTurnText.slice(0, 500)}
</previous_turn>

The candidate has now answered. Generate a COMPLETELY DIFFERENT response that:
- Does NOT repeat the previous turn's wording (no shared 5+ word phrases)
- ADVANCES the conversation (a new question, a concrete number, or an explicit recap of what's been said)
- ${isSalaryNeg ? "If the candidate just shared their target, your reply MUST contain a specific ₹ counter number — not another question." : "Do not ask the same probe twice."}
Repeat-text in followUpText is FORBIDDEN.`;
          result = await callLLM({ prompt: antiRepeatPrompt, temperature: Math.max(llmTemp + 0.15, 0.35), maxTokens: 500, jsonMode: true, fast: true }, 12000, { userId: auth.userId, endpoint: "follow-up-dedup-retry" });
        }
      }
    } catch (llmErr) {
      console.error("Follow-up LLM call failed:", llmErr);
      if (isSalaryNeg) return salaryNegFallback();
      return new Response(JSON.stringify({ needsFollowUp: false, error: "LLM call failed" }), { status: 502, headers });
    }
    void retriedDueToDuplicate; // surfaced via console.warn above; reserved for future telemetry
    const parsed = extractJSON<{ needsFollowUp?: boolean; followUpText?: string; followUpType?: string; wantsBreakdown?: boolean; proposedCounter?: number | null }>(result.text);
    if (!parsed || typeof parsed !== "object") {
      if (isSalaryNeg) return salaryNegFallback();
      return new Response(JSON.stringify({ needsFollowUp: false, error: "LLM response parsing failed" }), { status: 502, headers });
    }
    // Sanitize LLM response fields
    if (typeof parsed.followUpText !== "string") parsed.followUpText = "";
    if (typeof parsed.needsFollowUp !== "boolean") parsed.needsFollowUp = false;

    // ── Breakdown-deflection rescue ──────────────────────────────────
    // Pine Labs / Capgemini bug class (Hirestepx Bugs (3).pdf): candidate
    // says "Can you just give me a breakdown on this ₹27 lakhs?" — and the
    // LLM replies with the deflection "happy to walk through the structure
    // (base, variable, joining bonus, PF) — what part would you like to
    // dig into?". The LLM listed categories without numbers and DID NOT
    // set wantsBreakdown=true, so the server-side templating below never
    // fired. We've shipped that bug FOUR times now via the same regression
    // path. Adding the structural guard here: if the candidate's last
    // message asks for a breakdown, we FORCE wantsBreakdown=true on the
    // parsed output regardless of what the LLM decided. The templating
    // block then engages and emits real numbers. The LLM's deflection
    // becomes the prose lead-in (and stripRupeeFigures scrubs any leaked
    // rupee values from it before templating).
    if (isSalaryNeg && parsed.wantsBreakdown !== true && typeof answer === "string" && answer.length > 0) {
      const { isBreakdownAsk } = await import("./_follow-up-helpers");
      if (isBreakdownAsk(answer)) {
        parsed.wantsBreakdown = true;
        console.warn("[follow-up] Breakdown-deflection rescue: candidate asked for breakdown but LLM did not set wantsBreakdown — forcing true.");
      }
    }

    // ── Server-owned breakdown templating ──────────────────────────────
    // When the LLM signals wantsBreakdown=true, it should NOT have written
    // rupee numbers in followUpText (those were the placeholder-leak source).
    // Compute the breakdown from canonicalInitialOffer (the band's source of
    // truth) and template the sentence server-side. The LLM only contributes
    // the prose lead-in.
    {
      // Headline picker: prefer the live highestOfferMade (so a counter
      // moves the breakdown headline too), fall back to the band anchor.
      // Without this fallback chain the rescue path can fire while the
      // templating skips for null canonicalInitialOffer — leaving the
      // LLM's deflection in place.
      const breakdownHeadline =
        (typeof highestOfferMade === "number" && highestOfferMade > 0 ? highestOfferMade : null) ??
        canonicalInitialOffer;
      if (isSalaryNeg && parsed.wantsBreakdown === true && breakdownHeadline != null) {
        try {
          const { composeBreakdownReply } = await import("./_negotiation-breakdown");
          const composed = composeBreakdownReply(parsed.followUpText, breakdownHeadline);
          if (composed) {
            console.warn("[follow-up] Structural breakdown templating: headline=₹" + breakdownHeadline + " LPA");
            parsed.followUpText = composed;
          }
        } catch (e) {
          console.warn("[follow-up] structural breakdown templating failed:", e);
        }
      }
    }

    // ── Server-owned closing-recap templating ──────────────────────────
    // When the candidate has accepted and we're in the closing phase, the
    // LLM's recap arithmetic was the most trust-destroying failure mode
    // (the Razorpay flat-breakdown bug: every component = the headline).
    // Replace any LLM-authored recap with a templated one driven off the
    // agreed total (= highestOfferMade after acceptance). The LLM's
    // warmth prose stays as the lead-in. See _negotiation-breakdown.ts.
    if (
      isSalaryNeg &&
      typeof highestOfferMade === "number" &&
      highestOfferMade > 0 &&
      parsed.wantsBreakdown !== true
    ) {
      try {
        // Re-derive ConvState here — the prompt-build scope's convState is
        // not in scope at post-LLM templating time. Re-running deriveConvState
        // is cheap (pure function, regex on `answer`) and avoids hoisting
        // a dozen intent flags out of the salary-neg branch.
        const { detectCandidateIntent } = await import("./_follow-up-helpers");
        const { deriveConvState, phaseForState } = await import("./_negotiation-state");
        const intentLocal = detectCandidateIntent(typeof answer === "string" ? answer : "");
        const acceptInHistoryReLocal = /\b(i accept|i agree|sounds good|that works for me|it.?s a deal|happy with|works for me|let.?s go ahead|deal|i.?ll take it|i.?ll take the offer)\b/i;
        const acceptedEverInHistoryLocal = conversationHistory ? acceptInHistoryReLocal.test(conversationHistory) : false;
        const convStateLocal = deriveConvState({
          acceptedThisTurn: intentLocal.accepted,
          conditionalAccept: intentLocal.conditionalAccept,
          rejectedThisTurn: intentLocal.rejected,
          walkAwayThisTurn: intentLocal.walkAway,
          deflectedThisTurn: intentLocal.deflected,
          needsTimeThisTurn: intentLocal.needsTime,
          acceptedEverInHistory: acceptedEverInHistoryLocal || negotiationFacts?.acceptedImmediately === true,
          answer: typeof answer === "string" ? answer : "",
        });
        const effectivePhaseLocal = phaseForState(convStateLocal, salaryPhase);
        if (
          convStateLocal.kind === "accepted" &&
          !convStateLocal.pendingRequest &&
          effectivePhaseLocal === "closing"
        ) {
          const { composeClosingRecapReply } = await import("./_negotiation-breakdown");
          // Did the candidate already state a notice period / joining
          // timeline anywhere in the conversation? If so, the recap tail
          // must NOT re-ask it (Pine Labs T5 bug: candidate said "Join
          // in thirty days itself" earlier, AI's outro re-asked notice
          // period — trips the notice-period-reask detector).
          const transcriptForNotice = ((conversationHistory || "") + " " + (typeof answer === "string" ? answer : "")).toLowerCase();
          const noticeAlreadyProvided =
            /\b(?:thirty|sixty|ninety|fifteen|forty[\s-]?five|\d+)\s*[-]?\s*(?:day|month|week)s?\b/i.test(transcriptForNotice) ||
            /\b(?:i\s+can\s+join|i['']?ll\s+join|join\s+in\s+\w+\s+(?:day|month|week)|notice\s+period\s+is)\b/i.test(transcriptForNotice);
          const composed = composeClosingRecapReply(parsed.followUpText || "", highestOfferMade, { noticeAlreadyProvided });
          if (composed) {
            console.warn("[follow-up] Structural closing-recap templating: total=₹" + highestOfferMade + " LPA");
            parsed.followUpText = composed;
          }
        }
      } catch (e) {
        console.warn("[follow-up] closing-recap templating failed:", e);
      }
    }

    // ── Server-owned counter-offer templating ──────────────────────────
    // When the LLM emits proposedCounter, validate against the band
    // ([highestOfferMade, maxStretch*1.05]) and template the sentence
    // server-side. If invalid or absent but we have a recommendedCounter,
    // fall through to that. The LLM never authors the load-bearing number.
    if (
      isSalaryNeg &&
      negotiationBand &&
      typeof parsed.proposedCounter === "number" &&
      parsed.wantsBreakdown !== true
    ) {
      try {
        const { composeCounterReply } = await import("./_negotiation-counter");
        // Recompute recommendedCounter here — the earlier one is scoped to
        // the prompt-build block. pickServerCounter is pure; recomputing is
        // cheaper than refactoring scopes across a 2000-line handler.
        const { pickServerCounter: pickCounter } = await import("./_follow-up-helpers");
        const recCounter = canonicalInitialOffer != null
          ? pickCounter({
              phase: salaryPhase,
              initialOffer: canonicalInitialOffer,
              maxStretch: negotiationBand.maxStretch,
              walkAway: negotiationBand.walkAway,
              highestOfferMade,
              candidateTarget,
            })
          : null;
        const composed = composeCounterReply(parsed.followUpText, parsed.proposedCounter, {
          highestOfferMade: typeof highestOfferMade === "number" ? highestOfferMade : null,
          maxStretch: negotiationBand.maxStretch,
          recommendedCounter: recCounter,
        });
        if (composed) {
          console.warn(
            `[follow-up] Structural counter templating: ${composed.source} → ₹${composed.counter} LPA (ceiling ₹${negotiationBand.maxStretch}, highest ₹${highestOfferMade ?? "n/a"})`,
          );
          parsed.followUpText = composed.text;
        }
      } catch (e) {
        console.warn("[follow-up] structural counter templating failed:", e);
      }
    }

    // Salary hallucination guard: clamp any salary numbers in LLM response to negotiation band limits
    if (isSalaryNeg && negotiationBand && parsed.followUpText) {
      const offerNumRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakh|lakhs|Cr|cr|crore)/g;
      let match: RegExpExecArray | null;
      let clamped = parsed.followUpText;
      const approvalRe = /\b(approval|leadership|sign.?off|check with|go back to)\b/i;
      // Telemetry: tally clamp events so we can surface the long tail
      // without screenshots. Fired as a single event after clamping.
      const breaches = {
        aboveMaxStretch: 0,
        nearMaxStretch: 0,
        belowWalkAway: 0,
        monotonic: 0,
        aboveCandidateTarget: 0,
        worstBreachPct: 0, // (offered - maxStretch) / maxStretch, bounded ≥ 0
      };
      while ((match = offerNumRe.exec(parsed.followUpText)) !== null) {
        const rawNum = parseFloat(match[1]);
        // Convert Crore to LPA (1 Cr = 100 LPA)
        const isCrore = /cr|crore/i.test(match[0]);
        const num = isCrore ? rawNum * 100 : rawNum;
        if (num > negotiationBand.maxStretch * 1.05) {
          // LLM hallucinated well above max stretch — clamp to maxStretch
          // If LLM already included approval language, just fix the number.
          // If not, the text may sound inconsistent after clamping — add approval framing.
          breaches.aboveMaxStretch++;
          const pct = (num - negotiationBand.maxStretch) / negotiationBand.maxStretch;
          if (pct > breaches.worstBreachPct) breaches.worstBreachPct = pct;
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
          breaches.nearMaxStretch++;
          console.warn(`[follow-up] LLM offered ₹${num} LPA near maxStretch ₹${negotiationBand.maxStretch} — adding approval context`);
          clamped = clamped.replace(match[0], `${match[0]}, which I'd need leadership sign-off for,`);
        } else if (num < negotiationBand.walkAway) {
          // LLM offered below walk-away — clamp to the canonical initial offer
          // (the value actually presented in turn 1, not the band's seed).
          breaches.belowWalkAway++;
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
        // Benefit-context detection: a 0.3× heuristic alone is too loose
        // ("learning budget of ₹10 LPA" against a ₹35 highest passes through).
        // Look ±40 chars around each match for benefit/perk vocabulary that
        // disambiguates a non-salary line item from an actual offer regression.
        const benefitCtxRe = /\b(?:learning|l&d|wellness|wellbeing|certification|cert|training|conveyance|relocation|allowance|stipend|fund|budget|perk|benefit|insurance|premium|gym|wfh|home\s*office|education|tuition|sabbatical|gratuity|pf\b|provident|meal|food|transport|fuel|leave|joining\s+bonus|signing\s+bonus|retention\s+bonus|notice\s+buyout|buyout)\b/i;
        while ((monoMatch = monoRe.exec(clamped)) !== null) {
          const monoNum = parseFloat(monoMatch[1]);
          // Inspect surrounding text for benefit-context keywords. If found,
          // this is a perk/budget line, not a salary regression — skip clamp.
          const ctxStart = Math.max(0, monoMatch.index - 40);
          const ctxEnd = Math.min(clamped.length, monoMatch.index + monoMatch[0].length + 40);
          const ctx = clamped.slice(ctxStart, ctxEnd);
          const isBenefitContext = benefitCtxRe.test(ctx);
          // Retain the size heuristic as a secondary guard for cases where
          // benefit vocabulary isn't present (e.g. "+ ₹2 LPA fuel card" with
          // no surrounding word). Tightened from 0.3 → 0.2 to reduce escapes.
          const isSmallComponent = !isBenefitContext && monoNum < highestOfferMade * 0.2;
          const skipClamp = isBenefitContext || isSmallComponent;
          if (monoNum < highestOfferMade && !skipClamp && !totalCTCMaintained) {
            breaches.monotonic++;
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
            breaches.aboveCandidateTarget++;
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
      let cm: RegExpExecArray | null;
      candTargetRe.lastIndex = 0;
      while ((cm = candTargetRe.exec(answer || "")) !== null) {
        const v = parseFloat(cm[1]);
        const isCrore = /cr|crore/i.test(cm[2]);
        // Always normalize Cr → LPA internally (1 Cr = 100 LPA). Previously
        // we preserved the original label and emitted "₹2 Cr" on patch,
        // silently dropping the 100× magnification when downstream regex
        // matched the smaller pre-multiplied number. LPA is the lingua
        // franca for negotiation throughout this codebase.
        if (Number.isFinite(v) && v > 0) {
          lastCandNum = isCrore ? v * 100 : v;
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
              `₹${lastCandNum} LPA`,
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
      // Bug G fix — opening-turn echo guard. Before the engine has tracked
      // candidateTarget (i.e. on the very first turn the candidate states a
      // number), candidateTarget is null and the entire block below was
      // skipped. Fall back to lastCandNum (parsed from the current answer)
      // so target-echo misattribution is still caught on turn 1.
      const effectiveTarget = candidateTarget && candidateTarget > 0
        ? candidateTarget
        : (lastCandNum && lastCandNum > 0 ? lastCandNum : null);
      if (effectiveTarget !== null && clamped) {
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
            Math.abs(echoedTarget - effectiveTarget) > 0.5;
          if (matchesOwnOffer && !haveDifferentCandidateTarget) continue;
          // Tolerance: 0.5 LPA — anything further off is a misattribution.
          if (Math.abs(echoedTarget - effectiveTarget) > 0.5) {
            console.warn(`[follow-up] Target echo mismatch: candidate target=${effectiveTarget}, AI echoed as ${echoedTarget} — patching`);
            const fixed = teMatch[0].replace(
              /₹?\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crore)/i,
              `₹${effectiveTarget} LPA`,
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
      let componentRepairFired = false;
      const breakdownRe = /(₹\s*(\d+(?:\.\d+)?)\s*LPA[^.?!]*?(?:total\s+(?:compensation|CTC|package)?|in\s+total|all\s+up)[^.?!]*?(?:comprising|including|consisting\s+of|made\s+up\s+of|broken\s+down\s+(?:as|into)|with\s+a\s+breakdown\s+of)[^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+base([^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+variable(?:\s+pay)?([^.?!]*?)₹\s*(\d+(?:\.\d+)?)\s*LPA\s+(?:joining\s+)?bonus/gi;
      clamped = clamped.replace(breakdownRe, (full, prefix, totalStr, baseStr, midA, varStr, midB, bonusStr) => {
        const total = parseFloat(totalStr);
        const base = parseFloat(baseStr);
        const variable = parseFloat(varStr);
        const bonus = parseFloat(bonusStr);
        if (![total, base, variable, bonus].every((n) => Number.isFinite(n) && n > 0)) return full;
        const sum = base + variable + bonus;
        const allEqual = base === variable && variable === bonus;
        // Tightened tolerance from 5% → 3%. At 5%, breakdowns like "₹40 LPA =
        // ₹25 base + ₹10 var + ₹3 bonus" (sum 38, off by 5%) ship as-is, which
        // candidates immediately catch. 3% (₹1.2 on a ₹40 offer) is close to
        // genuine rounding noise but flags real inconsistencies.
        const sumWayOff = Math.abs(sum - total) > Math.max(0.5, total * 0.03);
        if (allEqual || sumWayOff) {
          // 78/15/7 split — realistic for Indian tech CTCs at the
          // junior-to-mid level. Bonus may be 0 if total is small.
          const newBase = Math.round(total * 0.78 * 10) / 10;
          const newVar = Math.round(total * 0.15 * 10) / 10;
          const newBonus = Math.round((total - newBase - newVar) * 10) / 10;
          console.warn(`[follow-up] Component-sum bug: total=${total}, components=${base}/${variable}/${bonus} — recomposing to ${newBase}/${newVar}/${newBonus}`);
          componentRepairFired = true;
          return `${prefix}₹${newBase} LPA base${midA}₹${newVar} LPA variable${midB}₹${newBonus} LPA joining bonus`;
        }
        return full;
      });

      /* Bug D-2 — Generalized component-collapse detector. The narrow
         regex above requires the literal word "bonus" + "total/comprising"
         delimiters. Real bug seen in prod: "₹43 LPA, which includes ₹43
         LPA in base salary, ₹43 LPA variable, and ₹43 LPA in ESOPs per
         year" — same collapse, different vocabulary (ESOPs ≠ bonus,
         "which includes" ≠ "comprising"). Catch any sentence containing
         a "total/which includes" preamble + 3+ LPA numbers all equal to
         the headline. Replace the collapsed components with a 72/12/8/8
         split (base/variable/equity/bonus) that sums correctly. */
      const sentenceRe = /[^.!?]*(?:LPA|lpa|lakhs?)[^.!?]*[.!?]/g;
      let sm: RegExpExecArray | null;
      const collapseAnchorRe = /\b(?:total\s+(?:CTC|compensation|package)|which\s+(?:includes|comprises|breaks?\s+down)|breaks?\s+down\s+as|comprising|consisting\s+of|made\s+up\s+of|breakdown\s+of|package\s+of|offer\s+with)\b/i;
      while ((sm = sentenceRe.exec(clamped)) !== null) {
        const sentence = sm[0];
        if (!collapseAnchorRe.test(sentence)) continue;
        const numRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/g;
        const nums: number[] = [];
        let nm: RegExpExecArray | null;
        while ((nm = numRe.exec(sentence)) !== null) {
          const v = parseFloat(nm[1]);
          if (Number.isFinite(v) && v > 0) nums.push(v);
        }
        if (nums.length < 4) continue; // need total + ≥3 components
        const total = nums[0];
        const components = nums.slice(1);
        const allEqualToTotal = components.length >= 3 && components.every(n => Math.abs(n - total) < 0.05);
        if (!allEqualToTotal) continue;
        const newBase = Math.round(total * 0.72 * 10) / 10;
        const newVar = Math.round(total * 0.12 * 10) / 10;
        const newEq = Math.round(total * 0.08 * 10) / 10;
        const newBonus = Math.round((total - newBase - newVar - newEq) * 10) / 10;
        const replacements = [newBase, newVar, newEq, newBonus];
        let replaced = sentence;
        let i = 0;
        replaced = replaced.replace(numRe, (m) => {
          if (i === 0) { i++; return m; } // keep the headline total
          const r = replacements[i - 1];
          i++;
          if (r === undefined) return m;
          return `₹${r} LPA`;
        });
        if (replaced !== sentence) {
          console.warn(`[follow-up] Generalized component-collapse: total=${total}, ${components.length} components all equal — recomposed`);
          componentRepairFired = true;
          clamped = clamped.replace(sentence, replaced);
        }
      }

      /* Bug F fix — Anti-apology preamble strip. When the component-repair
         logic above rewrites broken numbers, the surrounding apology
         ("I apologize for the confusion. Let me recalculate that for you...")
         survives intact, signalling weakness right before the rewritten
         (now-correct) breakdown. Strip the apology preamble so the corrected
         numbers stand clean — the candidate hears a confident recap, not a
         flustered re-emit. Only fires when we actually fixed numbers; we
         don't want to scrub legitimate apologies for unrelated friction. */
      if (componentRepairFired) {
        const apologyRe = /\b(?:I\s+apologi[sz]e(?:\s+for\s+(?:the\s+)?(?:confusion|mix-up|error|miscalculation|that))?|My\s+apologies(?:\s+for\s+(?:the\s+)?(?:confusion|mix-up|error|that))?|Sorry(?:\s+about\s+that)?|You'?re\s+right(?:[,—-]?\s+(?:I\s+(?:got|had)\s+that\s+wrong|(?:my|that)\s+math\s+was\s+off|let\s+me\s+(?:correct|fix|redo)\s+(?:that|this)))?)\.?\s*(?:Let\s+me\s+(?:recalculate|recompute|redo|correct|fix|walk\s+through)\s+(?:that|this|the\s+(?:math|breakdown|numbers))(?:\s+(?:for\s+you|again|properly))?\.?\s*)?/gi;
        const before = clamped;
        clamped = clamped.replace(apologyRe, "").replace(/^\s+/, "").replace(/\s{2,}/g, " ");
        if (clamped !== before) {
          console.warn(`[follow-up] Anti-apology strip: removed apology preamble after component repair`);
        }
      }
      void componentRepairFired; // silence noUnusedLocals when the branch above is not entered

      /* Band-breach telemetry. One event per turn that produced any
         clamp. Fire-and-forget — never blocks the response. Lets us
         surface the long tail of LLM number hallucinations without
         relying on user screenshots. Worst-breach percentage is the
         signal to alert on; counts are for breakdown. */
      const totalBreaches =
        breaches.aboveMaxStretch +
        breaches.nearMaxStretch +
        breaches.belowWalkAway +
        breaches.monotonic +
        breaches.aboveCandidateTarget;
      if (totalBreaches > 0) {
        void captureServerEvent("negotiation_band_breach", distinctIdFrom(req, auth.userId), {
          above_max_stretch: breaches.aboveMaxStretch,
          near_max_stretch: breaches.nearMaxStretch,
          below_walk_away: breaches.belowWalkAway,
          monotonic: breaches.monotonic,
          above_candidate_target: breaches.aboveCandidateTarget,
          worst_breach_pct: Math.round(breaches.worstBreachPct * 100),
          total_breaches: totalBreaches,
          band_initial_offer: negotiationBand.initialOffer,
          band_max_stretch: negotiationBand.maxStretch,
          phase: salaryPhase || null,
          turn_index: questionIndex ?? null,
        }, req);
      }

      parsed.followUpText = clamped;

      /* Final cleanup pass — defense-in-depth for two LLM artifacts that
       * survive the monotonic / clamping logic above:
       *
       *   1. The "absolute top of what I can approve" duplication ("X — that's
       *      the absolute top of what I can approve — that's the absolute top
       *      of what I can approve"). Anti-repetition prompt rules don't
       *      always hold; this regex strips any 2nd+ occurrence in the same
       *      response.
       *   2. Stray markdown emphasis (`_word_`, `*word*`) that the UI
       *      renders as italic and TTS reads as "underscore word underscore".
       */
      const APPROVAL_PHRASE = "that's the absolute top of what I can approve";
      let cleaned = parsed.followUpText;
      // Collapse "X — that's the absolute top — that's the absolute top" → single occurrence
      const dupRe = new RegExp(`(\\s*[—–-]?\\s*${APPROVAL_PHRASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*[—–-]?\\s*${APPROVAL_PHRASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
      while (dupRe.test(cleaned)) {
        cleaned = cleaned.replace(dupRe, "$1");
      }
      // Strip pair-wise markdown emphasis around single words (don't touch
      // arithmetic like 4*5 or file_names because those don't match the
      // pair-around-word shape).
      cleaned = cleaned.replace(/\b_([A-Za-z][A-Za-z0-9 ]{0,40}?)_\b/g, "$1");
      cleaned = cleaned.replace(/\*([A-Za-z][A-Za-z0-9 ]{0,40}?)\*/g, "$1");
      parsed.followUpText = cleaned;

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
        /* Belt-and-braces: even if Jaccard is below threshold (e.g.
           because the LLM padded the same probe with a couple new
           filler words), a verbatim-prefix match against any recent AI
           turn is a hard fail. Bombay Design Centre session: two
           consecutive turns were literally "I appreciate you sharing
           that. What's most important to you in this package — is it
           the base number…" — Jaccard ~1.0, but `previousFollowUps`
           apparently didn't include the right entries, so the gate
           never tripped. Compute a stable 8-word content-prefix
           fingerprint over the LLM output and trip on any match
           anywhere in the recent script slice we got handed. */
        const prefixFingerprint = (s: string): string => {
          const stop = new Set(["the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for","and","or","but","with","what","how","do","does","can","could","would","should","let","me","just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re"]);
          return s.toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 2 && !stop.has(w))
            .slice(0, 8)
            .join(" ");
        };
        const curFp = prefixFingerprint(parsed.followUpText);
        const prefixHit = curFp.length > 0 && previousFollowUps.some(p => prefixFingerprint(p) === curFp);
        if (maxSim >= 0.55 || prefixHit) {
          console.warn(`[follow-up] Repetition guard fired: similarity=${maxSim.toFixed(2)} prefixHit=${prefixHit} — replacing with progress move`);
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

    // Punctuation hygiene. LLMs occasionally end interrogatives with a
    // period ("how did you measure the impact.") or stitch two clauses
    // with "., " ("Tell me about a failure., What did you learn"). Both
    // read as bugs in the UI. Light surgery only — don't rewrite content.
    if (parsed.followUpText) {
      let t = parsed.followUpText;
      // Collapse "., " → ". " and stray ",." / ".," → "."
      t = t.replace(/\.,\s+/g, ". ").replace(/,\.\s*/g, ". ").replace(/\.\.\s+/g, ". ");
      t = t.replace(/,\s*([.!?])/g, "$1");
      // Flip terminal "." to "?" ONLY when the sentence's first word is a
      // genuine interrogative starter (How/What/Why/Can/etc.). Imperatives
      // like "Walk me through X." or "Tell me about Y." are grammatical
      // with a period and must not be touched.
      const interrogativeRe = /(^|[.!?]\s+)((?:how|what|why|when|where|which|who|whose|whom|can|could|would|should|will|did|do|does|is|are|was|were|have|has|had)\b[^.?!]*)\.(\s|$)/gi;
      t = t.replace(interrogativeRe, (_m, lead, body, tail) => `${lead}${body}?${tail}`);
      parsed.followUpText = t;
    }

    // Strip markdown — Indian-HR voice is plain text. The LLM occasionally
    // emits italic/bold (`_word_`, `*word*`, `**word**`) or backtick-quoted
    // code; in the spoken/rendered chat surface these leak as literal
    // underscores or asterisks. Belt-and-suspenders: prompt forbids it AND
    // we strip here. Order matters — peel ** before * to avoid mangling.
    if (parsed.followUpText) {
      let t = parsed.followUpText;
      t = t.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
      t = t.replace(/(?<![A-Za-z0-9])\*([^*\n]+?)\*(?![A-Za-z0-9])/g, "$1");
      t = t.replace(/(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])/g, "$1");
      t = t.replace(/`([^`\n]+?)`/g, "$1");
      // Strip leading bullet/asterisk markers on lines.
      t = t.replace(/^\s*[*\-•]\s+/gm, "");
      parsed.followUpText = t;
    }

    /* Detector-driven REWRITE pass. Before the telemetry block runs,
       attempt to rewrite the LLM output so the candidate never sees the
       failure modes the detector codifies. The clamp logic above handles
       most numeric drift; this pass closes specific gaps:
         • phantom-counter — replace fabricated "best offer of ₹X" /
           "the ₹X package" with the highest offer the AI has actually
           made this session.
         • premature-close — truncate closing language so the AI's reply
           ends at the last legitimate sentence, not at "I'll have HR
           send you the offer letter".
       This is intentionally narrow: only blocker-severity codes get a
       rewrite. Number-echo-misbind already has a dedicated rewriter
       above (targetEchoRe). Failures that survive the rewrite still flow
       to the telemetry block below — that's the whole point of running
       detection twice. */
    if (parsed.followUpText && type === "salary-negotiation") {
      try {
        const roundLPA = (n: number): number => n >= 10 ? Math.round(n) : Math.round(n * 2) / 2;
        const ceilingForRewrite = (typeof highestOfferMade === "number" ? highestOfferMade : null)
          ?? (canonicalInitialOffer ?? negotiationBand?.initialOffer ?? null);
        let rewritten = parsed.followUpText;

        // ── Phantom-counter rewrite ────────────────────────────────
        // Pattern A: named offer phrase ("our current best offer …
        // is ₹X LPA"). Replace X with the real ceiling.
        if (ceilingForRewrite != null) {
          const phantomA = /((?:our|the|my|company[''’]?s)\s+(?:current|latest|revised|updated|standing|new|best)\s+(?:best\s+)?offer\b[^.!?]{0,160}?₹?\s*)(\d+(?:\.\d+)?)(\s*(?:LPA|lpa|lakhs?|cr|crore))/gi;
          rewritten = rewritten.replace(phantomA, (full, pre, num, post) => {
            const isCr = /cr|crore/i.test(post);
            const v = parseFloat(num) * (isCr ? 100 : 1);
            if (v > ceilingForRewrite * 1.05) {
              console.warn(`[follow-up] Phantom counter: "${full.trim()}" — rewriting ₹${v} → ₹${roundLPA(ceilingForRewrite)} LPA`);
              return `${pre}${roundLPA(ceilingForRewrite)}${post.replace(/(?:lakhs?|cr|crore)/i, "LPA").replace(/lpa/i, "LPA")}`;
            }
            return full;
          });
          // Pattern B: "the ₹X package" with X not matching any reference number.
          const refs = [
            ceilingForRewrite,
            typeof candidateTarget === "number" ? candidateTarget : null,
            typeof prepCompetingOffer === "number" ? prepCompetingOffer : null,
          ].filter((n): n is number => n != null);
          const phantomB = /((?:^|[\s,;.])(?:the|our)\s+₹?\s*)(\d+(?:\.\d+)?)(\s*(?:LPA|lpa|lakhs?|cr|crore)\s+(?:package|offer|comp(?:ensation)?|CTC))/gi;
          rewritten = rewritten.replace(phantomB, (full, pre, num, post) => {
            const isCr = /cr|crore/i.test(post);
            const v = parseFloat(num) * (isCr ? 100 : 1);
            if (refs.some(r => Math.abs(v - r) < 0.15)) return full;
            console.warn(`[follow-up] Phantom number: "${full.trim()}" — rewriting ₹${v} → ₹${roundLPA(ceilingForRewrite)} LPA`);
            return `${pre}${roundLPA(ceilingForRewrite)}${post}`;
          });
        }

        // ── Premature-close truncation ─────────────────────────────
        // If a closing phrase appears in a reply where the candidate
        // hasn't accepted, truncate the reply at the start of the
        // sentence containing the closing phrase. This preserves any
        // legitimate substance earlier in the reply.
        if (!negotiationFacts?.acceptedImmediately) {
          const closingMarker = /(?:(?:let me\s+)?put\s+together\s+(?:the\s+)?final\s+numbers|(?:I[''’]?ll|we[''’]?ll|going\s+to)\s+(?:work\s+with|loop\s+in|connect\s+with|sync\s+with)\s+HR|HR\s+(?:will\s+)?send\s+you\s+(?:the|a)\s+(?:formal\s+)?offer\s+letter|put\s+together\s+the\s+(?:final[,\s]+)?(?:formal\s+)?offer\s+letter|finaliz(?:e|ing)\s+(?:the\s+)?(?:offer|package|paperwork|details))/i;
          const cm = rewritten.match(closingMarker);
          if (cm && typeof cm.index === "number") {
            // Find the start of the sentence containing the closing phrase.
            let sentStart = 0;
            for (let i = cm.index; i > 0; i--) {
              if (/[.!?]/.test(rewritten[i - 1]) && /\s/.test(rewritten[i] ?? "")) {
                sentStart = i;
                break;
              }
            }
            const head = rewritten.slice(0, sentStart).trim();
            // Drop the closing sentence; preserve everything before it.
            // If the entire reply was the closing sentence, leave a
            // safe non-closing redirect so we don't return an empty
            // string (would surface as a blank turn).
            const safeFallback = "Let's keep working through this — what specifically would change your mind on the package?";
            const truncated = head.length > 20 ? head : safeFallback;
            console.warn(`[follow-up] Premature close: truncating at "${cm[0]}" — kept ${truncated.length} chars`);
            rewritten = truncated;
          }
        }

        // ── Hallucinated-employer rewrite ──────────────────────────
        // If the AI named a current-employer near notice/joining/current
        // context, and that name wasn't said by the candidate AND isn't
        // the hiring company, replace "at <Name>" with "at your current
        // company". Keeps the sentence grammatical without inventing.
        const candidateText = [
          typeof conversationHistory === "string" ? conversationHistory : "",
          typeof answer === "string" ? answer : "",
        ].join("\n").toLowerCase();
        const hiringCompanyLower = (company || "").toLowerCase();
        const employerCtxRe = /(notice\s+period|current\s+company|current\s+employer|currently\s+at|currently\s+work(?:ing)?|leaving|joining)\s+(at|with|from|in)\s+([A-Z][A-Za-z0-9]{1,}(?:\s+[A-Z][A-Za-z0-9]+)?)\b/gi;
        const employerStoplist = new Set(["India","Bangalore","Bengaluru","Mumbai","Delhi","Hyderabad","Chennai","Pune","Kolkata","Gurgaon","Noida","Ahmedabad","HR","Mr","Ms","Mrs","Sir","Madam"]);
        rewritten = rewritten.replace(employerCtxRe, (full, ctxWord, prep, name) => {
          if (employerStoplist.has(name)) return full;
          const lname = name.toLowerCase();
          if (hiringCompanyLower && (lname.includes(hiringCompanyLower) || hiringCompanyLower.includes(lname))) return full;
          if (candidateText.includes(lname)) return full;
          console.warn(`[follow-up] Hallucinated employer "${name}" in "${full}" — replacing with "your current company"`);
          return `${ctxWord} at your current company`;
        });

        // ── Role-title drift rewrite ───────────────────────────────
        // Mirror the qualifier-group logic from
        // _negotiation-failures.ts:detectRoleTitleDrift. Cross-family
        // titles ("Engineering Manager" vs backend-engineer) always
        // rewrite. Same-family titles with disjoint qualifier groups
        // ("Senior Product Designer" vs ux-designer — same designer
        // family, but {product} ≠ {ui-ux}) also rewrite. Within-group
        // variants ("UI Designer" vs ux-designer) are left alone.
        // Less invasive than substituting the canonical title — replace
        // with "this role" so we don't fight slug↔display-form casing.
        if (role) {
          const SENIORITY = new Set(["senior","sr","junior","jr","principal","staff","lead","associate","entry","level"]);
          const SUFFIX_FAMILIES: Record<string, string[]> = {
            designer: ["designer","design"],
            engineer: ["engineer","developer","dev"],
            manager: ["manager","management","lead"],
            analyst: ["analyst","analytics","analysis"],
            scientist: ["scientist","researcher"],
            architect: ["architect"], consultant: ["consultant"],
            director: ["director"], officer: ["officer"], specialist: ["specialist"],
          };
          const QGROUPS: Record<string,string> = {
            ui:"ui-ux", ux:"ui-ux", fe:"frontend", frontend:"frontend",
            "front-end":"frontend", be:"backend", backend:"backend",
            "back-end":"backend", full:"fullstack", fullstack:"fullstack",
            "full-stack":"fullstack", android:"mobile", ios:"mobile",
            mobile:"mobile", ai:"ml", ml:"ml", machine:"ml",
            infra:"platform", infrastructure:"platform", platform:"platform",
          };
          const tokensOf = (s: string) => s.toLowerCase().split(/[\s/_-]+/).filter(Boolean);
          const familyOf = (s: string): string | null => {
            const t = tokensOf(s);
            for (let i = t.length - 1; i >= 0; i--) {
              for (const [fam, syns] of Object.entries(SUFFIX_FAMILIES)) {
                if (syns.includes(t[i])) return fam;
              }
            }
            return null;
          };
          const groupsOf = (s: string): Set<string> => {
            const t = tokensOf(s);
            const fam = familyOf(s);
            const famSyns = fam ? new Set(SUFFIX_FAMILIES[fam]) : new Set<string>();
            const g = new Set<string>();
            for (const tok of t) {
              if (SENIORITY.has(tok)) continue;
              if (famSyns.has(tok)) continue;
              if (tok.length < 2) continue;
              g.add(QGROUPS[tok] ?? tok);
            }
            return g;
          };
          const roleFam = familyOf(role);
          const roleGroups = groupsOf(role);
          const roleTitleRe = /\b((?:[A-Z][a-z]+(?:[/-][A-Z][a-z]+)?\s+){1,3}(?:Designer|Engineer|Developer|Manager|Analyst|Architect|Scientist|Specialist|Consultant|Director|Lead|Officer))\b/g;
          if (roleFam) {
            rewritten = rewritten.replace(roleTitleRe, (full, title) => {
              const titleFam = familyOf(title);
              if (!titleFam) return full;
              if (titleFam !== roleFam) {
                console.warn(`[follow-up] Role drift (family): "${full}" vs role "${role}" — rewriting to "this role"`);
                return "this role";
              }
              const titleGroups = groupsOf(title);
              if (roleGroups.size > 0 && titleGroups.size > 0) {
                let overlap = false;
                for (const g of titleGroups) if (roleGroups.has(g)) { overlap = true; break; }
                if (!overlap) {
                  console.warn(`[follow-up] Role drift (qualifier): "${full}" vs role "${role}" — rewriting to "this role"`);
                  return "this role";
                }
              }
              return full;
            });
          }
        }

        // ── Flat-breakdown rewrite ─────────────────────────────────
        // Razorpay round-5: every component was ₹49 LPA — placeholder
        // substitution failure. We can't fabricate a correct breakdown
        // post-hoc, but we can collapse the bogus breakdown to a
        // headline+redirect that doesn't lie. Triggers when ≥3 LPA
        // mentions of the same number appear alongside ≥2 component
        // keywords (base/variable/ESOP/PF/joining/gratuity).
        try {
          const componentRe = /\b(?:base\s+(?:salary|pay|component)|variable\s+(?:component|pay|bonus)|joining\s+bonus|gratuity|provident\s+fund|\bPF\b|ESOPs?|RSUs?|stock\s+options)\b/gi;
          const comps = rewritten.match(componentRe) ?? [];
          if (comps.length >= 2) {
            const numRe = /₹\s*(\d+(?:\.\d+)?)\s*(?:LPA|lpa|lakhs?)/g;
            const counts = new Map<string, number>();
            let mm: RegExpExecArray | null;
            while ((mm = numRe.exec(rewritten)) !== null) {
              const k = parseFloat(mm[1]).toFixed(2);
              counts.set(k, (counts.get(k) ?? 0) + 1);
            }
            let flatNum: number | null = null;
            for (const [k, c] of counts) {
              if (c >= 3) { flatNum = parseFloat(k); break; }
            }
            if (flatNum != null) {
              const headline = flatNum;
              console.warn(`[follow-up] Flat breakdown: ₹${headline} LPA repeated — collapsing to headline.`);
              rewritten = `The total CTC stays at ₹${headline} LPA — happy to walk through the structure (base, variable, joining bonus, PF) if that would help. What part would you like to dig into?`;
            }
          }
        } catch (e) {
          console.warn("[follow-up] flat-breakdown rewrite failed:", e);
        }

        // ── Phantom competing-offer gate (structural) ──────────────
        // Step 3 of the structural-fix series. Replaced the per-regex
        // rewriter with a hard pre-send gate: if the session has no
        // recorded competing offer AND the candidate didn't affirmatively
        // mention one (with negation guard for the "any offer? no" pattern),
        // strip ALL competing-offer references — sentence by sentence —
        // instead of substituting per-phrase. Broad coverage by default;
        // the LLM cannot invent a variant the rewriter misses.
        try {
          const sessionHasCompetingOffer =
            (typeof prepCompetingOffer === "number" && prepCompetingOffer > 0) ||
            negotiationFacts?.hasCompetingOffers === true ||
            negotiationScenario === "competing";
          const { stripPhantomCompetingOffer } = await import("./_negotiation-competing");
          const result = stripPhantomCompetingOffer(rewritten, {
            sessionHasCompetingOffer,
            candidateText,
          });
          if (result.stripped) {
            console.warn("[follow-up] Phantom competing-offer gate: sentences stripped.");
            rewritten = result.text;
          }
        } catch (e) {
          console.warn("[follow-up] phantom-competing gate failed:", e);
        }

        // ── Counter-below-ceiling rewrite ──────────────────────────
        // Razorpay round-5: "revised offer of ₹35.3 LPA" when ceiling
        // was ₹49 LPA. Replace the number with the ceiling.
        try {
          if (ceilingForRewrite != null) {
            const counterDownRe = /((?:revised|updated|new|pushed?(?:\s+for)?|can\s+do|stretch\s+to|landing\s+at|come\s+up\s+to|i'?ll\s+push\s+for)\s+(?:an?\s+|the\s+)?(?:revised\s+|updated\s+|new\s+)?offer\s+of\s+₹?\s*)(\d+(?:\.\d+)?)(\s*(?:LPA|lpa|lakhs?|cr|crore))/gi;
            rewritten = rewritten.replace(counterDownRe, (full, pre, num, post) => {
              const isCr = /cr|crore/i.test(post);
              const v = parseFloat(num) * (isCr ? 100 : 1);
              if (v < ceilingForRewrite - 0.5) {
                console.warn(`[follow-up] Counter-below-ceiling: "${full.trim()}" — rewriting ₹${v} → ₹${roundLPA(ceilingForRewrite)} LPA`);
                return `${pre}${roundLPA(ceilingForRewrite)}${post.replace(/(?:lakhs?|cr|crore)/i, "LPA").replace(/lpa/i, "LPA")}`;
              }
              return full;
            });
          }
        } catch (e) {
          console.warn("[follow-up] counter-below-ceiling rewrite failed:", e);
        }

        // ── Trailing closing-question scrub ────────────────────────
        // Every session in the bug doc had an outro that ended with a
        // question and no answer affordance. If the (already-truncated
        // or not) reply contains closing language AND ends with "?",
        // drop the final question sentence and replace with a
        // declarative close.
        try {
          const closingMarker = /(?:put\s+together\s+(?:the\s+)?final\s+numbers|work\s+with\s+HR\s+to|HR\s+(?:will\s+)?send\s+you\s+(?:the|a)\s+(?:formal\s+)?offer\s+letter|finaliz(?:e|ing)\s+(?:the\s+)?(?:offer|package|paperwork))/i;
          const trimmed = rewritten.trim();
          if (closingMarker.test(trimmed) && trimmed.endsWith("?")) {
            // Find the start of the trailing question sentence.
            let qStart = trimmed.length - 1;
            for (let i = trimmed.length - 2; i >= 0; i--) {
              if (/[.!?]/.test(trimmed[i]) && /\s/.test(trimmed[i + 1] ?? "")) {
                qStart = i + 1;
                break;
              }
              if (i === 0) qStart = 0;
            }
            const head = trimmed.slice(0, qStart).trim();
            const declarativeTail = " HR will reach out shortly with next steps.";
            rewritten = (head.length > 20 ? head : trimmed.slice(0, Math.min(trimmed.length, 120))) + declarativeTail;
            console.warn(`[follow-up] Trailing closing-question stripped.`);
          }
        } catch (e) {
          console.warn("[follow-up] trailing-question rewrite failed:", e);
        }

        if (rewritten !== parsed.followUpText) {
          parsed.followUpText = rewritten;
        }
      } catch (e) {
        console.warn("[follow-up] detector-rewrite pass failed:", e);
      }
    }

    /* Duplicate-reply rescue (second-line defense). The LLM-call layer
       already attempts ONE regenerate with explicit anti-repeat
       instruction when the initial output normalizes to a prior
       follow-up (see verbatimDupTriggered above). If that retry STILL
       produces a duplicate after all post-LLM clamps, this block is
       the templated safety net — swap the duplicate for a concrete-
       move escape hatch BEFORE the response ships. Runs after all
       other clamps so the rescue is what the candidate actually sees,
       and runs before the detector telemetry so a successful rescue
       doesn't fire a false negative. */
    if (
      parsed.followUpText
      && type === "salary-negotiation"
      && previousFollowUps
      && previousFollowUps.length > 0
    ) {
      try {
        const { isDuplicateOfRecent, composeDuplicateReplyRescue } = await import("./_follow-up-helpers");
        if (isDuplicateOfRecent(parsed.followUpText, previousFollowUps)) {
          const rescued = composeDuplicateReplyRescue({
            highestOfferMade: typeof highestOfferMade === "number" ? highestOfferMade : null,
            maxStretch: negotiationBand?.maxStretch ?? null,
          });
          console.warn(
            "[follow-up] Duplicate-reply rescue: LLM emitted a verbatim duplicate of a prior reply — replacing with concrete-move escape hatch.",
          );
          parsed.followUpText = rescued;
        }
      } catch (e) {
        console.warn("[follow-up] duplicate-reply rescue failed:", e);
      }
    }

    /* Detector-based failure telemetry. After ALL post-LLM clamps and
       strippers run, we feed the final reply through the same detector
       suite the replay harness uses (server-handlers/_negotiation-failures.ts).
       Any failure that survives the clamps is, by definition, a leak the
       guardrails missed. We emit one event per turn that produced ≥1
       failure code, with the llmOutput attached so the recorded reality
       can be replayed offline as a new fixture. This builds the corpus
       PostHog has been missing — without it, we can only ever fix the
       bug in the screenshot in front of us. Fire-and-forget; never
       blocks the response. */
    if (parsed.followUpText && type === "salary-negotiation") {
      try {
        const failures = detectAllFailures({
          llmOutput: parsed.followUpText,
          acceptedImmediately: !!negotiationFacts?.acceptedImmediately,
          rejectedOutright: !!negotiationFacts?.rejectedOutright,
          candidateTargetLpa: typeof candidateTarget === "number" ? candidateTarget : null,
          competingOfferLpa: typeof prepCompetingOffer === "number" ? prepCompetingOffer : null,
          band: negotiationBand
            ? {
                initialOffer: negotiationBand.initialOffer,
                maxStretch: negotiationBand.maxStretch,
                walkAway: negotiationBand.walkAway,
                hasEquity: negotiationBand.hasEquity,
              }
            : undefined,
          phase: salaryPhase || undefined,
          questionIndex,
          isInitialOffer: questionIndex === 1,
          highestOfferMade: typeof highestOfferMade === "number" ? highestOfferMade : null,
          previousAiTurns: previousFollowUps,
          hiringCompany: company || null,
          candidateTranscript: [
            typeof conversationHistory === "string" ? conversationHistory : "",
            typeof answer === "string" ? answer : "",
          ].join("\n"),
          sessionRole: role || null,
          candidateLastMessage: typeof answer === "string" ? answer : null,
        });
        if (failures.length > 0) {
          void captureServerEvent(
            "negotiation_turn_failure",
            distinctIdFrom(req, auth.userId),
            {
              codes: failures.map(f => f.code).join(","),
              code_count: failures.length,
              top_severity: failures.find(f => f.severity === "blocker")
                ? "blocker"
                : failures.find(f => f.severity === "major")
                  ? "major"
                  : "minor",
              llm_output: parsed.followUpText.slice(0, 2000),
              candidate_target: typeof candidateTarget === "number" ? candidateTarget : null,
              competing_offer: typeof prepCompetingOffer === "number" ? prepCompetingOffer : null,
              band_initial_offer: negotiationBand?.initialOffer ?? null,
              band_max_stretch: negotiationBand?.maxStretch ?? null,
              band_walk_away: negotiationBand?.walkAway ?? null,
              band_has_equity: negotiationBand?.hasEquity ?? null,
              phase: salaryPhase || null,
              question_index: questionIndex ?? null,
              is_initial_offer: questionIndex === 1,
              role: role || null,
              company: company || null,
            },
            req,
          );
        }
      } catch (e) {
        // Telemetry must never break a request.
        console.warn("[follow-up] negotiation_turn_failure capture failed:", e);
      }
    }

    /* Item #1 minimum-viable: signal conversationDone so the client engine
       can skip remaining anchors when the negotiation has resolved. True
       when (a) candidate explicitly accepted OR (b) candidate walked
       away. Rejection alone does NOT end the conversation — the AI
       continues countering. The client uses this to jump straight to
       the closing step instead of marching through the 5-anchor arc. */
    const walkAwayPatFinal = /\b(walk away|walking away|i.?m out|not interested|decline|pull out|no deal|have to pass|withdraw)\b/i;
    const isCandidateAcceptance = type === "salary-negotiation" && !!negotiationFacts?.acceptedImmediately;
    const isCandidateWalking = type === "salary-negotiation" && typeof answer === "string" && walkAwayPatFinal.test(answer);
    const conversationDone = isCandidateAcceptance || isCandidateWalking;

    return new Response(JSON.stringify({
      needsFollowUp,
      followUpText: parsed.followUpText || "",
      followUpType: followUpTypeLabel,
      persona: persona ? ({"hiring manager": "Hiring Manager", "technical lead": "Technical Lead", "hr partner": "HR Partner"} as Record<string, string>)[persona.toLowerCase()] || persona : undefined,
      // Salary-negotiation only. Always false for other interview types
      // so the client can read the flag unconditionally.
      conversationDone,
    }), { status: 200, headers });
  } catch (err) {
    console.error("Follow-up generation error:", err);
    // Return needsFollowUp: false so the interview continues, but use 502 status
    // so client-side can distinguish between "no follow-up needed" and "error occurred"
    return new Response(JSON.stringify({ needsFollowUp: false, error: "Follow-up generation failed" }), { status: 502, headers });
  }
}
