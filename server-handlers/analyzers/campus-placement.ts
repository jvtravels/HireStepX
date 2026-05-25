/* Campus-placement interview analyzer.
 *
 * Tailored to Indian campus / fresher hiring patterns. Catches:
 *   - Generic "passion for technology" answers without specifics
 *   - No academic project or capstone discussed
 *   - AI didn't ask about CGPA / coursework / availability
 *   - User badmouthed the college / professors
 *   - Project descriptions with no concrete tech stack named
 *   - Implausible team-size claims ("I led 20 people in a college project")
 *   - "Why this company" asked but answered with no company-specific signal
 *   - Volunteered backlogs / KTs / low CGPA unprompted (poor framing)
 *   - Excessive filler words ("basically", "as such", "like")
 *   - Internship claimed in resume but never elaborated
 *
 * ── Version history ────────────────────────────────────────────────
 *   v2   deterministic baseline (initial waves 1–3).
 *   v5   Phase 1 quick wins — tier-adjusted CGPA surfaced
 *        (`meta.campusPlacement`), `PASSION_SUBSTANTIATED` / `SUBSTANTIATION_TOKEN`
 *        pair, static-fallback banner.
 *   v6   Phase 2 depth validators — `TECH_APPLIED`, `PORTFOLIO_LINK`,
 *        `PROJECT_RECENT_MARKER` / `PROJECT_DISTANT_MARKER`. New flags
 *        `tech_named_but_not_applied`, `portfolio_link_present`,
 *        `projects_dated_not_recent`.
 *   v6.2 Phase 3 archetypes — `_campus-archetype.ts` resolves
 *        tcs-ninja / tcs-digital / wipro-nlth / top-tier-campus / unknown.
 *        Archetype overrides the coarse-tier CGPA cutoff; surfaces as
 *        `campus_archetype_*` flag + `meta.campusPlacement.archetypeLabel`.
 *   v6.3 Phase 4 hygiene — fixture suite (`campusPlacementFixtures.test.ts`),
 *        register-rule inheritance in `generate-questions.ts`, prompt-cache
 *        order verified.
 *   v6.4 Phase 5 stretch — `backlog_honest_disclosure` (positive pair to
 *        `active_backlog_evasion`) + `aptitude_project_inconsistency`
 *        cross-signal. Bond awareness covered by Wave-3 patterns.
 *   v6.5 Phase 6 realism calibration — (a) MTI whitelist now allows
 *        "passed out 2024" (standard Indian English; recruiters don't
 *        deduct); (b) new `COMPANY_SERVICE_TIER_NARRATIVE` regex +
 *        `service_tier_why_company_acceptable` positive flag — TCS NQT /
 *        Wipro NLTH candidates saying "structured training / proven
 *        client base / long-term stability" no longer fire
 *        `no_company_specific_research` (they were product-co graded
 *        wrongly); (c) `weak_reverse_questions` suppressed for
 *        tcs-ninja / wipro-nlth archetypes (acceptable filler at
 *        service-tier); (d) `archetypeCgpaCutoff("wipro-nlth")` moved
 *        6.5 → 6.0 to match the 2025 firm-wide floor; (e) the
 *        aptitude-probe prompt in generate-questions now routes
 *        cognitive-coding (SQL / strings) to TCS / Infosys and
 *        classical puzzles to Wipro / Cognizant.
 *   v6.6 Post-v6.5 realism audit — six gaps closed:
 *        (a) `college_cgpa_policy_acknowledged` positive flag — when a
 *        candidate cites the TPO / college internal CGPA cutoff
 *        alongside a stated CGPA, the bare number isn't framing-naked.
 *        Suppresses `cgpa_low_no_framing` (treated as framing context).
 *        (b) Bond multi-probe gate — `bond_unprepared` now requires the
 *        AI to have probed bond ≥2 times before firing. Eliminates the
 *        false-positive on freshers who simply weren't asked twice.
 *        `bondProbeCount` surfaced on meta. (c) Reverse-question
 *        mid-session tracking — if the candidate asked ≥1 SPECIFIC
 *        question BEFORE the closing slot, suppress `weak_reverse_questions`
 *        even at tcs-digital / top-tier-campus (and emit
 *        `mid_session_questions_present` as a positive signal).
 *        (d) Aptitude probe expected-type surfaced on meta
 *        (`aptitudeProbeExpectedType`) so the LLM evaluator can grade
 *        whether the generated probe matched the archetype.
 *        (e) `internship_company_unrecognized` — transcript-only signal
 *        when claimed-internship company doesn't match any of the
 *        top ~70 Indian tech employers AND no resume is loaded to
 *        verify. Low severity, informational.
 *        (f) MTI "graduated in 2024" was already a no-op (no pattern
 *        in v6.5 list matches it); documented in the realism note.
 *   v6.7 Post-v6.6 realism audit — six gaps closed:
 *        (a) `cognizant-genc` archetype split out from `wipro-nlth`
 *        (Cognizant + Capgemini Exceller). Cognizant's "client rotation
 *        / domain breadth" narrative now gets credit on the why-company
 *        probe via the new `COGNIZANT_CLIENT_ROTATION_NARRATIVE` regex,
 *        which feeds the existing `service_tier_why_company_acceptable`
 *        positive flag. (b) Short-screening gate — when
 *        `transcript.length < 10`, suppress `bond_unprepared` and
 *        `reverse_questions_declined`; an HR-screening call doesn't
 *        always hit the closing slot or probe bond twice. Emits the
 *        positive flag `short_screening_session_acknowledged`.
 *        (c) `shipped_to_prod_context` positive flag — when a candidate
 *        narrates a project with concrete shipped-to-prod evidence
 *        (active users / production deploy / merged PR / shipped feature),
 *        emit the positive flag and suppress `portfolio_absent_for_claim`
 *        at product-grade archetypes (top-tier-campus / tcs-digital).
 *        (d) `location_agnostic_signal` — at tcs-digital, a candidate
 *        who explicitly states they're open to any location / pan-India
 *        gets credit instead of being silently dinged for not probing
 *        relocation. (e) `aptitude_puzzle_refusal` severity downgraded
 *        to "low" for tcs-digital — that loop is offline-coding-format,
 *        not live-puzzle. (f) `weak_reverse_questions` at unknown
 *        archetype now adopts service-tier leniency (generic reverse
 *        questions are acceptable when we can't pin down archetype).
 *   v6.8 Post-v6.7 audit — severity coherence pass:
 *        (a) `aptitude_puzzle_refusal` severity calibrated by archetype
 *        loop format: tcs-digital "low" (offline-coding format),
 *        tcs-ninja / unknown "medium" (NQT live round doesn't dwell on
 *        puzzles; unknown can't be pinned to either side), wipro-nlth /
 *        cognizant-genc / top-tier-campus stay "high" where classical
 *        puzzles and DSA-on-the-spot ARE the loop. Removes the
 *        unknown-archetype incoherence where v6.7 granted service-tier
 *        leniency on reverse questions but still slammed "high" on
 *        aptitude refusal. (b) Two new ground-truth fixtures exercise
 *        the v6.7 positive flags `shipped_to_prod_context` +
 *        `location_agnostic_signal` end-to-end so the regression net
 *        catches future drift on the suppression chains they feed.
 *   v6.9 Maintainability pass — zero-behavior-change refactor: the
 *        57-entry flag → coaching-tip if-chain at the bottom of the
 *        analyzer extracted to `_campus-tips.ts` as a single
 *        `CAMPUS_FLAG_TIPS: Record<string, string>` dictionary. The
 *        analyzer's final step iterates the live flag set and joins
 *        matching tips. Drops ~55 lines from this file (now under the
 *        1500-LOC ESLint warn line) and makes a missing tip for a
 *        newly-added flag trivially discoverable in one place.
 *   v6.10 Maintainability pass (cont.) — second zero-behavior-change
 *        extraction: 87 regex constants + thresholds moved to
 *        `_campus-regex.ts`. Drops main file from 1801 → 1498 LOC
 *        (under the 1500 warn line). `campusReadinessParity.test.ts`
 *        updated to read the regex module directly; parity assertion
 *        unchanged. All 10 parity pairs (PROJECT_NARRATION / TECH_STACK
 *        / etc. against the live coaching-chip copies) still
 *        byte-identical-asserted on every test run.
 * ──────────────────────────────────────────────────────────────────
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";
import { classifyCompanyTier } from "../_company-tier";
import { classifyCollegeTier, cgpaCutoffAdjustment } from "../_college-tier";
import { classifyCampusArchetype, archetypeCgpaCutoff, archetypeLabel } from "../_campus-archetype";
import { parsePeriodMonths, NUM_WORDS, SPOKEN_DURATION_REGEX } from "../_resume-period";
import { CAMPUS_FLAG_TIPS } from "./_campus-tips";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

// v6.10 — regex constants + thresholds extracted to _campus-regex.ts.
// The parity test in campusReadinessParity.test.ts reads that module
// directly and asserts byte-identical regex source against the live
// coaching-chip copies in src/_campus-readiness.ts.
import {
  ACADEMIC_PROJECT, FRESHER_LEXICON, GENERIC_PASSION, SPECIFIC_PROJECT,
  SUBSTANTIATION_TOKEN, AVAILABILITY, COLLEGE_BADMOUTH, TECH_STACK,
  TECH_STACK_G, PROJECT_NARRATION, TECH_APPLIED, PROJECT_RECENT_MARKER,
  PROJECT_DISTANT_MARKER, IMPLAUSIBLE_TEAM, WHY_COMPANY_PROBE, COMPANY_GENERIC_FILLER,
  COMPANY_SPECIFIC_SIGNAL, COMPANY_SERVICE_TIER_NARRATIVE, COGNIZANT_CLIENT_ROTATION_NARRATIVE, LOCATION_AGNOSTIC_SIGNAL,
  SHIPPED_TO_PROD_CONTEXT, VOLUNTEERED_DEFICIT, DEFICIT_PROBE, FILLER,
  FILLER_PER_100_WORDS_THRESHOLD, INTERNSHIP_CLAIM, INTERNSHIP_DETAIL, MTI_PATTERNS,
  CGPA_STATED, COLLEGE_CGPA_POLICY, CGPA_FRAMING_CONTEXT, REVERSE_QUESTION_PROBE,
  REVERSE_QUESTION_SPECIFIC, REVERSE_QUESTION_GENERIC, REVERSE_QUESTION_DECLINED, BOND_PROBE,
  BOND_HEALTHY_RESPONSE, BOND_REFUSAL, BOND_IGNORANCE, ATTRITION_HIGHER_STUDIES,
  RELOCATION_REFUSAL, RELOCATION_PROBE, SHIFT_REFUSAL, SHIFT_PROBE,
  CLICHE_STRENGTH_WEAKNESS, STRENGTH_WEAKNESS_PROBE, TMAY_PROBE, RESUME_RECITAL,
  CAREER_GOAL_PROBE, CAREER_GOAL_VAGUE, CAREER_GOAL_SPECIFIC, HACKATHON_CLAIM,
  HACKATHON_DETAIL, BUZZWORD, FAMILY_PRESSURE, NEGATIVE_COMPARE,
  SALARY_EXPECTATION_PROBE, SALARY_NUMBER_LPA, USER_SALARY_RAISED, CLAIMED_BUILT,
  PORTFOLIO_LINK, BACKLOG_PROBE, BACKLOG_EVASIVE, BACKLOG_CLEAN,
  NONCS_BRANCH, BRANCH_LEARNING_NARRATIVE, PPT_REFERENCE, CODING_SCORE_PROBE,
  CODING_SCORE_RATIONALE, PARALLEL_EXAM_PREP, GRANDIOSE_CLAIM, FYP_SOLO_CLAIM,
  FYP_TEAM_MENTION, STIPEND_PROBE, STIPEND_DODGE, STIPEND_CONCRETE,
  MEMORIZED_TEMPLATE, APTITUDE_LIVE_PROBE, APTITUDE_REFUSAL, ONSITE_QUERY,
  NEPOTISM_MENTION, INHAND_CTC_CONFUSION, CODE_WRITE_PROBE, CODE_WRITE_REFUSAL,
  MONTH_YEAR_RANGE, BRANCH_NAME, DUAL_DEGREE_CONNECTOR,
} from "./_campus-regex";

/* ── Resume-aware helpers (Wave-6) ────────────────────────────────── */

/** Canonical branch keys we use for cross-checks (CSE, IT, IS, ECE, EEE,
 *  Mech, Civil, Chem, Biotech, AIML, AIDS, DataScience). Anything else
 *  resolves to undefined so callers can skip the check. */
function canonicalizeBranch(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return undefined;
  if (/^c(omputer)?s(cience)?(?:andengineering)?$/.test(k) || k.includes("cse")) return "cse";
  if (/^i(nformation)?t(echnology)?$/.test(k) || k.endsWith("informationtechnology")) return "it";
  if (/^i(nformation)?s(cience)?$/.test(k) || k.endsWith("informationscience")) return "is";
  if (k.includes("ece") || k.includes("electronicscommunication")) return "ece";
  if (k.includes("eee") || k.includes("electricalelectronics")) return "eee";
  if (k.includes("mechanical")) return "mech";
  if (k.includes("civil")) return "civil";
  if (k.includes("chemical") || k.includes("chemengg")) return "chem";
  if (k.includes("biotech")) return "biotech";
  if (k.includes("aiml") || k.includes("machinelearning")) return "aiml";
  if (k.includes("aids") || k.includes("datascienceengineering")) return "aids";
  if (k.includes("datascience")) return "datascience";
  return undefined;
}

/** Normalize a company string for cross-check comparison. Drops
 *  Pvt Ltd / Inc / Technologies suffixes, lowercases, strips punctuation. */
function normalizeCompanyName(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|corporation|corp|technologies|technology|tech|labs|solutions|systems|india)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Curated list of well-known Indian + global tech employers (~70).
 *  Used by `internship_company_unrecognized` to decide whether a
 *  claimed-internship company is plausible without resume cross-check.
 *  Conservative — only the most-recognised names; small legitimate
 *  startups will fall through and not be flagged at high severity. */
const KNOWN_TECH_EMPLOYER = /\b(?:tcs|tata\s+consultancy|infosys|wipro|cognizant|hcl|tech\s+mahindra|capgemini|accenture|deloitte|pwc|ey|kpmg|ibm|oracle|sap|google|microsoft|amazon|apple|meta|facebook|adobe|linkedin|salesforce|nvidia|intel|qualcomm|atlassian|stripe|netflix|uber|doordash|databricks|snowflake|mongodb|flipkart|razorpay|phonepe|paytm|swiggy|zomato|cred|zerodha|myntra|freshworks|browserstack|postman|nykaa|meesho|ola|byju'?s|unacademy|jio|airtel|ltimindtree|persistent|mindtree|hexaware|coforge|mphasis|amdocs|globallogic|virtusa|samsung|sony|cisco|dell|hp(?:\s+inc)?|lenovo|qualcomm|broadcom|amd|paypal|netapp|servicenow|workday|vmware|cloudera|hortonworks|nutanix|palo\s+alto|fortinet|crowdstrike|okta|twilio|zoom|slack|github|gitlab|atlassian|reliance|isro|drdo|barc|nse|bse|crisil|nielsen|gartner|mckinsey|bcg|bain|fractal|tredence|mu\s*sigma|brillio|happiest\s+minds|persistent\s+systems|zoho|kpit|cyient|sonata|niit|hcl\s+technologies|infosys\s+bpm|wipro\s+digital|tcs\s+ignite)\b/i;

/** Extract candidate company names from transcript text — looks for
 *  "interned at X" / "internship at X" / "at X as <role>". Conservative
 *  — only returns short proper-noun-looking strings. */
function extractClaimedCompanies(userText: string): string[] {
  const out: string[] = [];
  const re = /\b(?:interned|internship|worked|intern)\s+(?:at|with|for)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(userText)) !== null) {
    const name = m[1].replace(/[.,;:]+$/, "").trim();
    if (name && name.length <= 60) out.push(name);
  }
  return out;
}

export const campusPlacementAnalyzer: FocusAnalyzer = {
  focus: "campus-placement",
  version: "campus-placement-v6.10",
  async analyze({ session, resume }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) { result.flags.push("empty_transcript"); return result; }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const fullText = `${aiText} ${userText}`;
    const userTurnCount = transcript.filter(isUser).filter((t) => (t.text || "").length > 50).length;

    // No academic project / coursework / CGPA discussed at all
    if (userTurnCount >= 3 && !ACADEMIC_PROJECT.test(fullText)) {
      flags.add("no_academic_project_discussed");
      gaps.push({
        dimension: "fresher_relevance",
        expected: "Campus interviews should surface capstone / final-year project / coursework",
        observed: "No academic project, CGPA, or coursework came up",
        severity: "medium",
      });
    }

    // Generic passion language without ANY substantiation. We require
    // BOTH the verb-based SPECIFIC_PROJECT pattern AND the noun-based
    // SUBSTANTIATION_TOKEN list (github / hackathon / internship / named
    // MOOC / quantified outcome) to be absent before flagging — mirrors
    // the GENERIC_WHY / SPECIFIC_WHY pair pattern in hr-round.ts. Cuts
    // the false-positive rate on candidates who say "I'm passionate
    // about ML, you can see my Kaggle profile at …".
    if (
      GENERIC_PASSION.test(userText) &&
      !SPECIFIC_PROJECT.test(userText) &&
      !SUBSTANTIATION_TOKEN.test(userText)
    ) {
      flags.add("generic_passion_no_substance");
      gaps.push({
        dimension: "specificity",
        expected: "Replace 'passionate about tech' with a specific project + outcome (or a GitHub link, hackathon, internship, named course, or a quantified milestone like '200+ LeetCode')",
        observed: "User used generic passion language without describing a built artifact or any substantiation (no GitHub / hackathon / internship / MOOC / quantified outcome)",
        severity: "medium",
      });
    }

    // Identifies as fresher AND never mentioned availability
    if (FRESHER_LEXICON.test(userText) && !AVAILABILITY.test(`${aiText} ${userText}`) && userTurnCount >= 3) {
      flags.add("availability_never_discussed");
    }

    // Badmouthing college
    if (COLLEGE_BADMOUTH.test(userText)) {
      flags.add("user_badmouthing_college");
      gaps.push({
        dimension: "professionalism",
        expected: "Frame challenges constructively even when discussing weak coursework",
        observed: "User badmouthed college / professors — costs interview points",
        severity: "high",
      });
    }

    // Project narrated but no concrete tech stack named
    if (PROJECT_NARRATION.test(userText) && !TECH_STACK.test(userText)) {
      flags.add("project_no_tech_stack");
      gaps.push({
        dimension: "specificity",
        expected: "Name the actual stack — language, framework, DB, deployment target",
        observed: "User narrated a project without naming any concrete technology",
        severity: "medium",
      });
    }

    /* Phase-2 (2.1) — Tech-stack DEPTH check (symmetric to project_no_tech_stack).
     * Catches the inverse failure mode: the candidate name-drops ≥2 distinct
     * technologies but never anchors them in an artifact (endpoint count,
     * deployed URL, line count, schema shape, applied verb pairing). The
     * recruiter read of this is "lists Python, Flask, React, MongoDB, AWS,
     * Docker on the resume but couldn't tell me what they actually did with
     * any of them." We require ≥2 distinct tech names so a single bare
     * "I used Python" doesn't trip it. */
    const techNameHits = userText.match(TECH_STACK_G) || [];
    const distinctTech = new Set(techNameHits.map((s) => s.toLowerCase()));
    if (
      distinctTech.size >= 2 &&
      PROJECT_NARRATION.test(userText) &&
      !TECH_APPLIED.test(userText) &&
      userTurnCount >= 3
    ) {
      flags.add("tech_named_but_not_applied");
      gaps.push({
        dimension: "specificity",
        expected: "Pair each tech with what you did with it: 'Flask backend serving 4 REST endpoints, Postgres with 3 tables (users / sessions / events), deployed on Render at xyz.onrender.com.' Names alone read as resume keywords.",
        observed: `User named ${distinctTech.size} technologies but never anchored them in an artifact (no endpoint count, deployed URL, line-count, or applied verb pairing) — reads as keyword-stuffed`,
        severity: "medium",
      });
    }

    /* Phase-2 (2.2) — Portfolio link present as a POSITIVE signal.
     * Surfaces alongside the existing negative `portfolio_absent_for_claim`.
     * Lets the report render a green check ('✓ shared GitHub / live demo')
     * and gives downstream consumers (LLM evaluator, dashboard chip) a
     * single flag to read without re-running PORTFOLIO_LINK. */
    if (PORTFOLIO_LINK.test(userText) && (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText))) {
      flags.add("portfolio_link_present");
    }

    /* Phase-2 (2.3) — Recency multiplier proxy. We don't raise/lower the
     * numeric score here (the LLM evaluator owns scoring); we surface a
     * flag the evaluator + report read as "project depth was real, but it
     * was 2nd-semester, not final-year — discount accordingly." Only fires
     * when distant markers are PRESENT and no recent marker counterbalances. */
    if (
      PROJECT_NARRATION.test(userText) &&
      PROJECT_DISTANT_MARKER.test(userText) &&
      !PROJECT_RECENT_MARKER.test(userText)
    ) {
      flags.add("projects_dated_not_recent");
      gaps.push({
        dimension: "credibility",
        expected: "Anchor at least one project to your CURRENT semester or final-year. A 2nd-semester project carries far less weight than what you're building this term — interviewers calibrate against recency.",
        observed: "User narrated a project but only cited distant time markers (1st / 2nd year, freshman year) with no current-term or final-year anchor",
        severity: "low",
      });
    }

    // Implausible team-size brag (fresher claiming to have led a 20-person team)
    const teamMatch = userText.match(IMPLAUSIBLE_TEAM);
    if (teamMatch && Number(teamMatch[1]) >= 20) {
      flags.add("implausible_team_size");
      gaps.push({
        dimension: "credibility",
        expected: "Calibrate leadership claims to the college context (3-6 person teams typical)",
        observed: `User claimed to have led a team of ${teamMatch[1]} — implausible for college projects`,
        severity: "medium",
      });
    }

    // "Why this company" probed but only generic filler in response.
    // Phase-6 realism calibration: service-tier (TCS NQT / Wipro NLTH /
    // Cognizant GenC) recruiters EXPECT stability/training/scale
    // narrative — flagging it as generic was a product-co rubric leak.
    // We compute archetype inline here (cheap, pure) and apply an
    // archetype-aware gate: service-tier candidates get credit for
    // either SPECIFIC_SIGNAL (program names) OR SERVICE_TIER_NARRATIVE
    // (stability/training/scale); product-tier candidates still need
    // SPECIFIC_SIGNAL.
    const aiAskedWhyCompany = transcript.some((t) => isAi(t) && WHY_COMPANY_PROBE.test(t.text || ""));
    if (aiAskedWhyCompany && COMPANY_GENERIC_FILLER.test(userText) && !COMPANY_SPECIFIC_SIGNAL.test(userText)) {
      const whyArchetype = classifyCampusArchetype(session.target_company, `${aiText} ${userText}`);
      const serviceTier = whyArchetype === "tcs-ninja" || whyArchetype === "wipro-nlth" || whyArchetype === "cognizant-genc";
      // v6.7 — Cognizant GenC / Capgemini Exceller specifically reward
      // a client-rotation / domain-breadth narrative. Either the
      // generic service-tier narrative OR the Cognizant-specific one
      // counts as a context-appropriate answer for that archetype.
      const serviceTierNarrativePresent = serviceTier && (
        COMPANY_SERVICE_TIER_NARRATIVE.test(userText) ||
        (whyArchetype === "cognizant-genc" && COGNIZANT_CLIENT_ROTATION_NARRATIVE.test(userText))
      );

      if (serviceTierNarrativePresent) {
        // Positive signal — candidate gave a context-appropriate
        // service-tier answer (training program / stability / scale).
        // No `no_company_specific_research` flag for this archetype.
        flags.add("service_tier_why_company_acceptable");
      } else {
        flags.add("no_company_specific_research");
        gaps.push({
          dimension: "preparation",
          expected: serviceTier
            ? "For service-tier (TCS / Infosys / Wipro), anchor on what they actually reward — structured training program, proven client base, long-term stable growth, breadth of domain exposure. 'Great culture / great brand' alone is too thin."
            : "Reference a specific program (TCS NQT, Infosys InfyTQ, Amazon LP), recent launch, or values from the careers page",
          observed: "AI probed 'why this company' — user replied with generic 'great culture / brand' filler",
          severity: "high",
        });
      }
    }

    // Volunteered backlogs / low CGPA without being asked
    const aiAskedAboutDeficit = transcript.some((t) => isAi(t) && DEFICIT_PROBE.test(t.text || ""));
    if (VOLUNTEERED_DEFICIT.test(userText) && !aiAskedAboutDeficit) {
      flags.add("volunteered_academic_deficit");
      gaps.push({
        dimension: "framing",
        expected: "Don't volunteer backlogs / KTs / low CGPA. If asked, explain context briefly + what you learned",
        observed: "User volunteered an academic deficit unprompted — costs interview points before any probe",
        severity: "medium",
      });
    }

    // Excessive filler word usage
    const userWordCount = userText.split(/\s+/).filter(Boolean).length;
    const fillerMatches = userText.match(FILLER) || [];
    if (userWordCount >= 100) {
      const fillerPer100 = (fillerMatches.length / userWordCount) * 100;
      if (fillerPer100 >= FILLER_PER_100_WORDS_THRESHOLD) {
        flags.add("excessive_filler_words");
        gaps.push({
          dimension: "communication clarity",
          expected: "≤3 fillers per 100 words. Pause instead of saying 'basically' / 'as such' / 'like'",
          observed: `User used filler ${fillerMatches.length} times across ${userWordCount} words (${fillerPer100.toFixed(1)} per 100)`,
          severity: "low",
        });
      }
    }

    // Mother-Tongue-Influence (MTI) deviations — count distinct pattern hits
    const mtiHits = MTI_PATTERNS.filter((rx) => rx.test(userText)).length;
    if (mtiHits >= 1) {
      flags.add("mti_pattern_detected");
      gaps.push({
        dimension: "communication clarity",
        expected: "Swap MTI phrases for standard professional phrasing — 'please do this' instead of 'kindly do the needful', 'I'm Rahul' instead of 'myself Rahul', 'I have a question' instead of 'I have a doubt'. ('Passed out' is fine — Indian recruiters accept it.)",
        observed: `User used ${mtiHits} Mother-Tongue-Influence phrase${mtiHits === 1 ? "" : "s"} — recruiters in tier-1 firms grade against these`,
        severity: mtiHits >= 3 ? "medium" : "low",
      });
    }

    // Low CGPA stated without framing context — tier-aware threshold.
    // Tier-1 global firms (Google/MS/Amazon India) typically gate at 7.5;
    // most others gate at 7.0; service-tier (TCS/Infosys/Wipro) at 6.5.
    const companyTier = classifyCompanyTier(session.target_company);
    const collegeTier = classifyCollegeTier(userText);
    /* Phase-3 — Persona archetype.
     *
     * companyTier is coarse (TCS == service). The archetype layer is
     * finer: TCS NQT Ninja (CGPA 6.0, basic coding) is a different
     * interview from TCS Digital (CGPA 7.5, deep DSA, 3x comp) even
     * though both classify as "service". The archetype overrides the
     * tier-derived CGPA cutoff when known and surfaces a label the
     * report can render ("TCS NQT (Ninja) / Infosys SE"). */
    const archetype = classifyCampusArchetype(session.target_company, `${aiText} ${userText}`);
    const archetypeCutoff = archetypeCgpaCutoff(archetype);
    const baseCgpaCutoff = archetypeCutoff !== null
      ? archetypeCutoff
      : (companyTier === "product-global" ? 7.5
        : companyTier === "service" ? 6.5
        : 7.0);
    // Tier-1 colleges (IIT/NIT/BITS/IIIT/IISc) get -0.5 leniency due to
    // harder grading curves. Tier-2 + unknown apply the baseline.
    const cgpaCutoff = baseCgpaCutoff + cgpaCutoffAdjustment(collegeTier);
    const cgpaMatch = userText.match(CGPA_STATED);
    /* Stash CGPA calibration on `result.meta` so the candidate sees the
     * exact cutoff they were graded against in the report — surfaces
     * the otherwise-invisible tier-adjustment math (TCS NQT base 6.0 →
     * tier-2 adjusted 5.5, etc.) instead of leaving them to guess. */
    const statedCgpaForMeta = cgpaMatch ? Number(cgpaMatch[1]) : NaN;
    // v6.6 — hoist bond probe count so it can be surfaced on meta
    // alongside archetype + cgpa info. The downstream bond block
    // (line ~770) re-uses the same value for its multi-probe gate.
    const bondProbeCount = transcript.filter((t) => isAi(t) && BOND_PROBE.test(t.text || "")).length;
    // v6.6 — aptitude probe expected type, derived from archetype, so
    // the LLM evaluator (and any downstream prompt-quality check) can
    // grade whether the generated probe actually matched what the
    // recruiter at this archetype would have asked. tcs-ninja /
    // tcs-digital expect cognitive-coding (SQL / strings / hashmap);
    // wipro-nlth expects classical puzzles (8 balls, 3 switches);
    // top-tier-campus skips the aptitude probe entirely. Anything
    // else: "either" (signal absent).
    const aptitudeProbeExpectedType: "cognitive-coding" | "classical-puzzle" | "none" | "either" =
      archetype === "tcs-ninja" || archetype === "tcs-digital" ? "cognitive-coding"
      : archetype === "wipro-nlth" ? "classical-puzzle"
      : archetype === "top-tier-campus" ? "none"
      : "either";
    result.meta = {
      ...(result.meta || {}),
      campusPlacement: {
        companyTier,
        collegeTier,
        baseCgpaCutoff,
        adjustedCgpaCutoff: cgpaCutoff,
        statedCgpa: Number.isFinite(statedCgpaForMeta) && statedCgpaForMeta > 0 ? statedCgpaForMeta : null,
        targetCompany: session.target_company || null,
        archetype,
        archetypeLabel: archetypeLabel(archetype),
        bondProbeCount,
        aptitudeProbeExpectedType,
      },
    };
    // v6.6 — college/TPO internal CGPA cutoff disclosure is valid
    // framing: it surfaces a structural constraint (e.g. "my college
    // won't send below 6.5" / "TPO cutoff is 7.0") that the recruiter
    // respects rather than penalises. Emit positive flag and treat
    // as framing context for `cgpa_low_no_framing` below.
    const collegeCgpaPolicyCited = COLLEGE_CGPA_POLICY.test(userText);
    if (collegeCgpaPolicyCited) {
      flags.add("college_cgpa_policy_acknowledged");
    }
    if (cgpaMatch) {
      const cgpa = Number(cgpaMatch[1]);
      if (cgpa > 0 && cgpa < cgpaCutoff && !CGPA_FRAMING_CONTEXT.test(userText) && !collegeCgpaPolicyCited) {
        flags.add("cgpa_low_no_framing");
        const tierNote = collegeTier === "tier-1"
          ? ` (already adjusted for ${collegeTier} grading curve)`
          : "";
        gaps.push({
          dimension: "framing",
          expected: `CGPA below ${cgpaCutoff.toFixed(1)} for this company tier${tierNote} needs a one-sentence honest reason + evidence of capability (project, internship, ranking improvement, hackathon)`,
          observed: `User stated CGPA ${cgpa.toFixed(1)} with no framing — below the typical threshold for ${companyTier === "product-global" ? "tier-1 global product firms" : companyTier === "service" ? "Indian IT services" : "this company tier"}${tierNote}`,
          severity: "high",
        });
      }
    }

    // College-tier signal as a standalone signal — used by the report to
    // calibrate the rest of the rubric (project depth, project specificity).
    // We surface a flag so downstream consumers (LLM evaluator, dashboard
    // chips) can read it without re-running the classifier.
    if (collegeTier === "tier-1") {
      flags.add("college_tier_1");
    } else if (collegeTier === "tier-2") {
      flags.add("college_tier_2");
    }

    // Phase-3 — surface the campus archetype as a flag so dashboard
    // chips + the LLM evaluator can branch on it without re-running
    // the classifier. `unknown` is intentionally NOT emitted (no
    // signal to render).
    if (archetype !== "unknown") {
      flags.add(`campus_archetype_${archetype.replace(/-/g, "_")}`);
    }

    // Reverse-questions: AI closed with "any questions for us?" — grade what came back.
    // We inspect the LAST user turn AFTER the latest reverse-question probe by the AI.
    let reverseProbeIdx = -1;
    transcript.forEach((t, idx) => { if (isAi(t) && REVERSE_QUESTION_PROBE.test(t.text || "")) reverseProbeIdx = idx; });
    // v6.6 — scan ALL user turns BEFORE the closing reverse-question slot
    // for any SPECIFIC question (tech stack, mentor, growth track, etc.).
    // Smart candidates often ask substantive questions mid-interview and
    // then say "no" / "all clear" at the formal closing — that's not
    // weak preparation, it's exhausted curiosity. Emit positive flag and
    // suppress `weak_reverse_questions` at any archetype when present.
    const beforeProbeUserText = reverseProbeIdx >= 0
      ? transcript.slice(0, reverseProbeIdx).filter(isUser).map((t) => t.text || "").join(" ")
      : "";
    const midSessionSpecificAsked =
      beforeProbeUserText.length > 0 &&
      REVERSE_QUESTION_SPECIFIC.test(beforeProbeUserText) &&
      /\?/.test(beforeProbeUserText);
    if (midSessionSpecificAsked) {
      flags.add("mid_session_questions_present");
    }
    // v6.7 — Short-screening session gate. Sub-10-turn transcripts are
    // typically HR screening / first-round skim, not full panels. Don't
    // ding the candidate for a missing closing slot or a single bond
    // probe in that format. Emit a positive informational flag so the
    // report can render the calibration explicitly.
    const isShortScreeningSession = transcript.length < 10;
    if (isShortScreeningSession) {
      flags.add("short_screening_session_acknowledged");
    }
    // v6.7 — Location-agnostic signal at tcs-digital. The Digital track
    // doesn't probe relocation explicitly; candidates who proactively
    // state any-location openness deserve credit.
    const locationAgnosticPresent = LOCATION_AGNOSTIC_SIGNAL.test(userText);
    if (locationAgnosticPresent) {
      flags.add("location_agnostic_signal");
    }
    if (reverseProbeIdx >= 0) {
      const afterProbe = transcript.slice(reverseProbeIdx + 1).filter(isUser).map((t) => t.text || "").join(" ");
      if (afterProbe) {
        if (REVERSE_QUESTION_DECLINED.test(afterProbe)) {
          if (!isShortScreeningSession) {
            flags.add("reverse_questions_declined");
            gaps.push({
              dimension: "preparation",
              expected: "Always have 2-3 prepared reverse-questions — about training program, tech stack, mentor structure, growth track, or something from the PPT",
              observed: "User declined the reverse-question slot ('No, I'm good') — reads as unprepared / disinterested",
              severity: "medium",
            });
          }
        } else if (REVERSE_QUESTION_GENERIC.test(afterProbe) && !REVERSE_QUESTION_SPECIFIC.test(afterProbe)) {
          // Phase-6 realism calibration: at TCS NQT / Wipro NLTH /
          // Cognizant loops, "what's the work culture?" is a perfectly
          // acceptable filler question — recruiters there expect safe,
          // table-stakes questions from freshers, not Razorpay-grade
          // product probes. We only fire `weak_reverse_questions` for
          // tcs-digital and top-tier-campus where the bar IS specific.
          // v6.6 — mid-session specific questions also suppress the
          // closing-slot weak flag (across archetypes). Smart candidates
          // ask substantive questions mid-interview and then close with
          // "all clear" — that pattern should not be docked.
          // v6.7 — Service-tier leniency extended to `cognizant-genc`
          // and `unknown` archetypes (we can't pin archetype; default
          // to leniency rather than docking a generic reverse question).
          // tcs-digital: location-agnostic statement is also a positive
          // signal that suppresses the closing-slot weak flag (the
          // candidate volunteered relocation context the Digital loop
          // would normally probe for).
          const reverseService = archetype === "tcs-ninja" || archetype === "wipro-nlth" || archetype === "cognizant-genc" || archetype === "unknown";
          const tcsDigitalLocationCovered = archetype === "tcs-digital" && locationAgnosticPresent;
          if (!reverseService && !midSessionSpecificAsked && !tcsDigitalLocationCovered) {
            flags.add("weak_reverse_questions");
            gaps.push({
              dimension: "preparation",
              expected: "Specific reverse-questions score: 'What's the typical TCS-Ignite cohort exit destination after the 2-year bond?' beats 'How is the work culture?'",
              observed: "User's reverse-questions were generic ('work culture' / 'growth opportunities') — weak tie-breaker signal",
              severity: "low",
            });
          }
        }
      } else {
        if (!isShortScreeningSession) {
          flags.add("reverse_questions_declined");
          gaps.push({
            dimension: "preparation",
            expected: "Always have 2-3 prepared reverse-questions — silence on the closer is a credibility hit",
            observed: "AI asked 'any questions for us?' — user gave no response",
            severity: "medium",
          });
        }
      }
    }

    // Bond / service-agreement probing — service-tier only.
    // v6.6 — `bond_unprepared` now requires ≥2 AI probes. Real loops
    // probe bond twice (once early as a screening, once again at
    // closure); a single probe with an "I don't know" reply is often
    // just the candidate caught off-guard, not unresearched. Refusal
    // remains a single-strike DQ — refusing outright doesn't get more
    // benign with more probes. `bondProbeCount` was hoisted earlier so
    // it could land on meta alongside archetype info.
    const aiBondProbed = bondProbeCount > 0;
    if (aiBondProbed) {
      const userBondText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
      if (BOND_REFUSAL.test(userBondText)) {
        flags.add("bond_refusal");
        gaps.push({
          dimension: "preparation",
          expected: "Refusing the bond outright is an instant DQ at TCS/Infosys/Wipro. If genuinely concerned, frame as 'I'd like to understand the buyout terms' — never 'I won't sign'",
          observed: "User refused the service agreement outright — at service-tier firms this ends the interview",
          severity: "high",
        });
      } else if (bondProbeCount >= 2 && BOND_IGNORANCE.test(userBondText) && !BOND_HEALTHY_RESPONSE.test(userBondText) && !isShortScreeningSession) {
        // v6.7 — Short-screening sessions are excluded; a sub-10-turn
        // HR skim doesn't always reach a second bond probe meaningfully.
        flags.add("bond_unprepared");
        gaps.push({
          dimension: "preparation",
          expected: "Know the bond duration for your target company before the interview: TCS 2yr, Infosys 1yr, Wipro 15mo + ₹2L, Cognizant 1yr, HCL 1.5yr",
          observed: "User showed unfamiliarity with service-bond concept when asked — reads as unresearched",
          severity: "medium",
        });
      }
    }

    // Internship claimed but no detail given (resume padding signal)
    if (INTERNSHIP_CLAIM.test(userText) && !INTERNSHIP_DETAIL.test(userText) && userTurnCount >= 3) {
      flags.add("internship_unsubstantiated");
      gaps.push({
        dimension: "credibility",
        expected: "An internship mention should come with company, duration, deliverable, mentor, and a concrete output",
        observed: "User mentioned an internship but never named the company, deliverable, or impact",
        severity: "medium",
      });
    }

    // v6.6 — internship company plausibility (transcript-only). Fires
    // only when no resume is loaded (resume-aware path uses the stricter
    // `claimed_internship_not_in_resume` instead) AND the candidate
    // named ≥1 internship company AND none of the named companies match
    // any of the ~70 well-known Indian/global tech employers in the
    // `KNOWN_TECH_EMPLOYER` whitelist. Conservative — small legitimate
    // startups will fall through; we treat this as informational, not
    // disqualifying, until resume-cross-check can verify.
    if (!resume && INTERNSHIP_CLAIM.test(userText)) {
      const claimed = extractClaimedCompanies(userText);
      if (claimed.length > 0) {
        const anyKnown = claimed.some((c) => KNOWN_TECH_EMPLOYER.test(c));
        if (!anyKnown) {
          flags.add("internship_company_unrecognized");
          gaps.push({
            dimension: "credibility",
            expected: "When naming an internship company, prefer the full, recognised brand (e.g. 'Razorpay Software Pvt Ltd' / 'Infosys BPM'). Recruiters cross-check against BGV — unrecognised names invite a verification drill the candidate may not be able to defend.",
            observed: `Candidate named internship company/companies (${claimed.slice(0, 3).join(", ")}) that don't match any of the well-known Indian / global tech employers — informational, not yet verified against resume.`,
            severity: "low",
          });
        }
      }
    }

    /* ── Wave 3 detection: real-life campus edge cases ─────────────── */

    // Attrition risk — fresher signaling exit for higher studies within 1-2 yrs.
    // Exception: if candidate explicitly commits to honoring the bond/service period first,
    // that signals retention, not attrition.
    const honorsBond = /\b(?:after\s+(?:completing|finishing|fulfilling|honoring)\s+(?:my\s+)?(?:bond|service|2[- ]?year\s+commitment|two[- ]?year\s+commitment)|once\s+(?:my\s+)?bond\s+(?:is\s+)?(?:done|complete|over)|post[- ]?bond|after\s+the\s+bond)\b/i.test(userText);
    if (ATTRITION_HIGHER_STUDIES.test(userText) && !honorsBond) {
      flags.add("attrition_risk_higher_studies");
      gaps.push({
        dimension: "framing",
        expected: "Service-tier firms (TCS/Infosys/Wipro) won't hire candidates planning MBA/MS within the bond. If higher studies is a real plan, frame as 'I'd like to build a strong foundation here first' — not 'I'm joining for 2 years and then doing MBA'",
        observed: "User explicitly stated higher-studies plan (MBA/MS/GRE/CAT) within 1-2 years — strong attrition signal at service-tier",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Relocation refusal — flat refusal to leave home city.
    const aiAskedRelocation = transcript.some((t) => isAi(t) && RELOCATION_PROBE.test(t.text || ""));
    if (RELOCATION_REFUSAL.test(userText)) {
      flags.add("relocation_refusal");
      gaps.push({
        dimension: "preparation",
        expected: "Refusing relocation outright is a dealbreaker at TCS/Infosys/Wipro/Cognizant (pan-India allocation). If you have a genuine constraint, soften: 'I have a strong preference for the South — could you walk me through how allocation works?'",
        observed: aiAskedRelocation
          ? "AI probed location flexibility — user refused outright. Pan-India service firms can't accommodate this."
          : "User volunteered relocation refusal unprompted — reads as unflexible / unaware",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Night-shift / on-call refusal.
    const aiAskedShift = transcript.some((t) => isAi(t) && SHIFT_PROBE.test(t.text || ""));
    if (SHIFT_REFUSAL.test(userText)) {
      flags.add("shift_oncall_refusal");
      gaps.push({
        dimension: "preparation",
        expected: "Most service-tier and global-product firms have rotational/US-shift roles. Flat refusal closes doors. If you have a constraint (health/family), frame as 'I'd want to understand the rotation cadence' — not a flat no",
        observed: aiAskedShift
          ? "AI asked about shift flexibility — user refused outright"
          : "User volunteered shift refusal unprompted",
        severity: "medium",
      });
    }

    // Cliché strength/weakness — "perfectionist" / "work too hard".
    // Gate on the interviewer actually asking the probe so we don't fire
    // on a candidate volunteering the cliché in an unrelated story (rare,
    // but a real false-positive class without the gate).
    const aiAskedStrengthWeakness = transcript.some((t) => isAi(t) && STRENGTH_WEAKNESS_PROBE.test(t.text || ""));
    if (aiAskedStrengthWeakness && CLICHE_STRENGTH_WEAKNESS.test(userText)) {
      flags.add("cliche_strength_weakness");
      gaps.push({
        dimension: "specificity",
        expected: "Interviewers hear 'perfectionist' / 'work too hard' 5+ times a day. Pick a real, calibrated weakness with a concrete example of how you're working on it",
        observed: "User used a cliché strength/weakness ('perfectionist', 'work too hard', 'workaholic')",
        severity: "low",
      });
    }

    // "Tell me about yourself" → resume recital cue.
    const aiAskedTmay = transcript.some((t) => isAi(t) && TMAY_PROBE.test(t.text || ""));
    if (aiAskedTmay && RESUME_RECITAL.test(userText)) {
      flags.add("tmay_resume_recital");
      gaps.push({
        dimension: "communication clarity",
        expected: "'Tell me about yourself' is a structure question, not a resume recital. Use the 60-second frame: who-I-am → strongest project → why-this-role. The interviewer already has your resume.",
        observed: "User said 'as per my resume' / 'as you can see in my resume' — signals they're reading off the page",
        severity: "medium",
      });
    }

    // Career-goal probe answered with vague / non-specific language.
    const aiAskedCareerGoal = transcript.some((t) => isAi(t) && CAREER_GOAL_PROBE.test(t.text || ""));
    if (aiAskedCareerGoal && CAREER_GOAL_VAGUE.test(userText) && !CAREER_GOAL_SPECIFIC.test(userText)) {
      flags.add("career_goal_vague");
      gaps.push({
        dimension: "preparation",
        expected: "Pick a specific role/skill 3-5 years out: 'SDE-2 with deep ownership of a backend service' / 'tech lead in distributed systems' / 'product specialist in fintech'. Vague answers ('successful', 'in a senior position') signal no plan",
        observed: "AI asked about 5-year goal — user gave vague answer ('successful' / 'in a senior position' / 'wherever life takes me')",
        severity: "medium",
      });
    }

    // Hackathon claim without detail.
    if (HACKATHON_CLAIM.test(userText) && !HACKATHON_DETAIL.test(userText) && userTurnCount >= 3) {
      flags.add("hackathon_unsubstantiated");
      gaps.push({
        dimension: "credibility",
        expected: "A hackathon mention should come with: theme, team size, duration, what shipped, and rank/outcome. 'I participated in SIH' alone is resume padding.",
        observed: "User mentioned a hackathon / coding contest but gave no rank, prize, team size, or what was built",
        severity: "low",
      });
    }

    // Buzzword soup — listing many trendy areas without an anchor project.
    const buzzwordHits = (userText.match(BUZZWORD) || []);
    const uniqueBuzzwords = new Set(buzzwordHits.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()));
    if (uniqueBuzzwords.size >= 5 && !TECH_STACK.test(userText)) {
      flags.add("buzzword_soup");
      gaps.push({
        dimension: "specificity",
        expected: "Listing 5+ trendy areas ('AI, ML, blockchain, IoT, cloud, web3') without a single concrete project reads as a buzzword resume. Pick ONE area you've actually built in",
        observed: `User listed ${uniqueBuzzwords.size} trendy areas (AI/ML/blockchain/IoT/etc.) with no concrete tech stack to back any of them`,
        severity: "medium",
      });
    }

    // Family-pressure framing — unprofessional in interview context.
    if (FAMILY_PRESSURE.test(userText)) {
      flags.add("family_pressure_framing");
      gaps.push({
        dimension: "professionalism",
        expected: "Never frame career choice as parent-driven ('my parents wanted me to do engineering'). Own the choice: 'I picked CS because I enjoyed the problem-solving in 12th-grade physics'",
        observed: "User attributed career choice to parents/family pressure — signals lack of ownership",
        severity: "medium",
      });
    }

    // Negative compare to another company.
    if (NEGATIVE_COMPARE.test(userText)) {
      flags.add("negative_company_compare");
      gaps.push({
        dimension: "professionalism",
        expected: "Never disparage other companies in an interview, even competitors. If asked 'why us over X?', name what excites you about THIS company — don't trash the other",
        observed: "User compared the target company unfavourably to another firm (or vice versa) — reads as immature",
        severity: "medium",
      });
    }

    // Inflated salary expectation for a campus fresher.
    const aiAskedSalary = transcript.some((t) => isAi(t) && SALARY_EXPECTATION_PROBE.test(t.text || ""));
    // Service-tier campus fresher band ≈ ₹3.5-4.5L; product-india ≈ ₹6-15L;
    // product-global ≈ ₹15-30L. Any single-digit fresher quoting >2x is inflated.
    const salaryInflatedCutoff = companyTier === "product-global" ? 35
      : companyTier === "product-india" ? 20
      : companyTier === "service" ? 8
      : 12;
    if (aiAskedSalary) {
      const salaryMatch = userText.match(SALARY_NUMBER_LPA);
      if (salaryMatch) {
        const lpa = Number(salaryMatch[1]);
        if (lpa >= salaryInflatedCutoff) {
          flags.add("salary_expectation_inflated");
          gaps.push({
            dimension: "preparation",
            expected: `Campus fresher band for this tier sits well below ${salaryInflatedCutoff} LPA. Either anchor to glassdoor/levels.fyi data, or defer politely: 'I'm flexible and trust the standard fresher band — I'd like to learn more about the role'`,
            observed: `User quoted ${lpa} LPA — well above typical fresher campus offer for ${companyTier === "service" ? "service-tier" : companyTier === "product-india" ? "Indian product" : companyTier === "product-global" ? "global product India" : "this"} firms`,
            severity: "medium",
          });
        }
      }
    }

    // User raised salary in the first 4 user turns, before AI did.
    const aiTurnsRaisingSalary = transcript
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => isAi(t) && (SALARY_EXPECTATION_PROBE.test(t.text || "") || USER_SALARY_RAISED.test(t.text || "")));
    const firstAiSalaryIdx = aiTurnsRaisingSalary.length > 0 ? aiTurnsRaisingSalary[0].idx : Number.POSITIVE_INFINITY;
    const userTurnsWithIdx = transcript
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => isUser(t));
    for (let i = 0; i < Math.min(userTurnsWithIdx.length, 4); i += 1) {
      const { t, idx } = userTurnsWithIdx[i];
      if (idx < firstAiSalaryIdx && USER_SALARY_RAISED.test(t.text || "")) {
        flags.add("salary_raised_too_early");
        gaps.push({
          dimension: "preparation",
          expected: "Don't bring up salary in the technical / first round. Wait for HR / final round, or until the interviewer raises it. Asking 'what's the CTC' in turn 2 of a tech round signals wrong priorities",
          observed: "User asked about salary/CTC in the first 4 turns, before the AI raised compensation — wrong round for this question",
          severity: "medium",
        });
        break;
      }
    }

    // v6.7 — Shipped-to-prod context as a positive signal. Distinct from
    // PORTFOLIO_LINK (which is a URL): this captures "we shipped it and
    // users used it" — production deploys, active users, merged PRs.
    // At product-grade archetypes (top-tier-campus / tcs-digital) this
    // is a higher-credibility substitute for a GitHub link.
    const shippedToProdPresent = SHIPPED_TO_PROD_CONTEXT.test(userText) && (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText));
    if (shippedToProdPresent) {
      flags.add("shipped_to_prod_context");
    }

    // Portfolio absence — claimed to build something but no public artifact link.
    // v6.7 — At product-grade archetypes (top-tier-campus / tcs-digital),
    // a `shipped_to_prod_context` signal counts as credibility substitute
    // for the missing portfolio link (the candidate's evidence is "real
    // users ship", not "here's a repo URL").
    const productGradeArchetype = archetype === "top-tier-campus" || archetype === "tcs-digital";
    if (
      CLAIMED_BUILT.test(userText) &&
      !PORTFOLIO_LINK.test(userText) &&
      userTurnCount >= 3 &&
      (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText)) &&
      !(productGradeArchetype && shippedToProdPresent)
    ) {
      flags.add("portfolio_absent_for_claim");
      gaps.push({
        dimension: "credibility",
        expected: "When narrating a project, drop a github/live-demo/portfolio link in the same turn. 'Source is on my GitHub at /username/repo' or 'live demo at xyz.vercel.app' adds 10x credibility over a verbal claim",
        observed: "User claimed to have built / shipped a project but never referenced GitHub, a live demo, a hosted URL, or any public artifact",
        severity: "low",
      });
    }

    /* ── Wave-4 detection: deeper Indian campus realism ───────────────── */

    // Active backlog evasion (service-tier dealbreaker). Phase-5
    // adds the symmetric POSITIVE signal `backlog_honest_disclosure`
    // when the candidate gives a clean, unhedged answer on the same
    // probe — recruiters explicitly reward this in service-tier loops.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAi(t) || !BACKLOG_PROBE.test(t.text || "")) continue;
      const reply = transcript.slice(i + 1, i + 3).find(isUser);
      if (!reply || !reply.text) continue;

      // Single decision tree — evasive and clean are mutually exclusive
      // by construction. If both match (e.g. "no backlogs but maybe one
      // pending"), evasive wins (recruiter ear hears the hedge first).
      const evasive = BACKLOG_EVASIVE.test(reply.text);
      const clean = BACKLOG_CLEAN.test(reply.text);
      if (evasive) {
        flags.add("active_backlog_evasion");
        gaps.push({
          dimension: "preparation",
          expected: "Service-tier firms have a no-active-backlog rule. State your exact standing crisply: 'Zero active backlogs, cleared one supplementary in 2nd year, all subjects passed.'",
          observed: "Candidate hedged on the backlog probe — recruiters flag this as either active arrears or evasion. Both are dealbreakers at TCS/Infosys/Wipro/Cognizant.",
          severity: "high",
        });
      } else if (clean) {
        // Phase-5 positive signal — candidate answered the backlog
        // probe with a crisp, unhedged clean disclosure. Surfaces
        // as a green chip on the report and a positive note for the
        // LLM evaluator to lift the score.
        flags.add("backlog_honest_disclosure");
      }
      break;
    }

    // Branch-jump narrative — non-CS branch + SDE role + no learning story.
    if (NONCS_BRANCH.test(userText) && /\b(?:sde|software\s+(?:dev|engineer)|backend|frontend|full[- ]?stack|developer|swe\b|programmer)\b/i.test(`${userText} ${aiText}`) && !BRANCH_LEARNING_NARRATIVE.test(userText) && userTurnCount >= 3) {
      flags.add("branch_jump_thin_narrative");
      gaps.push({
        dimension: "credibility",
        expected: "Non-CS branch applying to SDE? Lead with the bridge: a course (CS50 / Striver SDE Sheet / NPTEL), N self-built projects, and what clicked. 'I'm Mech but did CS50, built 4 projects, switched because systems thinking translates.'",
        observed: "Candidate mentioned a non-CS branch + SDE-track role but never explained the learning bridge (self-study course, projects, certifications) — reads as opportunistic.",
        severity: "medium",
      });
    }

    // PPT recall absent — substantial transcript with no PPT/launch reference.
    if (userTurnCount >= 4 && !PPT_REFERENCE.test(userText) && (companyTier === "service" || companyTier === "product-india" || companyTier === "product-global")) {
      flags.add("ppt_recall_absent");
      gaps.push({
        dimension: "preparation",
        expected: "Reference something from the pre-placement talk (a speaker name, a recent launch, the program name like 'Infosys Springboard' or 'Wipro Turbo'). Shows you listened.",
        observed: "Substantial interview turns but candidate never referenced the PPT, the speaker, or a recent company-specific launch — signals low pre-interview engagement.",
        severity: "low",
      });
    }

    // Coding-round score undefended.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CODING_SCORE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && reply.text.length < 280 && !CODING_SCORE_RATIONALE.test(reply.text)) {
          flags.add("coding_round_score_undefended");
          gaps.push({
            dimension: "credibility",
            expected: "Own the gap with one honest sentence + one recent-evidence sentence: 'Time pressure on the last problem; since then I've solved 200+ on Leetcode, currently Knight on Codeforces.' Defends without excusing.",
            observed: "AI probed a low coding round score; candidate had no rationale or recent-evidence answer.",
            severity: "medium",
          });
          break;
        }
      }
    }

    // Parallel exam prep — attrition signal at service-tier.
    if (PARALLEL_EXAM_PREP.test(userText)) {
      flags.add("parallel_exam_prep_disclosed");
      gaps.push({
        dimension: "framing",
        expected: "Don't volunteer GATE / CAT / UPSC parallel prep in a service-tier interview. If asked directly, frame as: 'I'd like to first build a strong foundation here; long-term plans are flexible.'",
        observed: "Candidate disclosed parallel exam prep (GATE/CAT/UPSC/GRE) — recruiters at service-tier discount this as 1-2 year attrition risk.",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Tier-3 overcompensation — unknown college + grandiose claim.
    if (collegeTier === "unknown" && GRANDIOSE_CLAIM.test(userText)) {
      flags.add("tier_3_overcompensation");
      gaps.push({
        dimension: "credibility",
        expected: "Calibrate claims to evidence. 'Top 5 in my college hackathon (40 teams)' beats 'national hackathon winner' if the former is what actually happened. Interviewers verify with one specific drill-down.",
        observed: "Candidate made a grandiose national/global achievement claim that doesn't match the rest of the context — invites a verification probe the candidate is unlikely to defend.",
        severity: "medium",
      });
    }

    // FYP solo claim vs team mention — contradiction.
    if (FYP_SOLO_CLAIM.test(userText) && FYP_TEAM_MENTION.test(userText)) {
      flags.add("fyp_solo_claim_vs_team");
      gaps.push({
        dimension: "credibility",
        expected: "Be precise on contribution: 'In our 4-person FYP team I owned the backend (FastAPI + Postgres); teammates handled the React frontend and the ML model.' Mixing 'I built' with 'we presented' invites a 'who did what exactly' drill.",
        observed: "Candidate said 'I built' the FYP but elsewhere referenced a team — Indian campus interviewers will probe individual contribution.",
        severity: "medium",
      });
    }

    // Stipend dodge — AI probes intern stipend, user hedges.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && STIPEND_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && STIPEND_DODGE.test(reply.text) && !STIPEND_CONCRETE.test(reply.text)) {
          flags.add("stipend_dodge");
          gaps.push({
            dimension: "credibility",
            expected: "Stipend is a routine probe — state the number cleanly. '₹25,000 / month at the startup, unpaid academic internship at the lab (mentored by Prof. X)'. Hedging here signals fabrication.",
            observed: "Candidate hedged on a stipend question — recruiters use this as a fabrication tell; even unpaid internships should be stated openly with context.",
            severity: "medium",
          });
          break;
        }
      }
    }

    /* ── Wave-5 detection: softer-signal Indian campus realism ──────── */

    // Memorized self-intro — multiple template phrases in the TMAY reply.
    if (TMAY_PROBE.test(aiText)) {
      const tmayIdx = transcript.findIndex((t) => isAi(t) && TMAY_PROBE.test(t.text || ""));
      const r = tmayIdx >= 0 ? transcript.slice(tmayIdx + 1, tmayIdx + 3).find(isUser) : undefined;
      if (r && r.text) {
        const reText = new RegExp(MEMORIZED_TEMPLATE.source, "gi");
        const matches = r.text.match(reText) || [];
        if (matches.length >= 2) {
          flags.add("memorized_self_intro");
          gaps.push({
            dimension: "specificity",
            expected: "Rewrite the self-intro in your own voice with one concrete project + outcome. Verbatim 'first of all I'd like to thank you for this opportunity, coming to my introduction' reads as cassette-tape.",
            observed: "Self-intro reply hit multiple memorized-template phrases (e.g. 'first of all thank you', 'coming to my introduction', 'talking about my family') — Indian recruiters now flag this template as no-thought signal.",
            severity: "medium",
          });
        }
      }
    }

    // Aptitude / on-spot puzzle refusal. Phase-5 also surfaces an
    // APTITUDE-TO-PROJECT CONSISTENCY signal: when the candidate
    // refuses a live puzzle AND elsewhere claimed substantial project
    // depth (TECH_APPLIED evidence or a portfolio link), the two
    // claims are inconsistent — recruiters drill exactly this gap
    // ("you shipped a FastAPI service but can't reason about 8 balls?").
    let aptitudeRefusedAt = -1;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && APTITUDE_LIVE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && APTITUDE_REFUSAL.test(reply.text)) {
          aptitudeRefusedAt = i;
          flags.add("aptitude_puzzle_refusal");
          // v6.7 — tcs-digital is offline-coding-format (the live loop
          // doesn't dwell on classical puzzles); downgrade severity so
          // the report reflects the rubric the Digital track actually
          // grades against. Other archetypes keep the "high" severity.
          // v6.8 — extend the offline-coding-format leniency: tcs-ninja
          // (NQT) is also an online-aptitude-then-live-coding loop where
          // the LIVE round rarely dwells on classical puzzles, so a
          // puzzle refusal in the mock there reads "medium" rather than
          // "high". `unknown` picks up the same medium severity — when
          // we can't pin the archetype we shouldn't slam a fresher at
          // full "high" for refusing a probe whose format we can't
          // verify against the actual loop. `wipro-nlth` and
          // `cognizant-genc` keep "high" — their live loops genuinely
          // do test classical puzzles.
          const aptitudeSeverity: "low" | "medium" | "high" =
            archetype === "tcs-digital" ? "low"
            : archetype === "tcs-ninja" || archetype === "unknown" ? "medium"
            : "high";
          gaps.push({
            dimension: "preparation",
            expected: "Even if stuck, narrate your thinking aloud — 'Let me think out loud: 8 balls, two weighings, so each weighing has to split into 3 buckets...' Interviewers grade approach, not perfection. Flat refusal loses 100% of marks.",
            observed: "Candidate refused or stalled on a live puzzle / DSA / estimation question — reads as inflexible or unprepared.",
            severity: aptitudeSeverity,
          });
          break;
        }
      }
    }
    if (
      aptitudeRefusedAt >= 0 &&
      (TECH_APPLIED.test(userText) || PORTFOLIO_LINK.test(userText))
    ) {
      flags.add("aptitude_project_inconsistency");
      gaps.push({
        dimension: "credibility",
        expected: "If you actually shipped the project you described, a 60-second aptitude question should not be a wall. Anchor the refusal: 'Let me try — I ship in code, so let me reason through it like a debugger.' Refusing while claiming depth invites the recruiter to discount the project.",
        observed: "Candidate refused a live aptitude / puzzle probe but earlier claimed substantial project depth (applied tech stack or portfolio link). The two signals don't fit — recruiters interpret this as either an inflated project claim or an unwillingness to think on the spot.",
        severity: "high",
      });
    }

    // Onsite / foreign opportunity premature — fresher asks within first 3 turns.
    {
      const userTurnIdxs: number[] = [];
      transcript.forEach((t, idx) => { if (isUser(t)) userTurnIdxs.push(idx); });
      const earlyTurns = userTurnIdxs.slice(0, 3);
      if (earlyTurns.some((idx) => ONSITE_QUERY.test(transcript[idx].text || ""))) {
        flags.add("onsite_opportunity_premature");
        gaps.push({
          dimension: "framing",
          expected: "Don't bring up onsite / US deputation in early turns — service-tier recruiters read this as offer-shopping. Hold it for HR / post-offer conversations; phrase as: 'I'd love to understand how growth and global rotations work over the first 2-3 years — but happy to discuss when we get there.'",
          observed: "Candidate asked about onsite / foreign deputation in the first 3 user turns — wrong round for this question.",
          severity: companyTier === "service" ? "high" : "medium",
        });
      }
    }

    // Nepotism reference — relative working at the company.
    if (NEPOTISM_MENTION.test(userText)) {
      flags.add("nepotism_reference");
      gaps.push({
        dimension: "professionalism",
        expected: "Never mention a relative / family-friend at the company unsolicited — even as small-talk. It activates explicit anti-nepotism filters at most Indian firms and is forbidden outright at PSU / consulting / Big-4. If discovered through BGV that's fine; volunteering it isn't.",
        observed: "Candidate volunteered that a relative / family-friend works at the company — recruiters log this as a nepotism signal.",
        severity: "medium",
      });
    }

    // In-hand vs CTC confusion.
    if (INHAND_CTC_CONFUSION.test(userText)) {
      flags.add("inhand_vs_ctc_confusion");
      gaps.push({
        dimension: "preparation",
        expected: "Know the Indian fresher CTC structure before the interview: CTC = fixed + variable + joining bonus + RSU/ESOP + benefits + (sometimes) retentions. In-hand is roughly 70-78% of fixed after taxes, EPF, and professional tax. Asking 'isn't CTC the same as in-hand' tells recruiters you didn't prepare.",
        observed: "Candidate showed explicit CTC vs in-hand confusion — reads as financial-literacy gap and unprofessional in an offer-conversation.",
        severity: "low",
      });
    }

    // Code-on-paper / whiteboard freeze.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CODE_WRITE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && CODE_WRITE_REFUSAL.test(reply.text)) {
          flags.add("code_on_paper_freeze");
          gaps.push({
            dimension: "preparation",
            expected: "Practice writing 20-line solutions on paper / chat / whiteboard during prep. 'I can only code in an IDE' tells the interviewer you've memorized templates without internalizing logic.",
            observed: "Candidate refused to write code without an IDE — interviewers grade this as superficial DSA prep.",
            severity: "high",
          });
          break;
        }
      }
    }

    // Resume date inconsistency — overlapping month-year ranges.
    {
      const monthMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const ranges: Array<{ start: number; end: number }> = [];
      const reAll = new RegExp(MONTH_YEAR_RANGE.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = reAll.exec(userText)) !== null) {
        const sMonth = monthMap[m[1].slice(0, 3).toLowerCase()];
        const sYear = Number(m[2]);
        const eMonth = monthMap[m[3].slice(0, 3).toLowerCase()];
        const eYear = Number(m[4]);
        if (sMonth && eMonth) {
          ranges.push({ start: sYear * 12 + sMonth, end: eYear * 12 + eMonth });
        }
      }
      let overlap = false;
      for (let i = 0; i < ranges.length && !overlap; i++) {
        for (let j = i + 1; j < ranges.length && !overlap; j++) {
          const a = ranges[i], b = ranges[j];
          if (a.start <= b.end && b.start <= a.end && !(a.start === b.start && a.end === b.end)) overlap = true;
        }
      }
      if (overlap) {
        flags.add("resume_date_inconsistency");
        gaps.push({
          dimension: "credibility",
          expected: "Internship / project dates must not overlap (unless explicitly part-time + disclosed). Two overlapping full-time windows trip BGV instantly and read as resume fabrication.",
          observed: "Two month-year ranges in the candidate's narration overlap — interviewers will probe and BGV will surface this.",
          severity: "high",
        });
      }
    }

    // Degree / branch inconsistency — two different branch names in user text.
    {
      const seen = new Set<string>();
      const reBranch = new RegExp(BRANCH_NAME.source, "gi");
      let bm: RegExpExecArray | null;
      while ((bm = reBranch.exec(userText)) !== null) {
        const key = bm[0].toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
        // Canonicalize close-matches so cse / computerscience / computerscienceandengineering all map together.
        let canon = key;
        if (/^c(omputer)?s(cience)?(?:andengineering)?$/.test(key) || key === "cse") canon = "cse";
        else if (/^i(nformation)?t(echnology)?$/.test(key) || key === "it") canon = "it";
        else if (/^i(nformation)?s(cience)?$/.test(key) || key === "is") canon = "is";
        else if (/^e(lectronics)?c(ommunication)?e?$/.test(key) || key === "ece") canon = "ece";
        else if (/^e(lectrical)?e(lectronics)?e?$/.test(key) || key === "eee") canon = "eee";
        else if (/^mech(anical)?(engineering)?$/.test(key)) canon = "mech";
        else if (/^civil(engineering)?$/.test(key)) canon = "civil";
        else if (/^chem(ical|engg)?(engineering)?$/.test(key)) canon = "chem";
        else if (/^biotech(nology)?$/.test(key)) canon = "biotech";
        else if (/^aiml$|^a(rtificial)?i(ntelligence)?m(achine)?l(earning)?$/.test(key)) canon = "aiml";
        else if (/^aids$|^a(rtificial)?i(ntelligence)?d(ata)?s(cience)?$/.test(key)) canon = "aids";
        else if (/^datascience(engineering|branch)?$/.test(key)) canon = "datascience";
        seen.add(canon);
      }
      if (seen.size >= 2 && !DUAL_DEGREE_CONNECTOR.test(userText)) {
        flags.add("degree_branch_inconsistency");
        gaps.push({
          dimension: "credibility",
          expected: "Be precise about your branch — pick the exact name on your transcript and stick with it. If you have a minor or dual-degree, say so explicitly: 'CSE major with an AIML minor'. Drifting between 'I'm in CSE' and 'I'm in AIML' reads as either confusion or fabrication.",
          observed: `Candidate referenced multiple branches across the transcript (${Array.from(seen).join(", ")}) without a minor / dual-degree explanation.`,
          severity: "medium",
        });
      }
    }

    /* ── Wave-6 detection: resume cross-checks ────────────────────────
     * These only run when the cron successfully loaded the resume by
     * resume_version_id. Otherwise we silently skip — analyzer must
     * still produce useful output on transcript-only data. */
    if (resume) {
      // 1) Internship company cross-check.
      // Candidate says "I interned at Razorpay" but Razorpay isn't on
      // their resume → high-signal credibility issue. Soft match
      // (normalized substring either direction) to tolerate "Razorpay"
      // vs "Razorpay Software Pvt Ltd". Only fire when the resume
      // actually has at least one experience entry — otherwise we
      // can't distinguish "fabricated" from "resume missing data".
      if (Array.isArray(resume.experiences) && resume.experiences.length > 0) {
        const resumeCompanies = resume.experiences
          .map((e) => normalizeCompanyName(e?.company))
          .filter((s) => s.length >= 3);
        const claimed = extractClaimedCompanies(userText);
        const unverified: string[] = [];
        for (const c of claimed) {
          const norm = normalizeCompanyName(c);
          if (!norm) continue;
          const present = resumeCompanies.some((r) => r === norm || r.includes(norm) || norm.includes(r));
          if (!present) unverified.push(c);
        }
        if (unverified.length > 0) {
          flags.add("claimed_internship_not_in_resume");
          gaps.push({
            dimension: "credibility",
            expected: "Every company / internship mentioned in the interview must already appear on the resume. BGV will pull the resume as source-of-truth — narrating a role that isn't listed reads as fabrication and is the #1 disqualifier in Indian campus drives.",
            observed: `Candidate referenced ${unverified.length === 1 ? "a company" : "companies"} not present in their uploaded resume: ${unverified.slice(0, 3).join(", ")}.`,
            severity: "high",
            flag: "claimed_internship_not_in_resume",
          });
        }
      }

      // 2) Branch mismatch with resume's degree.
      // If the resume's education entry canonicalizes to e.g. "mech"
      // but the candidate consistently says "I'm in CSE", that's a
      // bigger tell than the transcript-only branch-drift check —
      // the resume is the authoritative source.
      const resumeBranch = canonicalizeBranch(resume.degree);
      if (resumeBranch) {
        // Reuse the BRANCH_NAME regex collected earlier in the Wave-5
        // block by scanning userText. Canonicalize each hit with the
        // shared helper so the comparison is apples-to-apples.
        const spokenBranches = new Set<string>();
        const reB = new RegExp(BRANCH_NAME.source, "gi");
        let bm2: RegExpExecArray | null;
        while ((bm2 = reB.exec(userText)) !== null) {
          const canon = canonicalizeBranch(bm2[0]);
          if (canon) spokenBranches.add(canon);
        }
        // Only fire if the spoken set is non-empty and excludes the
        // resume branch entirely — i.e. the candidate is speaking a
        // branch they don't have on paper. Mentioning the resume
        // branch alongside others is handled by degree_branch_inconsistency.
        if (spokenBranches.size > 0 && !spokenBranches.has(resumeBranch) && !DUAL_DEGREE_CONNECTOR.test(userText)) {
          flags.add("branch_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `Match the branch you spoke about (${Array.from(spokenBranches).join(", ")}) with what's on your resume (${resumeBranch}). The resume is the BGV-checked source of truth — a verbal branch change without "dual-degree" / "minor in" framing reads as fabrication.`,
            observed: `Resume lists ${resumeBranch} but candidate identified as ${Array.from(spokenBranches).join(", ")} in the transcript.`,
            severity: "high",
            flag: "branch_mismatch_with_resume",
          });
        }
      }

      // 3) Grad-year mismatch with resume.
      // Resume.gradYear is the BGV-checked source of truth. If the
      // candidate states a different year in the transcript ("I'll
      // graduate in 2025" but resume says 2024), that's a credibility
      // hit. We tolerate ±1 (legitimate spillover semester) before
      // flagging.
      if (resume.gradYear && /^20\d{2}$/.test(resume.gradYear)) {
        const resumeYear = parseInt(resume.gradYear, 10);
        const spokenYears = new Set<number>();
        const yearRe = /\b(?:graduat(?:e|ing|ed|ion)|passing|passout|pass[- ]out|batch|class of)\b[^.?!]{0,40}\b(20\d{2})\b|\b(20\d{2})\s*(?:batch|passout|pass[- ]out|grad)/gi;
        let ym: RegExpExecArray | null;
        while ((ym = yearRe.exec(userText)) !== null) {
          const y = parseInt(ym[1] || ym[2], 10);
          if (y >= 2015 && y <= 2030) spokenYears.add(y);
        }
        const driftedYears = Array.from(spokenYears).filter((y) => Math.abs(y - resumeYear) > 1);
        if (driftedYears.length > 0) {
          flags.add("grad_year_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `The graduation year you stated (${driftedYears.join(", ")}) should match what's on your resume (${resumeYear}). BGV pulls the resume — a verbal year drift > 1 year reads as fabrication and disqualifies in service-tier rounds.`,
            observed: `Resume lists graduation year ${resumeYear}, but candidate mentioned ${driftedYears.join(", ")} in the transcript.`,
            severity: "high",
            flag: "grad_year_mismatch_with_resume",
          });
        }
      }

      // 4) College mismatch with resume.
      // Resume.school is the source of truth. Tolerate aliases (IIT
      // Bombay vs IITB, VIT vs VIT Vellore) by canonicalising both
      // sides via classifyCollegeTier — if both sides land on the
      // same tier-1/tier-2 bucket OR the normalized substring matches
      // either way, we treat as same college. Otherwise flag.
      if (resume.school && resume.school.length >= 3) {
        const resumeSchoolNorm = resume.school.toLowerCase().replace(/[^a-z0-9]/g, "");
        const resumeTier = classifyCollegeTier(resume.school);
        // Detect college mentions in transcript. Two patterns:
        //   (a) Tier-1/2 acronym + city — "IIT Bombay", "NIT Surathkal",
        //       "BITS Pilani", "IIIT Hyderabad". Acronym at start of span.
        //   (b) After a preposition ("from", "at", "studied at"…) a longer
        //       name ending in University / College / Institute.
        const mentions: string[] = [];
        const acronymRe = /\b(IIT|NIT|IIIT|BITS|IISc|IIM)\b[\s-]*([A-Za-z][A-Za-z .'-]{2,40})/g;
        let am: RegExpExecArray | null;
        while ((am = acronymRe.exec(userText)) !== null) {
          mentions.push(`${am[1]} ${am[2]}`.trim());
        }
        const collegeMentionRe = /\b(?:from|at|studied at|graduated from|i'?m at|i'?m in|i'?m from)\s+([A-Za-z][A-Za-z& .'-]{4,60}(?:university|college|institute)[A-Za-z &.,'-]{0,40})/gi;
        let cm: RegExpExecArray | null;
        while ((cm = collegeMentionRe.exec(userText)) !== null) {
          const m = cm[1].trim();
          if (m.length >= 4) mentions.push(m);
        }
        const mismatched: string[] = [];
        for (const m of mentions) {
          const mNorm = m.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!mNorm) continue;
          // Same college if normalized strings overlap either way.
          if (resumeSchoolNorm.includes(mNorm) || mNorm.includes(resumeSchoolNorm)) continue;
          // Same college if both canonicalise to the same tier-1/tier-2 bucket
          // AND the bucket isn't "unknown" (otherwise every state college
          // collides). Tier overlap on tier-1/-2 only.
          const mTier = classifyCollegeTier(m);
          if (mTier !== "unknown" && mTier === resumeTier && mTier === classifyCollegeTier(`${resume.school} ${m}`)) continue;
          mismatched.push(m);
        }
        if (mismatched.length > 0) {
          flags.add("college_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `The college you named (${mismatched.slice(0, 2).join(", ")}) should match what's on your resume (${resume.school}). Indian campus BGV pulls the transcript / certificate — a verbal swap reads as fabrication.`,
            observed: `Resume lists ${resume.school}, but candidate mentioned ${mismatched.slice(0, 2).join(", ")} in the transcript.`,
            severity: "high",
            flag: "college_mismatch_with_resume",
          });
        }
      }

      // 5) CGPA mismatch with resume.
      // Resume.cgpa is BGV-checked (transcript / provisional). If the
      // candidate verbally claims a CGPA > 0.5 points off (or > 5% for
      // percentage scales), flag — recruiters do verify against the
      // transcript. Tolerate small drift (rounding, latest-semester SGPA
      // movement). Skip entirely if resume CGPA is unparseable.
      if (resume.cgpa) {
        const resumeCgpa = parseFloat(resume.cgpa);
        if (!Number.isNaN(resumeCgpa) && resumeCgpa > 0) {
          const isPercentScale = resumeCgpa > 10;
          const tolerance = isPercentScale ? 5 : 0.5;
          // Patterns: "my CGPA is 8.2", "I have 7.4 CGPA", "8.7 out of 10",
          // "scored 84%". Plausibility-filter to the resume's own scale.
          const cgpaRe = /\b(?:cgpa|gpa|sgpa)\s*(?:is|of|:|stands at|currently)?\s*(\d{1,2}(?:\.\d{1,2})?)\b|\b(\d{1,2}\.\d{1,2})\s*(?:cgpa|gpa|sgpa|\/\s*10|out of (?:ten|10))\b|\b(?:scored|got|secured|with)\s+(\d{2,3})\s*(?:%|percent)\b/gi;
          const spoken: number[] = [];
          let cm2: RegExpExecArray | null;
          while ((cm2 = cgpaRe.exec(userText)) !== null) {
            const v = parseFloat(cm2[1] || cm2[2] || cm2[3]);
            if (Number.isNaN(v)) continue;
            if (isPercentScale && v >= 30 && v <= 100) spoken.push(v);
            else if (!isPercentScale && v >= 4 && v <= 10) spoken.push(v);
          }
          const drifted = spoken.filter((v) => Math.abs(v - resumeCgpa) > tolerance);
          if (drifted.length > 0) {
            flags.add("cgpa_mismatch_with_resume");
            gaps.push({
              dimension: "credibility",
              expected: `The CGPA you stated (${drifted.map((d) => d.toFixed(2)).join(", ")}) should match what's on your resume (${resumeCgpa}). Recruiters verify CGPA against the transcript / provisional — even a 1-point drift will trip BGV.`,
              observed: `Resume lists CGPA ${resumeCgpa}, but candidate mentioned ${drifted.map((d) => d.toFixed(2)).join(", ")} in the transcript.`,
              severity: "high",
              flag: "cgpa_mismatch_with_resume",
            });
          }
        }
      }

      // 5.5) Internship duration mismatch with resume.
      // Resume's experience.period is the BGV-checked window. If the
      // candidate verbally says "I was there for six months" near a
      // company name but the resume shows a 3-month range, flag —
      // recruiters routinely cross-check duration against the offer
      // letter / relieving letter. We require BOTH an absolute drift
      // > 2 months AND a relative drift > 30% to suppress noise from
      // partial-month rounding ("about 4 months" vs an exact 3.5).
      if (Array.isArray(resume.experiences) && resume.experiences.length > 0) {
        // parsePeriodMonths, NUM_WORDS and the spoken-duration regex now
        // live in `_resume-period.ts` — shared with hr-round.
        const durRe = SPOKEN_DURATION_REGEX;
        const driftedCompanies: string[] = [];
        for (const exp of resume.experiences) {
          const resumeMonths = parsePeriodMonths(exp?.period);
          const companyNorm = normalizeCompanyName(exp?.company);
          if (!resumeMonths || !companyNorm || companyNorm.length < 3) continue;
          const userLower = userText.toLowerCase();
          // Find every occurrence of the company in userText, then check
          // ±150 chars for a duration phrase.
          let searchFrom = 0;
          let foundDriftForThisCompany = false;
          while (!foundDriftForThisCompany) {
            const idx = userLower.indexOf(companyNorm.split(/\s+/)[0], searchFrom);
            if (idx === -1) break;
            searchFrom = idx + 1;
            const window = userText.slice(Math.max(0, idx - 150), Math.min(userText.length, idx + 150));
            durRe.lastIndex = 0;
            let dm: RegExpExecArray | null;
            while ((dm = durRe.exec(window)) !== null) {
              const raw = dm[1].toLowerCase();
              const n = NUM_WORDS[raw] ?? parseInt(raw, 10);
              if (Number.isNaN(n) || n <= 0) continue;
              const unit = dm[2].toLowerCase();
              const spokenMonths = unit.startsWith("year") ? n * 12 : n;
              const absDrift = Math.abs(spokenMonths - resumeMonths);
              const relDrift = absDrift / resumeMonths;
              if (absDrift > 2 && relDrift > 0.3) {
                driftedCompanies.push(`${(exp?.company || "").trim()} (resume: ${resumeMonths}mo, spoken: ${spokenMonths}mo)`);
                foundDriftForThisCompany = true;
                break;
              }
            }
          }
        }
        if (driftedCompanies.length > 0) {
          flags.add("internship_duration_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: "The internship duration you state verbally must match the period on your resume — recruiters cross-check against the offer / relieving letter during BGV. Even rounding 3 months up to 'six months' to sound stronger is a documented disqualifier in service-tier rounds.",
            observed: `Duration drift detected for: ${driftedCompanies.slice(0, 2).join("; ")}.`,
            flag: "internship_duration_mismatch_with_resume",
            severity: "high",
          });
        }
      }

      // 6) Portfolio satisfied by resume.
      // The transcript-only `portfolio_absent_for_claim` rule fires
      // when the user narrates a project without dropping a GitHub
      // link in their answer. If their resume lists a GitHub /
      // portfolio / live-demo URL we suppress that flag — recruiter
      // can already see it.
      if (flags.has("portfolio_absent_for_claim") && Array.isArray(resume.links) && resume.links.filter((u): u is string => typeof u === "string" && u.length > 0).some((u) => /github|gitlab|bitbucket|vercel|netlify|herokuapp|render\.com|huggingface|kaggle/i.test(u))) {
        flags.delete("portfolio_absent_for_claim");
        // Also drop the corresponding rubric gap, if any.
        for (let i = gaps.length - 1; i >= 0; i--) {
          if (gaps[i].dimension === "credibility" && /portfolio|github|live demo/i.test(gaps[i].expected)) {
            gaps.splice(i, 1);
          }
        }
      }
    }

    const tips: string[] = [];
    flags.forEach((flag) => {
      const tip = CAMPUS_FLAG_TIPS[flag];
      if (tip) tips.push(tip);
    });

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
