/* HR-round interview analyzer — deterministic v2.
 *
 * Indian HR round = a 7-dimension final gate:
 *   1. Logistics       — notice / LWD / buyout / location / shift
 *   2. Comp discovery  — current CTC structure + expected hike, payslip validation
 *   3. Stability       — reason for leaving, gaps, tenure pattern, no bad-mouth
 *   4. Compliance      — BGV consent + documents (PAN/Aadhaar/UAN, relieving
 *                        letters, payslips, Form 16, marksheets)
 *   5. Commitment      — other offers, counter-offer protection, joining lock
 *   6. Benefits/policy — joining bonus clawback, probation, bond, ESOP vest
 *   7. Fit & motivation— specific "why us", values, manager fit, 3-5 yr plan
 *
 * Each detection maps to a rubric dimension surfaced in the report.
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  FocusAnalyzer,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";
import { rescoreFlags, type FlagRescoreCandidate } from "./_llm-rescore";
import {
  SALARY_NUMBER, ASKED_ABOUT_SALARY, HIKE_PROMPT, PAYSLIP_PROMPT, PAYSLIP_REFUSED,
  BADMOUTHING, GAP_PROMPT, GAP_EXPLAINED, NOTICE_PERIOD, NOTICE_ASKED, NOTICE_VAGUE, NOTICE_CONCRETE,
  BGV_PROMPT, BGV_EVASIVE, COUNTER_OFFER_PROMPT, COUNTER_OFFER_DODGE, OFFER_ACCEPTED_GRACEFUL,
  WHY_COMPANY_PROMPT, GENERIC_WHY, SPECIFIC_WHY, SELF_INTRO_PROMPT, SPECIFICS, BENEFITS_PROMPT,
  NOTICE_DEPTH, BGV_DOC_NAMED, COMP_PROBE_RE, COUNTER_OFFER_VOLUNTEERED, COUNTER_OFFER_DECLINE,
  COUNTER_OFFER_COMMITTED,
  PROBATION_PROMPT, PROBATION_PROBE, HIKE_RATIONALE, BOND_PROMPT, BOND_PROBE_RE,
  PEDIGREE_PROMPT, PEDIGREE_EVASION, BREAKUP_ASKED, BREAKUP_DETAIL, BREAKUP_GENUINELY_UNKNOWN,
  DEFERENTIAL_OPENER, COMP_RAISED_BY_USER, REFERENCE_PROMPT, REFERENCE_REFUSAL,
  REFERENCE_CURRENT_DEFERRED, OFFER_DELAY_ANXIETY, PRIOR_BGV_FAIL_PROMPT, PRIOR_BGV_FAIL_ADMIT,
  PRIOR_BGV_CONTEXT, NONCOMPETE_MENTION, NONCOMPETE_QUANTIFIED, GENAI_PROMPT, GENAI_DENIAL,
  GENAI_HONEST, LOYALTY_PROMPT, LOYALTY_FLAT_YES, LOYALTY_CALIBRATED, ASPIRATION_PROBE,
  ASPIRATION_WALKBACK, BAND_MISMATCH_PROMPT, FLOOR_COLLAPSE, REVERSE_INVITED, REVERSE_FLUFF,
  REVERSE_SUBSTANTIVE, BGV_RESOLVED, REFERENCE_RESOLVED, JOB_HOPPING_PROMPT,
  SHORT_STINT_VOLUNTEERED, STINT_NARRATIVE, MOONLIGHT_PROMPT, MOONLIGHT_FLAT_DENIAL,
  MOONLIGHT_HONEST, PF_UAN_PROMPT, PF_UAN_EVASIVE, FAMILY_PROBE, FAMILY_FREEZE,
  JOIN_FAST_PROMISE, NOTICE_LONG, CLAWBACK_PROMPT, CLAWBACK_BLIND_YES, CLAWBACK_INFORMED,
  RTO_PROMPT, RTO_FLAT_REFUSAL, RTO_NEGOTIATED, DOWNGRADE_PROMPT, DOWNGRADE_DEFENSIVE,
  CERT_PROBE, CERT_VAGUE, CTC_FIRST_USER, OTHER_OFFERS_PROMPT, OTHER_OFFERS_VAGUE,
  OTHER_OFFERS_SPECIFIC, HR_BASE_KEYWORD, HR_CITY_WITH_ROLE, RELO_PROBED, REASON_LEAVING_PROMPT,
  BLAME_FRAMING, FORWARD_FRAME, REFERENCE_AFFIRMED_VAGUE, REFERENCE_NAMED, ESOP_HR_MENTION,
  ESOP_LITERACY, BELL_CURVE_PROBED, BUYOUT_MENTIONED, BUYOUT_SPLIT_PROBED, FULLY_REMOTE_DEMAND,
  HYBRID_NEGOTIATION, VISA_DEMAND, REVIEW_CYCLE_PROBE, TAX_STRUCTURE_PROBE, PEDIGREE_PRE_APOLOGY,
  TRANSCRIPT_EMPLOYER_RE, SENIOR_TITLE_RE, CAREER_BREAK_PROMPT,
  EMPLOYER_STOP_TOKENS, EMPLOYER_GENERIC_TOKENS,
  tokensOverlap, summarizeResume,
  DIMENSIONS, DIMENSION_PATTERNS, RESCORE_RUBRICS, CLUSTERS,
} from "./_hr-patterns";

function isAi(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("a"); }
function isUser(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("u"); }
function replyTo(transcript: TranscriptTurn[], idx: number): TranscriptTurn | undefined {
  return transcript.slice(idx + 1, idx + 3).find(isUser);
}

export const hrRoundAnalyzer: FocusAnalyzer = {
  focus: "hr-round",
  version: "hr-round-v5.7.0",

  async analyze({ session, resume }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];
    /* Evidence collected for weak-regex flags that get a 2nd-pass
       semantic-coherence LLM rescore at the end of analyze(). Map key
       is the flag name; value is the AI prompt + user reply the regex
       fired on. When LLM_RESCORE_ENABLED=0 the map is built but never
       consumed — cheap. */
    const rescoreEvidence = new Map<string, { aiPrompt: string; userReply: string }>();
    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const allText = `${aiText} ${userText}`;

    let anchorLeaked = false;
    let aiAskedAt = Infinity;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && ASKED_ABOUT_SALARY.test(t.text || "") && i < aiAskedAt) aiAskedAt = i;
      if (isUser(t) && SALARY_NUMBER.test(t.text || "") && i < aiAskedAt) anchorLeaked = true;
    }
    if (anchorLeaked) {
      flags.add("user_anchor_leaked_salary");
      gaps.push({ dimension: "negotiation_protection", expected: "User holds salary number until HR explicitly asks", observed: "User volunteered a number before being asked — costs leverage", severity: "high" });
    }

    if (BADMOUTHING.test(userText)) {
      flags.add("user_badmouthing_employer");
      gaps.push({ dimension: "professionalism", expected: "Frame past challenges constructively, never personally", observed: "Negative language about previous employer detected", severity: "high" });
    }

    if (transcript.length > 6 && !NOTICE_PERIOD.test(allText)) flags.add("notice_period_never_discussed");

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && NOTICE_ASKED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 180 && NOTICE_VAGUE.test(r.text) && !NOTICE_CONCRETE.test(r.text)) {
          flags.add("vague_notice_period");
          gaps.push({ dimension: "logistics_clarity", expected: "Crisp notice period (e.g. '60 days, buyout possible') and earliest LWD", observed: "Candidate hedged on notice period — Indian HR treats this as flight risk", severity: "medium" });
          break;
        }
      }
    }

    /* notice_period_shallow. Concrete notice answer
       ("60 days") but no buyout / handover / LWD / early-release
       discussion across the whole session. Mid-senior HR rounds expect
       depth here; the shallow answer leaves comp-of-buyout and handover
       blind spots that surface at offer time. */
    {
      const hrAskedNotice = transcript.some((t) => isAi(t) && NOTICE_ASKED.test(t.text || ""));
      const candidateGaveConcrete = transcript.some(
        (t) => isUser(t) && NOTICE_CONCRETE.test(t.text || "") && (t.text || "").length < 220,
      );
      const depthDiscussed = NOTICE_DEPTH.test(allText);
      if (
        hrAskedNotice &&
        candidateGaveConcrete &&
        !depthDiscussed &&
        !flags.has("vague_notice_period") &&
        transcript.length > 6
      ) {
        flags.add("notice_period_shallow");
        gaps.push({
          dimension: "logistics_clarity",
          expected: "Beyond raw days: buyout policy, handover / KT plan, earliest LWD, and early-release options",
          observed: "Candidate stated notice in days but never discussed buyout, handover, or LWD — shallow for mid-senior HR rounds",
          severity: "medium",
          flag: "notice_period_shallow",
        });
      }
    }

    if (SELF_INTRO_PROMPT.test(aiText)) {
      const idx = transcript.findIndex((t) => isAi(t) && SELF_INTRO_PROMPT.test(t.text || ""));
      const r = replyTo(transcript, idx);
      if (r && r.text && r.text.length >= 60 && !SPECIFICS.test(r.text)) {
        flags.add("generic_self_intro");
        gaps.push({ dimension: "specificity", expected: "Self-intro includes years of experience, concrete projects, results", observed: "Self-intro lacked numbers, project names, or action verbs", severity: "medium", flag: "generic_self_intro" });
        rescoreEvidence.set("generic_self_intro", {
          aiPrompt: transcript[idx]?.text || "",
          userReply: r.text || "",
        });
      }
    }

    /* BGV multi-probe tracker. Old behavior: first evasive reply → flag,
       break. New behavior: walk every probe in the session, tally
       evasions vs eventual resolution. Sustained evasion across ≥2
       probes is high-severity; single-probe evasion that's later
       resolved is downgraded to medium (still worth coaching but not a
       "BGV will block onboarding" panic). */
    {
      let probes = 0;
      let evasions = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && BGV_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        if (BGV_EVASIVE.test(r.text)) evasions += 1;
        if (BGV_RESOLVED.test(r.text)) resolved = true;
      }
      if (evasions > 0 && !resolved) {
        flags.add("bgv_document_evasion");
        const sustained = probes >= 2 && evasions >= 2;
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Comfort sharing payslips, Form 16, relieving letters, PAN/Aadhaar/UAN for BGV",
          observed: sustained
            ? `Candidate hedged across ${evasions} of ${probes} BGV probes without recovering — BGV will block onboarding`
            : "Candidate hedged or refused on document sharing — BGV will block onboarding",
          severity: "high",
          flag: "bgv_document_evasion",
        });
        if (sustained) flags.add("bgv_document_evasion_sustained");
      } else if (evasions > 0 && resolved) {
        // Recovered: downgrade to a softer commitment-confidence flag.
        flags.add("bgv_document_initial_hedge");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Answer BGV-doc probes crisply on the first ask — initial hedges read as flight risk even when followed by yes",
          observed: "Candidate hedged on a BGV probe before recovering on a later probe — recoverable but tighten the first answer",
          severity: "low",
          flag: "bgv_document_initial_hedge",
        });
      }
    }

    /* Payslip refusal tracker — same cumulative pattern as BGV. */
    {
      let probes = 0;
      let refusals = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && PAYSLIP_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        if (PAYSLIP_REFUSED.test(r.text)) refusals += 1;
        if (BGV_RESOLVED.test(r.text)) resolved = true;
      }
      if (refusals > 0 && !resolved) {
        flags.add("payslip_refusal");
        if (!flags.has("bgv_document_evasion")) {
          const sustained = probes >= 2 && refusals >= 2;
          gaps.push({
            dimension: "comp_transparency",
            expected: "Share payslips/Form 16 when asked — refusal signals inflated current CTC",
            observed: sustained
              ? `Candidate refused payslip share across ${refusals} of ${probes} probes — HR will assume current CTC is inflated`
              : "Candidate refused payslip share — HR will assume current CTC is inflated",
            severity: "high",
            flag: "payslip_refusal",
          });
          if (sustained) flags.add("payslip_refusal_sustained");
        }
      }
    }

    /* Counter-offer loop: prefer the graceful-acceptance positive
       signal when both patterns could match, since the graceful phrase
       often contains a "decide" / "see" token that the dodge regex also
       picks up. */
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && COUNTER_OFFER_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        // The 220-char gate used to let a *verbose* dodge slip through
        // untouched (audit repro). Length is not the discriminator — the
        // dodge/graceful/decline regexes are. Keep a sane upper bound to
        // skip essay-length rambles, but flag long waffle that reads as a
        // dodge and carries no firm-commitment signal. The 2nd-pass LLM
        // rescore backstops the raise.
        if (!r || !r.text || r.text.length >= 600) continue;
        if (OFFER_ACCEPTED_GRACEFUL.test(r.text)) {
          flags.add("offer_accepted_graceful");
          break;
        }
        // A hedge phrase that resolves into a firm commitment ("it depends…
        // but I'm firm on this move, a counter won't change it") is NOT a
        // dodge — COUNTER_OFFER_COMMITTED vetoes the false positive alongside
        // the explicit-decline guard.
        if (
          COUNTER_OFFER_DODGE.test(r.text) &&
          !COUNTER_OFFER_DECLINE.test(r.text) &&
          !COUNTER_OFFER_COMMITTED.test(r.text)
        ) {
          flags.add("counter_offer_dodge");
          gaps.push({ dimension: "commitment_signal", expected: "Clear stance on counter-offer / other offers — HR is testing pre-joining drop-out risk", observed: "Candidate dodged the commitment question, reads as flight risk", severity: "medium", flag: "counter_offer_dodge" });
          rescoreEvidence.set("counter_offer_dodge", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && WHY_COMPANY_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length >= 40 && GENERIC_WHY.test(r.text) && !SPECIFIC_WHY.test(r.text)) {
          flags.add("generic_why_company");
          gaps.push({ dimension: "motivation_specificity", expected: "Why-us tied to a specific product, leader, domain, or recent move", observed: "Answer used generic platitudes (great culture/brand/growth) without specifics", severity: "medium", flag: "generic_why_company" });
          rescoreEvidence.set("generic_why_company", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    if (GAP_PROMPT.test(aiText)) {
      const idx = transcript.findIndex((t) => isAi(t) && GAP_PROMPT.test(t.text || ""));
      const r = replyTo(transcript, idx);
      // Short AND lacking any concrete anchor (year / duration / named
      // reason). A crisp factual answer under the length gate is NOT
      // unexplained — GAP_EXPLAINED suppresses that false positive.
      if (r && r.text && r.text.length < 80 && !GAP_EXPLAINED.test(r.text)) {
        flags.add("gap_unexplained");
        gaps.push({ dimension: "switch_rationale_honesty", expected: "Crisp factual explanation of any gap (study, family, layoff, sabbatical) with dates", observed: "Gap question received a thin or evasive answer — Indian HR probes harder here", severity: "medium" });
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && HIKE_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 160 && !HIKE_RATIONALE.test(r.text)) {
          flags.add("hike_rationale_thin");
          gaps.push({ dimension: "comp_transparency", expected: "Hike % anchored on market data, scope expansion, or competing offer", observed: "Hike % asked but candidate gave no rationale — HR reads this as inflated ask", severity: "medium" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && BREAKUP_ASKED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (!(r && r.text && r.text.length < 220 && SALARY_NUMBER.test(r.text) && !BREAKUP_DETAIL.test(r.text))) continue;
        if (BREAKUP_GENUINELY_UNKNOWN.test(r.text)) {
          /* Honest unknown — coach to go find out, but don't penalise
             credibility. */
          flags.add("salary_breakup_unknown_owned");
          gaps.push({
            dimension: "comp_transparency",
            expected: "Know your CTC breakup cold before the next round — fixed / variable / payout-history / joining bonus / RSU vest",
            observed: "Candidate honestly flagged they don't know the variable payout history — better than guessing, but go pull payslips / talk to manager before the next interview",
            severity: "low",
            flag: "salary_breakup_unknown_owned",
          });
        } else {
          flags.add("salary_breakup_vague");
          gaps.push({ dimension: "comp_transparency", expected: "When asked for the CTC structure, state fixed / variable / joining bonus / RSU split explicitly", observed: "Candidate gave a single CTC number with no component breakup — Indian HR reads this as inflated variable", severity: "medium" });
        }
        break;
      }
    }

    /* over_deferential_opener. Indian candidates from services /
       Tier-2 college backgrounds often open with "respected
       sir/ma'am, it's an honour" — sounds polite but reads as
       juniorish at MNC / FAANG / GCC / BFSI-global. Coaching anchor:
       confident-equal register opens, not deferential.

       Only fires for mid+ (where the register matters) on long-form
       sessions (a brisk 4-turn TA screen with a polite opener is
       fine). Won't penalise fresher / entry-level deferential openers. */
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      if (isMidPlus && transcript.length > 8) {
        const firstUserTurns = transcript.filter(isUser).slice(0, 2);
        const opener = firstUserTurns.map((t) => t.text || "").join(" ");
        if (DEFERENTIAL_OPENER.test(opener)) {
          flags.add("over_deferential_opener");
          gaps.push({
            dimension: "register_confidence",
            expected: "Confident-equal register from the first turn — 'thanks for the time, let me walk you through my background' lands better than 'respected ma'am, it's an honour'",
            observed: "Candidate opened with deferential / over-grateful framing — at mid-senior MNC / FAANG / GCC rounds this reads as juniorish or services-coded and depresses comp anchor",
            severity: "low",
            flag: "over_deferential_opener",
          });
        }
      }
    }

    /* current_employer_counter_unresolved.
       Candidate volunteers that their current employer is likely to /
       did counter-offer them, but never gives a firm decline ("I told
       them no" / "won't entertain"). Distinct from counter_offer_dodge
       (which fires when HR probes hypothetically). This one is the
       candidate self-disclosing an active retention attempt — and not
       resolving it. HR reads it as flight risk confirmed. */
    {
      const userTextLower = userText.toLowerCase();
      const candidateRaised = COUNTER_OFFER_VOLUNTEERED.test(userTextLower);
      const candidateDeclined = COUNTER_OFFER_DECLINE.test(userTextLower) || flags.has("offer_accepted_graceful");
      if (candidateRaised && !candidateDeclined) {
        flags.add("current_employer_counter_unresolved");
        gaps.push({
          dimension: "commitment_signal",
          expected: "If the candidate raises a current-employer counter-offer, they MUST close it with a firm decline in the same breath ('they're trying to match — I've told them no')",
          observed: "Candidate volunteered that their current employer is counter-offering but never explicitly declined — HR reads this as active flight risk",
          severity: "high",
          flag: "current_employer_counter_unresolved",
        });
      }
    }

    /* probation_terms_unprobed.
       Probation came up (HR side OR candidate side) but the candidate
       never asked duration / confirmation criteria / pay-during-
       probation. Services-track probation is 3-6 months with
       termination-without-cause clauses; accepting blind is the
       classic post-joining shock pattern. */
    {
      const probationMentioned = PROBATION_PROMPT.test(allText);
      const userProbed = transcript.some((t) => isUser(t) && PROBATION_PROBE.test(t.text || ""));
      if (probationMentioned && !userProbed && transcript.length > 8) {
        flags.add("probation_terms_unprobed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When probation comes up, probe duration (3 / 6 months), confirmation criteria, pay during probation, and notice-during-probation. Services-track probation has termination-without-cause clauses — knowing the terms protects the candidate",
          observed: "Probation was mentioned but candidate never asked duration / confirmation criteria / probation pay — accepting blind invites month-3 termination shock",
          severity: "medium",
          flag: "probation_terms_unprobed",
        });
      }
    }

    /* bgv_literacy_low. HR raised BGV / documents but the
       candidate never named a single doc back (Form 16 / UAN /
       payslip / relieving letter / Aadhaar / PAN / EPFO). Even when
       not actively evading, this reads as unprepared and slows
       onboarding. Distinct from bgv_document_evasion which requires
       active refusal language.

       Suppressed for freshers / entry-level — a fresh graduate has
       never filed taxes (no Form 16), often has no activated UAN, and
       hasn't seen a relieving letter. Penalising them here is unfair. */
    {
      const level = (session.difficulty || "").toLowerCase();
      const isFresher = level === "fresher" || level === "entry";
      const hrAskedBgv = transcript.some((t) => isAi(t) && BGV_PROMPT.test(t.text || ""));
      const userNamedDoc = transcript.some((t) => isUser(t) && BGV_DOC_NAMED.test(t.text || ""));
      if (
        hrAskedBgv &&
        !userNamedDoc &&
        !isFresher &&
        !flags.has("bgv_document_evasion") &&
        !flags.has("bgv_document_evasion_sustained")
      ) {
        flags.add("bgv_literacy_low");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Name BGV docs by name (Form 16, UAN, last 3 payslips, relieving letter, PAN/Aadhaar) — fluency signals 'I've done this before'",
          observed: "BGV came up but candidate never named a single document by name — reads as unprepared even without active evasion",
          severity: "medium",
          flag: "bgv_literacy_low",
        });
      }
    }

    /* comp_breakup_probe_missing. HR mentioned benefits /
       ESOP / clawback / joining bonus but the candidate never PROBED
       the terms back (cliff, vesting schedule, variable payout %,
       clawback duration). Accepting benefits blind is the classic
       post-joining shock pattern; HR rounds reward candidates who
       ask before signing. */
    {
      const hrMentionedBenefits = transcript.some((t) => isAi(t) && BENEFITS_PROMPT.test(t.text || ""));
      const userProbed = transcript.some((t) => isUser(t) && COMP_PROBE_RE.test(t.text || ""));
      if (hrMentionedBenefits && !userProbed && transcript.length > 8) {
        flags.add("comp_breakup_probe_missing");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When ESOP / joining bonus / clawback / variable comes up, probe terms: cliff, vesting schedule, payout %, clawback duration",
          observed: "Benefits / ESOP / clawback was on the table but candidate never asked terms — accepting blind invites post-joining shock",
          severity: "medium",
          flag: "comp_breakup_probe_missing",
        });
      }
    }

    /* bond_terms_unprobed. HR raised service bond / training bond
       but candidate never asked duration / breakage / pro-rate. Indian-
       specific — TCS, Infosys, Wipro, Accenture training bonds are 1-2
       years with ₹50k-2L breakage. Blind acceptance is the #1 services-
       track post-joining shock. */
    {
      const hrMentionedBond = transcript.some((t) => isAi(t) && BOND_PROMPT.test(t.text || ""));
      const userProbedBond = transcript.some((t) => isUser(t) && BOND_PROBE_RE.test(t.text || ""));
      if (hrMentionedBond && !userProbedBond) {
        flags.add("bond_terms_unprobed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When bond / service agreement comes up, probe duration, breakage penalty, pro-rate clause, and notarisation requirement",
          observed: "Service bond was raised but candidate never asked duration / breakage / pro-rate — accepting blind locks in 1-2 years with five- to six-figure exit penalty",
          severity: "high",
          flag: "bond_terms_unprobed",
        });
      }
    }

    /* pedigree_evasion. HR probed college / CGPA / 10th-12th marks
       (illegal-ish but universal in Indian HR) and candidate deflected
       under 5 YOE. Real HR reads "don't remember exactly" as hiding a
       sub-7 CGPA — a screen-out at IT services / consulting hires. */
    {
      const yoe = (session.difficulty || "").toLowerCase();
      const lowYoe = yoe === "fresher" || yoe === "entry" || yoe === "mid";
      if (lowYoe) {
        for (let i = 0; i < transcript.length; i++) {
          const t = transcript[i];
          if (!(isAi(t) && PEDIGREE_PROMPT.test(t.text || ""))) continue;
          const r = replyTo(transcript, i);
          if (r && r.text && PEDIGREE_EVASION.test(r.text)) {
            flags.add("pedigree_evasion");
            gaps.push({
              dimension: "credibility",
              expected: "Under 5 YOE, know your CGPA / 10th / 12th / college cold — Indian HR anchors early-career screening on academics",
              observed: "Candidate deflected on academic credentials — HR reads this as hiding a weak GPA, often a screen-out signal at IT services and consulting",
              severity: "medium",
              flag: "pedigree_evasion",
            });
            break;
          }
        }
      }
    }

    /* Reference-refusal tracker — same cumulative pattern. Recovery
       on a follow-up probe ("oh I do have a couple of references
       actually") downgrades the flag; sustained refusal across ≥2
       probes is high-severity. */
    {
      let probes = 0;
      let refusals = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && REFERENCE_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        /* Current-employer deferral is universal Indian practice, not
           refusal. Treat as resolved so the flag doesn't fire. */
        if (REFERENCE_CURRENT_DEFERRED.test(r.text)) {
          resolved = true;
          continue;
        }
        if (REFERENCE_REFUSAL.test(r.text)) refusals += 1;
        if (REFERENCE_RESOLVED.test(r.text)) resolved = true;
      }
      if (refusals > 0 && !resolved) {
        flags.add("reference_refusal");
        const sustained = probes >= 2 && refusals >= 2;
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Two professional references ready (ex-managers preferred); current manager exception is fine and expected",
          observed: sustained
            ? `Candidate refused references across ${refusals} of ${probes} probes — BGV blocker, recruiter will assume hidden exit`
            : "Candidate refused to provide any references — BGV blocker, recruiter will assume hidden exit",
          severity: "high",
          flag: "reference_refusal",
        });
        if (sustained) flags.add("reference_refusal_sustained");
      } else if (refusals > 0 && resolved) {
        flags.add("reference_initial_hedge");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Have 2 references ready on the first ask — initial hesitation reads as a hidden-exit signal",
          observed: "Candidate hedged on a reference probe before recovering on a later probe — tighten the first answer",
          severity: "low",
          flag: "reference_initial_hedge",
        });
      }
    }

    if (OFFER_DELAY_ANXIETY.test(userText)) {
      flags.add("offer_letter_delay_anxiety");
      gaps.push({ dimension: "commitment_signal", expected: "Ask offer-letter timing crisply once near close — not as mid-interview anxiety", observed: "Candidate surfaced offer-letter / deadline anxiety during substantive turns — reads as nervous flight risk", severity: "low" });
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && PRIOR_BGV_FAIL_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && PRIOR_BGV_FAIL_ADMIT.test(r.text) && !PRIOR_BGV_CONTEXT.test(r.text)) {
          flags.add("prior_bgv_fail_uncontextualised");
          gaps.push({ dimension: "compliance_readiness", expected: "Prior BGV failure owned with date + reason + resolution ('flagged in 2022 for X, cleared after Y')", observed: "Admitted prior BGV failure without context — recruiter will assume worse", severity: "high" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && NONCOMPETE_MENTION.test(t.text || "") && !NONCOMPETE_QUANTIFIED.test(t.text || "")) {
        flags.add("non_compete_unquantified");
        gaps.push({ dimension: "compliance_readiness", expected: "Non-compete / NDA stated with duration + geography + scope ('12 months, India, direct competitors only')", observed: "Mentioned a non-compete restriction without quantifying scope — recruiter timebomb", severity: "medium" });
        break;
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && GENAI_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text) {
          if (GENAI_DENIAL.test(r.text) && !GENAI_HONEST.test(r.text)) {
            flags.add("genai_flat_denial");
            gaps.push({ dimension: "switch_rationale_honesty", expected: "Honest GenAI disclosure with where + how + verification ('used Copilot for boilerplate, wrote tests by hand')", observed: "Flat denial reads as dishonest — 2026 HR assumes everyone uses AI; the answer is HOW, not IF", severity: "medium" });
            break;
          }
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && LOYALTY_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 220 && LOYALTY_FLAT_YES.test(r.text) && !LOYALTY_CALIBRATED.test(r.text)) {
          flags.add("loyalty_overcommit");
          gaps.push({ dimension: "commitment_signal", expected: "Calibrated honesty ('I plan for 3+ years, can't promise — but I'd communicate early if anything changed')", observed: "Flat promise reads as performative — HR knows you can't actually commit to N years", severity: "low" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && ASPIRATION_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && ASPIRATION_WALKBACK.test(r.text)) {
          flags.add("aspiration_walkback");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Hold the stated aspiration AND tie it to this role ('founder ambitions in 3+ yrs; this role gives me X experience I need first')", observed: "Walked back a stated aspiration when probed — reads as inconsistent", severity: "medium" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && BAND_MISMATCH_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && FLOOR_COLLAPSE.test(r.text)) {
          flags.add("floor_collapse");
          gaps.push({ dimension: "comp_transparency", expected: "Hold a floor with rationale ('my floor is X — anchored on competing offer / current + reasonable hike')", observed: "Collapsed to 'whatever you can offer' — HR will now anchor at the bottom of their band", severity: "high", flag: "floor_collapse" });
          rescoreEvidence.set("floor_collapse", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && REVERSE_INVITED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text) {
          const fluff = REVERSE_FLUFF.test(r.text);
          const substantive = REVERSE_SUBSTANTIVE.test(r.text);
          if (fluff && !substantive) {
            flags.add("reverse_interview_low_quality");
            gaps.push({ dimension: "motivation_specificity", expected: "Ask 2-3 substantive questions (team structure, success metric, manager style, first-90-day expectations)", observed: "Closed with no questions or only logistics — reads as low engagement", severity: "medium" });
            break;
          }
        }
      }
    }

    /* ── Positive HR signals ─────────────────────────────────────────────
       Mirror the four highest-frequency negative detectors so a strong
       candidate gets credit, not just a list of nits. Each fires ONLY when
       the corresponding negative did NOT, and is surfaced as a strength in
       coachingNotes — never pushed as a rubric gap. */
    {
      // notice_period_precise — exact days AND buyout/handover/LWD depth.
      const hrAskedNotice = transcript.some((t) => isAi(t) && NOTICE_ASKED.test(t.text || ""));
      const gaveConcrete = transcript.some((t) => isUser(t) && NOTICE_CONCRETE.test(t.text || ""));
      if (
        hrAskedNotice &&
        gaveConcrete &&
        // Depth must come from the CANDIDATE, not the interviewer. allText
        // mixes AI + user turns, so testing it credited the candidate when
        // HR raised buyout/handover/LWD and the candidate never did.
        NOTICE_DEPTH.test(userText) &&
        !flags.has("vague_notice_period") &&
        !flags.has("notice_period_shallow")
      ) {
        flags.add("notice_period_precise");
      }

      // bgv_docs_volunteered — HR raised BGV and candidate named docs, no evasion.
      const hrAskedBgv = transcript.some((t) => isAi(t) && BGV_PROMPT.test(t.text || ""));
      const userNamedDoc = transcript.some((t) => isUser(t) && BGV_DOC_NAMED.test(t.text || ""));
      if (
        hrAskedBgv &&
        userNamedDoc &&
        !flags.has("bgv_document_evasion") &&
        !flags.has("bgv_document_evasion_sustained") &&
        !flags.has("bgv_document_initial_hedge") &&
        // Naming other docs while refusing payslips is not a clean volunteer —
        // payslip refusal is the dominant BGV red flag and must veto the credit.
        !flags.has("payslip_refusal") &&
        !flags.has("payslip_refusal_sustained")
      ) {
        flags.add("bgv_docs_volunteered");
      }

      // specific_why_us — why-company answer grounded in a concrete signal.
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (isAi(t) && WHY_COMPANY_PROMPT.test(t.text || "")) {
          const r = replyTo(transcript, i);
          if (r && r.text && r.text.length >= 40 && SPECIFIC_WHY.test(r.text) && !flags.has("generic_why_company")) {
            flags.add("specific_why_us");
            break;
          }
        }
      }

      // reverse_questions_substantive — closed with real questions.
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (isAi(t) && REVERSE_INVITED.test(t.text || "")) {
          const r = replyTo(transcript, i);
          if (r && r.text && REVERSE_SUBSTANTIVE.test(r.text) && !flags.has("reverse_interview_low_quality")) {
            flags.add("reverse_questions_substantive");
            break;
          }
        }
      }
    }

    /* ── Wave-2 detection blocks ─────────────────────────────────────── */

    // Job-hopping pattern — short stint volunteered without narrative.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && SHORT_STINT_VOLUNTEERED.test(t.text || "")) {
        const segment = t.text || "";
        const occurrences = (segment.match(SHORT_STINT_VOLUNTEERED) || []).length;
        // Either repeated short stints in one turn, OR an HR probe + thin narrative.
        const hrProbed = transcript.some((x) => isAi(x) && JOB_HOPPING_PROMPT.test(x.text || ""));
        if ((occurrences >= 2 || hrProbed) && !STINT_NARRATIVE.test(segment) && !STINT_NARRATIVE.test(userText)) {
          flags.add("job_hopping_pattern");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Each short stint accompanied by a one-line reason (layoff, founder exit, bond completed, domain change)", observed: "Multiple short stints surfaced without a narrative — Indian HR will assume instability", severity: "medium" });
          break;
        }
      }
    }

    // Moonlighting flat denial — Wipro/Infosys post-2022 probe.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && MOONLIGHT_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && MOONLIGHT_FLAT_DENIAL.test(r.text) && !MOONLIGHT_HONEST.test(r.text)) {
          flags.add("moonlighting_flat_denial");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Honest disclosure with boundaries ('I contribute to open-source on weekends, no client conflict')", observed: "Flat denial of any side activity reads as evasive — 2026 HR expects disclosure with scope", severity: "medium", flag: "moonlighting_flat_denial" });
          rescoreEvidence.set("moonlighting_flat_denial", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    // PF/UAN dual-employment evasion.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && PF_UAN_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && PF_UAN_EVASIVE.test(r.text)) {
          flags.add("pf_uan_evasive");
          gaps.push({ dimension: "compliance_readiness", expected: "Know your UAN, single active PF account, no overlapping contributions — BGV pulls EPFO records", observed: "Hedged on UAN / PF — recruiter assumes hidden parallel employment", severity: "high" });
          break;
        }
      }
    }

    // Family-constraint freeze — relocation/marriage probe response.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && FAMILY_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.trim().length < 60 && FAMILY_FREEZE.test(r.text.trim())) {
          flags.add("family_constraint_freeze");
          gaps.push({ dimension: "logistics_clarity", expected: "Brief, neutral handling — 'I'm open to relocation' or 'I have a hometown preference; happy to discuss'", observed: "Froze or deflected on a family/relocation probe — HR reads as hidden constraint", severity: "low" });
          break;
        }
      }
    }

    // Joining-date over-promise — fast-join claim with long-notice context.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && JOIN_FAST_PROMISE.test(t.text || "") && NOTICE_LONG.test(allText)) {
        flags.add("joining_date_overpromise");
        gaps.push({ dimension: "logistics_clarity", expected: "Match join date to actual notice + buyout reality ('60-day notice, ₹X buyout possible — earliest LWD is Y')", observed: "Promised a fast join while notice in this conversation is 60-90 days — HR will assume you'll ghost current employer", severity: "medium" });
        break;
      }
    }

    // Clawback blind accept.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CLAWBACK_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && CLAWBACK_BLIND_YES.test(r.text.trim()) && !CLAWBACK_INFORMED.test(r.text)) {
          flags.add("clawback_blind_accept");
          gaps.push({ dimension: "comp_transparency", expected: "Acknowledge + ask terms: 'I'm fine in principle — could you share the duration, amount, and pro-rate structure?'", observed: "Blind-accepted a clawback/bond without asking duration or amount — sets up a post-joining surprise", severity: "medium", flag: "clawback_blind_accept" });
          rescoreEvidence.set("clawback_blind_accept", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    // RTO flat refusal.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && RTO_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && RTO_FLAT_REFUSAL.test(r.text) && !RTO_NEGOTIATED.test(r.text)) {
          flags.add("rto_flat_refusal");
          gaps.push({ dimension: "logistics_clarity", expected: "Negotiate with constraints, don't flat-refuse: 'I can do 3 in-office days; can we discuss hybrid?'", observed: "Flat refusal of office days — 2026 RTO is non-negotiable at most service-tier and product-Indian firms", severity: "high" });
          break;
        }
      }
    }

    // Designation downgrade defensive.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && DOWNGRADE_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && DOWNGRADE_DEFENSIVE.test(r.text)) {
          flags.add("designation_downgrade_defensive");
          gaps.push({ dimension: "motivation_specificity", expected: "Own the leveling reality + reframe to scope: 'Title is calibrated to your scope/team; I care about the problem space and trajectory'", observed: "Defensive on title downgrade — reads as ego-bruised, not mission-driven", severity: "low" });
          break;
        }
      }
    }

    // Certification gap evasion.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CERT_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && CERT_VAGUE.test(r.text)) {
          flags.add("certification_gap_evasion");
          gaps.push({ dimension: "compliance_readiness", expected: "Know your cert exact date + ID + expiry — HR verifies via Credly/AWS directly during BGV", observed: "Vague on certification date — recruiter will verify and discrepancy reads as resume inflation", severity: "medium" });
          break;
        }
      }
    }

    // CTC-first user opening — candidate asks about salary in turn 1 or 2.
    {
      const userTurns: Array<{ idx: number; text: string }> = [];
      transcript.forEach((t, idx) => { if (isUser(t)) userTurns.push({ idx, text: t.text || "" }); });
      const earlyTurns = userTurns.slice(0, 2);
      const earlyHrAskedSalary = transcript.slice(0, earlyTurns.length > 0 ? earlyTurns[earlyTurns.length - 1].idx + 1 : 0).some((x) => isAi(x) && ASKED_ABOUT_SALARY.test(x.text || ""));
      if (!earlyHrAskedSalary && earlyTurns.some((u) => CTC_FIRST_USER.test(u.text))) {
        flags.add("ctc_first_question_user");
        gaps.push({ dimension: "motivation_specificity", expected: "Lead with role + team fit; surface comp questions after HR signals discovery is done", observed: "Asked about CTC/package before role/team discussion — reads as transactional", severity: "medium" });
      }
    }

    /* comp_held_until_close — positive signal. Candidate did NOT raise
       salary / CTC in their first 3 user turns. Indian HR rewards this
       as role-first register. Must run AFTER ctc_first_question_user
       so the guard at L730 actually suppresses double-credit. Only
       credit-worthy on long-form sessions where there was time to
       surface comp early but the candidate chose not to. */
    {
      if (transcript.length > 8) {
        const firstUserTurns = transcript.filter(isUser).slice(0, 3);
        const raisedCompEarly = firstUserTurns.some((t) => COMP_RAISED_BY_USER.test(t.text || ""));
        if (!raisedCompEarly && !flags.has("ctc_first_question_user")) {
          flags.add("comp_held_until_close");
        }
      }
    }

    /* ── v5.4.0 realism additions ────────────────────────────────── */

    // multi_offer_undisclosed — HR probed other offers; user answered
    // vaguely ("yeah a few places") with no stage / company / timeline.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && OTHER_OFFERS_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (OTHER_OFFERS_VAGUE.test(r.text) && !OTHER_OFFERS_SPECIFIC.test(r.text)) {
        flags.add("multi_offer_undisclosed");
        gaps.push({
          dimension: "commitment_signal",
          expected: "When HR asks about other offers, give stage + company + timeline ('final round at Razorpay, offer expected by Friday'). Specifics convert into negotiating leverage; vague answers signal weak market option",
          observed: "Candidate gave a vague 'a few places' answer with no stage / company / timeline — HR reads this as either no real competing process or unwilling to disclose",
          severity: "high",
          flag: "multi_offer_undisclosed",
        });
        rescoreEvidence.set("multi_offer_undisclosed", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // location_flex_unprobed — HR named a base city; candidate never
    // probed relocation / temp WFH / housing. FAANG India / GCC critical.
    {
      const hrNamedCity = transcript.some(
        (t) => isAi(t) && (HR_BASE_KEYWORD.test(t.text || "") || HR_CITY_WITH_ROLE.test(t.text || "")),
      );
      const userProbedRelo = transcript.some((t) => isUser(t) && RELO_PROBED.test(t.text || ""));
      if (hrNamedCity && !userProbedRelo && transcript.length > 8) {
        flags.add("location_flex_unprobed");
        gaps.push({
          dimension: "logistics_clarity",
          expected: "When HR mentions base city / reporting location, probe relocation assistance, temporary WFH window during the move, and housing allowance. FAANG India / GCC base-city is non-negotiable — knowing the support package is non-trivial money",
          observed: "Base city was mentioned but candidate never asked about relocation support, temp-remote window, or housing allowance — leaves lakhs of relo benefits on the table",
          severity: "high",
          flag: "location_flex_unprobed",
        });
      }
    }

    // reason_for_leaving_blame_framing — softer than badmouthing.
    // "no growth", "wasn't valued", "politics" without a forward frame.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && REASON_LEAVING_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (BLAME_FRAMING.test(r.text) && !FORWARD_FRAME.test(r.text) && !flags.has("user_badmouthing_employer")) {
        flags.add("reason_for_leaving_blame_framing");
        gaps.push({
          dimension: "professionalism",
          expected: "Reason-for-leaving should lead with the FORWARD frame ('want to move into agentic-search domain') not the BACKWARD blame ('no growth there, manager wasn't supportive'). Indian HR uses this exact diff to score maturity",
          observed: "Candidate framed leaving via blame ('no growth', 'wasn't valued', 'politics') without a forward / pull frame — softer than badmouthing but reads as the candidate the problem will follow",
          severity: "high",
          flag: "reason_for_leaving_blame_framing",
        });
        rescoreEvidence.set("reason_for_leaving_blame_framing", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // reference_list_vague — candidate affirms references but never
    // names them. Distinct from reference_refusal (no references) and
    // reference_initial_hedge (recovered after stall).
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && REFERENCE_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (
        REFERENCE_AFFIRMED_VAGUE.test(r.text) &&
        !REFERENCE_NAMED.test(r.text) &&
        !flags.has("reference_refusal") &&
        !flags.has("reference_initial_hedge")
      ) {
        flags.add("reference_list_vague");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Reference list should be NAMED: 'my manager Anand at Swiggy' or 'Priya, who was my lead at Razorpay'. Real HR weights named > vague — vague reads as a list you haven't actually pre-cleared",
          observed: "Candidate confirmed references exist but never named them — HR assumes the list isn't actually pre-cleared with the named referees",
          severity: "medium",
          flag: "reference_list_vague",
        });
        rescoreEvidence.set("reference_list_vague", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // esop_literacy_low — HR offered ESOP/RSU and candidate never
    // surfaced any of strike / cliff / vest / double-trigger / FMV.
    {
      const hrMentionedEsop = transcript.some((t) => isAi(t) && ESOP_HR_MENTION.test(t.text || ""));
      const userShowedLiteracy = transcript.some((t) => isUser(t) && ESOP_LITERACY.test(t.text || ""));
      if (hrMentionedEsop && !userShowedLiteracy && transcript.length > 8) {
        flags.add("esop_literacy_low");
        gaps.push({
          dimension: "comp_transparency",
          expected: "When ESOP / RSU / equity is offered, ask the standard four: strike price + cliff (typically 1 yr) + vest schedule (4 yr standard) + double-trigger (for unicorns) / FMV (for private cos). At pre-IPO / unicorn comp this is six- to seven-figure exposure",
          observed: "ESOP / RSU was on the table but candidate never surfaced strike / cliff / vest / double-trigger / FMV — accepting equity blind is the classic pre-IPO regret pattern",
          severity: "medium",
          flag: "esop_literacy_low",
        });
      }
    }

    // bell_curve_pip_unprobed — mid+ session, long-form, candidate
    // never probes performance calibration / stack rank / PIP history.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const candidateProbed = transcript.some((t) => isUser(t) && BELL_CURVE_PROBED.test(t.text || ""));
      if (isMidPlus && transcript.length > 12 && !candidateProbed) {
        flags.add("bell_curve_pip_unprobed");
        gaps.push({
          dimension: "switch_rationale_honesty",
          expected: "At mid+ HR rounds at Amazon / Microsoft / TCS / Wipro, ask about performance calibration cycle, bell-curve / stack-rank policy, PIP history, and regretted-attrition rate. These are the structural factors that decide whether you're set up to succeed",
          observed: "Long-form mid+ session but candidate never asked about bell curve / stack rank / PIP / attrition — these are the calibration realities that bite 6-12 months in",
          severity: "medium",
          flag: "bell_curve_pip_unprobed",
        });
      }
    }

    // buyout_split_unaddressed — buyout raised by HR, candidate didn't
    // probe who pays (new employer reimburses vs candidate self-funds).
    // v5.5.0: HR-gated. Candidate-only buyout mentions (very common —
    // candidate volunteers "60 days notice, buyout possible") should
    // NOT fire this flag; the candidate already owns the topic and HR
    // never opened the funding question to begin with.
    {
      const hrRaisedBuyout = transcript.some((t) => isAi(t) && BUYOUT_MENTIONED.test(t.text || ""));
      const splitProbed = transcript.some((t) => isUser(t) && BUYOUT_SPLIT_PROBED.test(t.text || ""));
      if (hrRaisedBuyout && !splitProbed && transcript.length > 8) {
        flags.add("buyout_split_unaddressed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When buyout is on the table, probe WHO pays: new employer reimburses vs candidate self-funds vs offset against joining bonus. This is a lakhs-level negotiation lever — buyout cost is typically 1-3 months gross",
          observed: "Buyout came up in the conversation but the funding question was never raised — leaves the split as a default 'candidate self-funds' which costs lakhs",
          severity: "medium",
          flag: "buyout_split_unaddressed",
        });
      }
    }

    /* ── v5.5.0 realism additions ────────────────────────────────── */

    // hybrid_expectation_mismatch — candidate volunteers an absolutist
    // fully-remote demand with no hybrid-negotiation softener.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && FULLY_REMOTE_DEMAND.test(t.text || ""))) continue;
      if (HYBRID_NEGOTIATION.test(t.text || "")) continue;
      // Don't double-fire with rto_flat_refusal (which requires HR
      // to have asked first); this one catches the candidate-volunteered
      // version that rto_flat_refusal misses.
      if (flags.has("rto_flat_refusal")) break;
      flags.add("hybrid_expectation_mismatch");
      rescoreEvidence.set("hybrid_expectation_mismatch", { aiPrompt: "", userReply: t.text || "" });
      gaps.push({
        dimension: "logistics_clarity",
        expected: "Most Indian GCCs / unicorns mandate 3+ day hybrid. Don't volunteer 'fully remote, never come to office' — frame as 'open to hybrid, can do N in-office days; what's the policy?' Absolutist remote demands are an instant misalignment signal in 2025-26",
        observed: "Candidate volunteered a fully-remote / never-in-office posture with no hybrid-negotiation softener — reads as misaligned with India RTO/hybrid reality",
        severity: "high",
        flag: "hybrid_expectation_mismatch",
      });
      break;
    }

    // visa_sponsorship_demand_unprompted — candidate raises H1B /
    // onsite sponsorship for an India-IC role.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && VISA_DEMAND.test(t.text || ""))) continue;
      flags.add("visa_sponsorship_demand_unprompted");
      gaps.push({
        dimension: "motivation_specificity",
        expected: "For an India-based IC role, don't raise H1B / blue-card / onsite sponsorship in the HR round — it signals the India seat is a stepping stone, not the destination. If onsite matters, ask about company-wide mobility programs ('does the team have onsite rotations?') instead of demanding sponsorship",
        observed: "Candidate raised visa sponsorship / onsite-deputation expectation in the HR round — for India-IC roles this reads as misalignment with the seat",
        severity: "high",
        flag: "visa_sponsorship_demand_unprompted",
      });
      break;
    }

    // salary_review_cycle_unprobed — mid+ long-form, comp discussed,
    // no candidate-side question about review/appraisal cadence.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const compDiscussed = ASKED_ABOUT_SALARY.test(aiText) || transcript.some((t) => isUser(t) && SALARY_NUMBER.test(t.text || ""));
      const reviewProbed = transcript.some((t) => isUser(t) && REVIEW_CYCLE_PROBE.test(t.text || ""));
      if (isMidPlus && compDiscussed && !reviewProbed && transcript.length > 10) {
        flags.add("salary_review_cycle_unprobed");
        gaps.push({
          dimension: "comp_transparency",
          expected: "At mid-senior, ask about the review cycle (annual / half-yearly), off-cycle correction policy, and promo cadence. Comp is a trajectory not a number — Indian HR expects this question from candidates who've negotiated before",
          observed: "Comp was discussed but candidate never asked about review cycle / off-cycle / promo cadence — accepts the comp number as static instead of as a starting point",
          severity: "medium",
          flag: "salary_review_cycle_unprobed",
        });
      }
    }

    // tax_structure_naive — mid+ candidate negotiates only on
    // gross/fixed without engaging tax-optimised structure.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const compDiscussed = ASKED_ABOUT_SALARY.test(aiText) || transcript.some((t) => isUser(t) && SALARY_NUMBER.test(t.text || ""));
      const taxAware = transcript.some((t) => isUser(t) && TAX_STRUCTURE_PROBE.test(t.text || ""));
      if (isMidPlus && compDiscussed && !taxAware && transcript.length > 10) {
        flags.add("tax_structure_naive");
        // session-level signal — no single AI prompt anchors it; pass
        // the user's comp-discussion snippet to the rescorer for context.
        const compTurn = transcript.find((t) => isUser(t) && SALARY_NUMBER.test(t.text || ""));
        rescoreEvidence.set("tax_structure_naive", { aiPrompt: "", userReply: compTurn?.text || userText.slice(0, 400) });
        gaps.push({
          dimension: "comp_transparency",
          expected: "At mid-senior (₹25L+) the take-home delta between a naive structure and a tax-optimised one is 1-2 LPA. Ask about flexi-basket components: 80C max-out, NPS employer contribution (10% extra deduction), LTA, meal cards, gratuity calc. Indian HR expects this fluency",
          observed: "Comp was discussed but candidate never engaged 80C / NPS / flexi / LTA / take-home — gross-only negotiation leaves 1-2 LPA on the table at this band",
          severity: "medium",
          flag: "tax_structure_naive",
        });
      }
    }

    // tier1_college_default_assumption — candidate pre-apologises for
    // non-tier-1 pedigree when HR never raised it. Internalised bias.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && PEDIGREE_PRE_APOLOGY.test(t.text || ""))) continue;
      // Only fire if HR never opened the pedigree topic — otherwise
      // it's a defensive response, not unsolicited.
      const hrAskedPedigree = transcript.slice(0, i).some((x) => isAi(x) && PEDIGREE_PROMPT.test(x.text || ""));
      if (hrAskedPedigree) continue;
      flags.add("tier1_college_default_assumption");
      gaps.push({
        dimension: "register_confidence",
        expected: "Don't pre-apologise for your college unless HR raises it. 'I know my college isn't IIT' / 'despite my tier-3 background' signals internalised bias and low confidence — the interviewer wasn't going there. Lead with what you've shipped; pedigree comes up only if asked",
        observed: "Candidate pre-apologised for non-tier-1 / non-IIT pedigree without HR raising the topic — reads as low confidence and surfaces a screen you'd otherwise have avoided",
        severity: "medium",
        flag: "tier1_college_default_assumption",
      });
      break;
    }

    /* ── Resume cross-checks (silent no-op when resume null) ─── */
    if (resume) {
      const resumeAgg = summarizeResume(resume);

      // 1) resume_transcript_mismatch — candidate verbally names an
      //    employer that doesn't appear in their resume. BGV will catch
      //    this; flag it here so the candidate either corrects the habit
      //    or updates the resume.
      if (resumeAgg.employers.length > 0) {
        const claimed: string[] = [];
        for (const t of transcript) {
          if (!isUser(t) || !t.text) continue;
          const re = new RegExp(TRANSCRIPT_EMPLOYER_RE.source, "gi");
          let m: RegExpExecArray | null;
          while ((m = re.exec(t.text)) !== null) {
            const name = m[1].trim().replace(/[.,;:!?]+$/, "");
            if (name.length < 2 || name.length > 60) continue;
            // v5.6.0: lowercase regex captures common-noun phrases
            // ("a fintech", "an early-stage saas"). Drop captures whose
            // first token is an article / generic descriptor, and drop
            // captures that are entirely generic-noun / stop tokens —
            // real employer mentions either start with a proper noun
            // or include a brand-shaped token.
            const tokens = name.toLowerCase().split(/\s+/);
            const first = tokens[0] || "";
            if (EMPLOYER_STOP_TOKENS.has(first)) continue;
            if (tokens.every((tk) => EMPLOYER_GENERIC_TOKENS.has(tk) || EMPLOYER_STOP_TOKENS.has(tk) || tk.length < 4)) continue;
            // Drop single-token captures that look like English verbs
            // (the regex's "my current company is X" arm catches phrases
            // like "is taking", "is doing", "is building").
            if (tokens.length === 1 && /(?:ing|ed)$/.test(tokens[0])) continue;
            claimed.push(name);
          }
        }
        const orphans = claimed.filter(
          (c) => !resumeAgg.employers.some((e) => tokensOverlap(c, e)),
        );
        if (orphans.length > 0) {
          flags.add("resume_transcript_mismatch");
          const uniqOrphans = Array.from(new Set(orphans)).slice(0, 3);
          const resumeList = resumeAgg.employers.slice(0, 4).join(", ");
          gaps.push({
            dimension: "credibility",
            expected: "Every employer named in the interview must already appear on the resume — BGV pulls the resume as the source of truth.",
            observed: `Resume lists: ${resumeList}. You said: ${uniqOrphans.join(", ")} — ${uniqOrphans.length === 1 ? "this employer is" : "these employers are"} absent from the resume.`,
            severity: "high",
            flag: "resume_transcript_mismatch",
          });
        }
      }

      // 2) resume_gap_unaddressed — resume has a ≥3-month employment gap
      //    and HR never probed it. Pre-empt the real round: prepare a
      //    crisp factual one-liner now or get cornered later.
      if (resumeAgg.gapsMonths.length > 0) {
        const hrProbedGap = transcript.some(
          (t) => isAi(t) && (GAP_PROMPT.test(t.text || "") || CAREER_BREAK_PROMPT.test(t.text || "")),
        );
        if (!hrProbedGap) {
          const biggest = Math.max(...resumeAgg.gapsMonths);
          flags.add("resume_gap_unaddressed");
          gaps.push({
            dimension: "switch_rationale_honesty",
            expected: "Resume gaps ≥3 months always surface in the real HR round — pre-prep a one-liner with dates + reason + what you did.",
            observed: `Resume shows a ${biggest}-month gap between employments; this session did not surface or address it.`,
            severity: "medium",
            flag: "resume_gap_unaddressed",
          });
        }
      }

      // 3) inflated_seniority_claim — resume YoE < 3 years but the title
      //    (on CV or in transcript) reads Senior / Lead / Staff / Principal.
      //    Indian HR cross-checks level vs years; mismatch reads as
      //    resume inflation.
      if (resumeAgg.yoeMonths !== null && resumeAgg.yoeMonths < 36) {
        const resumeSenior = resumeAgg.titles.some((t) => SENIOR_TITLE_RE.test(t));
        const transcriptSenior: string[] = [];
        for (const t of transcript) {
          if (!isUser(t) || !t.text) continue;
          const reSelf = /\b(?:i\s+am|i'?m|i\s+work\s+as|my\s+(?:current|present)\s+(?:role|title|designation)\s+is)\s+(?:a\s+|an\s+|the\s+)?([\w\s./-]{3,60})/gi;
          let m: RegExpExecArray | null;
          while ((m = reSelf.exec(t.text)) !== null) {
            const claim = (m[1] || "").trim();
            if (SENIOR_TITLE_RE.test(claim)) transcriptSenior.push(claim.slice(0, 40));
          }
        }
        if (resumeSenior || transcriptSenior.length > 0) {
          flags.add("inflated_seniority_claim");
          const yearsRounded = (resumeAgg.yoeMonths / 12).toFixed(1);
          const observedTitle = (resumeSenior ? resumeAgg.titles : transcriptSenior).find((t) => SENIOR_TITLE_RE.test(t)) || "senior";
          const resumeTitle = resumeAgg.titles[0] || "unknown";
          const transcriptQuote = transcriptSenior[0] ? ` you said "${transcriptSenior[0]}"` : "";
          gaps.push({
            dimension: "credibility",
            expected: "Senior / Lead / Staff / Principal titles typically require 5+ years of relevant experience in the Indian market.",
            observed: resumeSenior
              ? `Resume YoE ≈ ${yearsRounded} years, resume title is "${resumeTitle}" (matches ${observedTitle}).${transcriptQuote ? ` Verbally${transcriptQuote}.` : ""} Reads as level inflation.`
              : `Resume YoE ≈ ${yearsRounded} years, resume title is "${resumeTitle}",${transcriptQuote} — claimed level outruns the YoE on paper.`,
            severity: "medium",
            flag: "inflated_seniority_claim",
          });
        }
      }

      // 4) under_titled_candidate — inverse of (3). Resume YoE ≥ 5 years
      //    but every listed title is plain IC ("Software Engineer",
      //    "Developer", "Analyst") with no Senior/Lead/Staff/Principal
      //    modifier. This isn't a credibility issue — it's a comp-leverage
      //    issue. HR anchors the comp band on title, not narrative; an
      //    under-titled candidate gets anchored low. Coaching nudge: retitle
      //    to match scope or be ready to walk through scope that exceeds
      //    the level on paper before the offer locks in.
      if (resumeAgg.yoeMonths !== null && resumeAgg.yoeMonths >= 60 && resumeAgg.titles.length > 0) {
        const anySenior = resumeAgg.titles.some((t) => SENIOR_TITLE_RE.test(t));
        const allPlainIC = resumeAgg.titles.every((t) =>
          /\b(?:software\s+engineer|developer|programmer|analyst|consultant|associate|engineer)\b/i.test(t) && !SENIOR_TITLE_RE.test(t),
        );
        if (!anySenior && allPlainIC) {
          flags.add("under_titled_candidate");
          const yearsRounded = (resumeAgg.yoeMonths / 12).toFixed(1);
          gaps.push({
            dimension: "comp_transparency",
            expected: "By ~5 years YoE in the Indian market, the resume title should reflect scope (Senior / Lead) — HR anchors the comp band on title, not narrative.",
            observed: `Resume YoE ≈ ${yearsRounded} years but every title is plain IC ("${resumeAgg.titles[0]}"). Under-titled candidates get anchored low on band.`,
            // Promoted low → medium: at 5+ YoE in the Indian market the
            // title-anchor gap is worth lakhs at offer time, not a nice-to-have.
            severity: "medium",
            flag: "under_titled_candidate",
          });
        }
      }
    }

    const covered = DIMENSIONS.filter((d) => DIMENSION_PATTERNS[d].test(allText));
    if (transcript.length > 8 && covered.length < 4) {
      flags.add("dimensions_thin_coverage");
      const missed = DIMENSIONS.filter((d) => !covered.includes(d));
      gaps.push({ dimension: "session_coverage", expected: "Indian HR round should touch ≥4 of 7 dimensions: logistics, comp, stability, compliance, commitment, benefits, motivation", observed: `Only ${covered.length}/7 covered. Missing: ${missed.join(", ")}.`, severity: "medium" });
    }

    /* ── 2nd-pass LLM rescore for weak-regex flags ──
       Three flags rely on token-level regex matches that can false-positive on
       answers which actually meet their rubric (e.g. someone says "great culture
       — specifically RazorpayX's launch in 2024" — "great culture" fires
       generic_why_company even though the reply IS specific). The rescore step
       hands each fired flag + its surrounding turns to the LLM and drops the
       flag if the LLM judges it a false positive.

       Gated by LLM_RESCORE_ENABLED. When off, rescoreFlags returns null and
       every flag is kept as-is (fail-open). When the call fails, same — so the
       worst case is identical to the pure-regex pass, never a regression. */
    const rescoreCandidates: FlagRescoreCandidate[] = [];
    for (const flag of Object.keys(RESCORE_RUBRICS)) {
      const ev = rescoreEvidence.get(flag);
      if (ev && flags.has(flag)) {
        rescoreCandidates.push({ flag, aiPrompt: ev.aiPrompt, userReply: ev.userReply, rubric: RESCORE_RUBRICS[flag] });
      }
    }
    if (rescoreCandidates.length > 0) {
      const verdicts = await rescoreFlags(rescoreCandidates);
      if (verdicts) {
        for (const v of verdicts) {
          if (!v.keep && flags.has(v.flag)) {
            flags.delete(v.flag);
          }
        }
      }
    }

    const tips: string[] = [];

    for (const cluster of CLUSTERS) {
      const hits = cluster.members.filter((m) => flags.has(m));
      if (hits.length >= 2) {
        tips.push(
          `Pattern, not isolated: ${hits.length} signals across ${cluster.theme} (${hits.slice(0, 4).join(", ")}). Indian HR scores ${cluster.label} as a cluster — fix the pattern, not just the loudest one.`,
        );
      }
    }

    /* Positive-signal counterpart to counter_offer_dodge — surfaced
       before negative tips so the candidate sees credit first. Not a
       rubric gap; pushed into coachingNotes for visibility only. */
    if (flags.has("offer_accepted_graceful")) {
      tips.push("Strong commitment signal: you closed the counter-offer probe cleanly ('won't entertain a counter / once I sign I'm in'). HR's #1 fear is pre-joining drop-out — that line de-risks you. Keep using it.");
    }
    if (flags.has("comp_held_until_close")) {
      tips.push("Positive signal: you held salary off the table until HR opened it — that reads as role-first, not money-first. Indian HR scores this as the right register; keep that discipline.");
    }
    if (flags.has("notice_period_precise")) {
      tips.push("Strong logistics signal: you gave exact notice days AND covered the depth (buyout / handover / earliest LWD). That's precisely what mid-senior HR scores — it de-risks your start date. Keep leading with the full picture.");
    }
    if (flags.has("bgv_docs_volunteered")) {
      tips.push("Strong compliance signal: you named your BGV docs by name (Form 16 / UAN / payslips / relieving letters) without being pushed. Fluency here reads as 'I've onboarded before' and speeds up intake. Keep it.");
    }
    if (flags.has("specific_why_us")) {
      tips.push("Strong motivation signal: your 'why us' was grounded in something concrete (a launch / leader / domain), not 'great culture'. That specificity is what separates a real answer from a template — keep anchoring on facts.");
    }
    if (flags.has("reverse_questions_substantive")) {
      tips.push("Strong engagement signal: you closed with substantive questions (team / success metrics / manager style), not logistics. HR reads this as genuine interest — keep ending rounds this way.");
    }

    if (flags.has("user_anchor_leaked_salary")) tips.push("Never name a salary first — deflect with 'I'd want to understand the role + level before discussing comp.'");
    if (flags.has("user_badmouthing_employer")) tips.push("Reframe past frustrations as growth opportunities. HR scores professionalism heavily.");
    if (flags.has("generic_self_intro")) tips.push("Tighten 'tell me about yourself' to a 90-second story with 2 concrete projects + outcomes.");
    if (flags.has("vague_notice_period")) tips.push("Know your notice period cold — exact days, buyout policy, earliest LWD. Vague answers signal flight risk.");
    if (flags.has("notice_period_shallow")) tips.push("Concrete days alone aren't enough at mid-senior. Layer on: buyout cost (typically 1 month gross), handover / KT plan, earliest LWD with manager sign-off, and whether early release is precedented. That's what HR scores.");
    if (flags.has("bgv_literacy_low")) tips.push("Name the docs by name when BGV comes up: 'Form 16 for last 2 years, UAN active, last 3 payslips, relieving letter from each employer.' Fluency signals you've onboarded before — opaque hand-waving slows down BGV intake.");
    if (flags.has("comp_breakup_probe_missing")) tips.push("Always probe ESOP / variable / clawback terms before you sign: cliff (typically 1yr), vesting (4yr standard), variable payout history (% paid out last 2 cycles), joining-bonus clawback duration. Accepting blind is the #1 post-joining regret pattern.");
    if (flags.has("bond_terms_unprobed")) tips.push("When service bond comes up, probe before agreeing: 'What's the bond duration — 1 or 2 years? What's the breakage penalty? Is it pro-rated by months served? Is it notarised?' Services-track training bonds (TCS, Infosys, Wipro, Accenture) lock you in 12-24 months with ₹50k–2L breakage. Knowing the terms is the difference between an informed choice and a five-figure exit shock.");
    if (flags.has("pedigree_evasion")) tips.push("Under 5 years experience, Indian HR will anchor on academics — know your CGPA, 10th %, 12th %, college name cold. 'Don't remember exactly' reads as hiding a sub-7 CGPA. Even if you're not proud of the number, own it: 'Graduated with X.Y CGPA from <college> — academics weren't my strongest, but here's what I did with my time after.'");
    if (flags.has("current_employer_counter_unresolved")) tips.push("If you mention your current employer is counter-offering, ALWAYS close it in the same breath: 'they're trying to match — I've already told them no.' Mentioning a counter without declining reads as you keeping the option open. India-market reality: ~40% of senior offers face a counter; HR rounds reward candidates who pre-empt the script.");
    if (flags.has("probation_terms_unprobed")) tips.push("When probation comes up, probe terms cold: 'What's the duration — 3 or 6 months? What are the confirmation criteria? Is the notice period during probation different? Is pay full or pro-rated?' Services-track probation has termination-without-cause clauses; blind acceptance leaves you exposed to a month-3 surprise.");
    if (flags.has("bgv_document_evasion")) tips.push("Keep payslips (last 3), Form 16, relieving letters, PAN/Aadhaar/UAN ready. Hesitation here blocks onboarding via BGV.");
    if (flags.has("bgv_document_evasion_sustained")) tips.push("Sustained BGV evasion across multiple probes is the strongest pre-offer red flag. Pre-prep a single line: 'I have all documents — payslips, Form 16, UAN — ready to share over secure channel.'");
    if (flags.has("bgv_document_initial_hedge")) tips.push("You recovered on a later BGV probe, but the first hedge still registers. Lead with confidence: 'Yes, I can share' beats 'let me check first.'");
    if (flags.has("payslip_refusal") && !flags.has("bgv_document_evasion")) tips.push("Refusing payslips reads as inflated current CTC. Share them — or justify why your number isn't anchored on current.");
    if (flags.has("counter_offer_dodge")) tips.push("On counter-offers: 'If I accept yours, I won't take a counter.' Pre-joining drop-out is HR's #1 fear — give them the clarity.");
    if (flags.has("generic_why_company")) tips.push("Drop 'great culture / great brand'. Name one specific thing: a recent launch, a leader's blog, a domain bet.");
    if (flags.has("gap_unexplained")) tips.push("Own gaps with one crisp sentence: dates + reason + what you did with the time. Indian HR will probe — be ready.");
    if (flags.has("hike_rationale_thin")) tips.push("Anchor hike % on market data or scope, not a desired round number.");
    if (flags.has("salary_breakup_vague")) tips.push("When HR asks structure, break the CTC down: 'Fixed X, variable Y (paid out Z%), joining bonus A, RSU vest B over 4 years.' Single-number CTC reads as inflated variable.");
    if (flags.has("salary_breakup_unknown_owned")) tips.push("You owned the unknown well ('I don't know the exact variable payout history') — that's better than guessing. Action item before the next round: pull last 2 years of payslips, talk to your manager about variable %, and learn the RSU vest schedule. Knowing the breakup is non-negotiable at offer time.");
    if (flags.has("over_deferential_opener")) tips.push("Drop the 'respected ma'am / it's an honour' framing — at MNC / FAANG / GCC / BFSI-global HR rounds it reads as juniorish and depresses your comp anchor. Try: 'Thanks for the time — quick background then I'll let you drive.' Confident-equal register, not deferential.");
    if (flags.has("reference_refusal")) tips.push("Have 2 references ready (ex-managers preferred). Saying 'no references' is a hard BGV blocker — even one current peer + one ex-manager is fine.");
    if (flags.has("reference_refusal_sustained")) tips.push("Refusing references across multiple HR probes is a hard pre-offer stop. Line up at least one ex-manager + one peer before the next round.");
    if (flags.has("reference_initial_hedge")) tips.push("You recovered on the second reference probe, but the initial hedge still scored. Have a name + role ready before HR asks twice.");
    if (flags.has("payslip_refusal_sustained")) tips.push("Refusing payslips on every probe locks HR into assuming inflated CTC. Share them or pre-empt: 'My ask isn't anchored on current — here's the rationale.'");
    if (flags.has("offer_letter_delay_anxiety")) tips.push("Hold offer-letter timing questions for the close — asking mid-interview reads as anxious. Phrase it cleanly: 'What's your typical timeline from verbal to written offer?'");
    if (flags.has("prior_bgv_fail_uncontextualised")) tips.push("Prior BGV failure? Own it with date + reason + resolution in one breath: 'flagged in 2022 for date overlap with my notice, cleared in 30 days.' Recruiters trust honest specifics.");
    if (flags.has("non_compete_unquantified")) tips.push("Non-compete? State scope crisply: duration + geography + industry coverage. 'Vague non-compete' = recruiter timebomb.");
    if (flags.has("genai_flat_denial")) tips.push("Modern HR assumes everyone uses AI. Flat denial reads as dishonest. Answer the HOW: 'Used Copilot for boilerplate; wrote tests by hand; verified security-sensitive bits.'");
    if (flags.has("loyalty_overcommit")) tips.push("Don't promise N years flat. Real answer: 'I plan for 3+ years; I can't promise but I'd communicate early if anything changed.' HR respects calibration.");
    if (flags.has("aspiration_walkback")) tips.push("Don't walk back stated ambitions when probed. Tie them to the role: 'Founder ambition in 3+ yrs — this role gives me the X experience I need first.'");
    if (flags.has("floor_collapse")) tips.push("Never collapse to 'whatever you can offer' on band mismatch. Hold a floor with rationale: 'My floor is X — anchored on competing offer / current + reasonable hike.'");
    if (flags.has("reverse_interview_low_quality")) tips.push("Close with 2-3 substantive questions: team structure, what success looks like in 90 days, manager style. No questions = low engagement signal.");
    if (flags.has("job_hopping_pattern")) tips.push("Short stints? Pre-empt the probe. One line per move: 'left X after 10 months — founder pivoted away from my domain; left Y after a year — bond completed.' Specifics defuse the instability read.");
    if (flags.has("moonlighting_flat_denial")) tips.push("Don't flat-deny moonlighting. Post-2022 HR (Wipro fired 300 for it) expects scoped honesty: 'I contribute to open-source on weekends, no client conflict, disclosed in writing.' That answer scores; 'no, never' reads as evasive.");
    if (flags.has("pf_uan_evasive")) tips.push("Know your UAN cold + confirm no overlapping PF contributions. BGV pulls EPFO; surprises here block onboarding.");
    if (flags.has("family_constraint_freeze")) tips.push("Family / relocation probes deserve a calm one-liner: 'Open to relocation' or 'I have a hometown preference, happy to discuss.' Freezing reads as a hidden constraint.");
    if (flags.has("joining_date_overpromise")) tips.push("Don't promise '15-day join' on a 60-day notice. Be honest: 'My notice is 60 days; I can attempt a buyout if there's flexibility — what's typical here?'");
    if (flags.has("clawback_blind_accept")) tips.push("Never blind-accept a clawback. Ask: 'What's the duration, amount, and pro-rate structure?' Acceptance without terms invites post-joining shock.");
    if (flags.has("rto_flat_refusal")) tips.push("Flat WFH-only is a post-RTO dealbreaker at most Indian firms (TCS, Infosys, Wipro, Flipkart, Swiggy all returned to office in 2023-2024). Negotiate: 'I can do 3 in-office days; what's the hybrid structure?'");
    if (flags.has("designation_downgrade_defensive")) tips.push("Don't dismiss the title question. Frame it: 'Titles map to your leveling; I care about the scope and the problem space — happy to align on what your X-level looks like.'");
    if (flags.has("certification_gap_evasion")) tips.push("Know your cert dates and IDs cold. HR verifies via Credly/AWS directly — vague answers + a discrepancy read as resume inflation.");
    if (flags.has("ctc_first_question_user")) tips.push("Don't open with salary. Establish role / team / scope first; surface comp once HR signals discovery is wrapping. Asking comp upfront reads as transactional.");
    if (flags.has("multi_offer_undisclosed")) tips.push("When HR asks about other offers, name the stage and timeline: 'Razorpay round 3, expecting offer by Friday' or 'Final HR round at Swiggy next week'. Vague 'a few places' answers fail twice — HR assumes either no real competing process or unwilling to disclose. Specifics convert into negotiation leverage; vagueness leaves it on the table.");
    if (flags.has("location_flex_unprobed")) tips.push("Base city was named but you never probed the relocation package — that's lakhs left on the table. Ask cleanly: 'What's the relocation assistance? Is there a temporary WFH window during the move? Housing allowance? Is the joining bonus structured to offset moving costs?' FAANG India / GCC base-city is non-negotiable, but the support package is very negotiable.");
    if (flags.has("reason_for_leaving_blame_framing")) tips.push("Lead with the FORWARD frame, not the BACKWARD blame. 'No growth, manager wasn't supportive' reads as the problem will follow you. Reframe: 'Want to move into [domain] — current role is mature for me there.' Same factual reason, mature register. Indian HR scores this exact diff on every senior switch.");
    if (flags.has("reference_list_vague")) tips.push("Name your references: 'Anand, who was my manager at Swiggy' or 'Priya, my lead at Razorpay'. 'Yeah I have a couple' reads as a list you haven't actually pre-cleared with the named referees. Have two named, pre-aligned references ready before the round.");
    if (flags.has("esop_literacy_low")) tips.push("Equity was on the table and you didn't surface the four standard probes: strike price, cliff (typically 1 yr), vest schedule (4 yr standard), double-trigger (at unicorns) / FMV / 409A (at private cos). At pre-IPO / unicorn comp this is six- to seven-figure exposure — accepting blind is the classic post-joining regret.");
    if (flags.has("bell_curve_pip_unprobed")) tips.push("At mid-senior at Amazon / Microsoft / TCS / Wipro / Infosys, ask about performance calibration cycle, bell-curve / stack-rank policy, PIP history, and regretted-attrition rate. These are the structural factors that decide whether you'll succeed 6-12 months in — and the answer telegraphs a LOT about the team culture.");
    if (flags.has("buyout_split_unaddressed")) tips.push("Buyout came up but you didn't ask WHO pays. The default is candidate self-funds — but new employer reimbursement is standard at FAANG / GCC and negotiable at most product cos. Ask: 'Is buyout reimbursed, or offset against joining bonus, or candidate-funded?' One question = potentially 1-3 months of gross salary back in your pocket.");
    if (flags.has("hybrid_expectation_mismatch")) tips.push("'Fully remote, never come to office' is a 2025-26 instant misalignment at most Indian GCCs / unicorns — 3-day hybrid is policy at Microsoft India, Walmart Global Tech, Target India, Razorpay, Flipkart, Swiggy. Reframe: 'Open to hybrid — can do 3 in-office days; what's the team's policy?' Even if your floor is 1 in-office day, ask before declaring.");
    if (flags.has("visa_sponsorship_demand_unprompted")) tips.push("Raising H1B / blue-card / onsite sponsorship in an India HR round signals the India seat is a stepping stone. If onsite matters, ask softly about company-wide mobility ('does the team have onsite rotations?' or 'what's the typical path to a US deputation?') — never demand sponsorship in round one. Misalignment with the seat is a screen-out signal.");
    if (flags.has("salary_review_cycle_unprobed")) tips.push("At mid-senior, never accept a comp number without asking about the trajectory. The three questions: 'What's the review cycle — annual or half-yearly? Are off-cycle corrections common? What's the typical promo timeline at this band?' Comp is a curve, not a point — HR scores candidates who treat it that way.");
    if (flags.has("tax_structure_naive")) tips.push("At ₹25L+ in India, the take-home delta between a naive structure and a tax-optimised one is 1-2 LPA. Ask: 'Is there a flexi-basket with 80C max-out, NPS employer contribution (10% extra deduction beyond 1.5L), LTA, meal cards? What's the take-home post all deductions?' This question alone often unlocks structure changes the recruiter wouldn't volunteer.");
    if (flags.has("tier1_college_default_assumption")) tips.push("Don't pre-apologise for your college. 'I know my college isn't IIT' / 'despite my tier-3 background' surfaces a screen the interviewer wasn't going to bring up — and signals internalised bias. Lead with what you've shipped. Pedigree comes up only if asked; if it does, own it with one calm line and pivot back to scope.");
    if (flags.has("dimensions_thin_coverage")) tips.push("Real Indian HR covers 7 dimensions. Re-run with notice/BGV/counter-offer/benefits prompts.");
    if (flags.has("resume_transcript_mismatch")) tips.push("Every employer you say out loud should already be on your resume. BGV pulls the resume as source-of-truth — verbal employers that aren't listed read as fabrication.");
    if (flags.has("resume_gap_unaddressed")) tips.push("Your resume shows a ≥3-month employment gap. Don't wait for the real interviewer to corner you — pre-prep a one-liner: 'between Mar 2022 and Jan 2023 I [studied / cared for family / took a sabbatical to ship X]; here's what I did with the time.'");
    if (flags.has("under_titled_candidate")) tips.push("Your resume has 5+ years of experience but every title reads as plain IC (Software Engineer / Developer). Indian HR anchors comp on title, not scope — retitle to match what you actually own (Senior / Lead) or be ready to walk through scope that exceeds the level on paper. Under-titling costs lakhs at offer time.");
    if (flags.has("inflated_seniority_claim")) tips.push("Your resume reads Senior/Lead/Staff/Principal but your years don't support it yet. Either retitle to match the level you can defend (with scope + ownership stories) or be ready to justify the leap: 'titled Senior because I lead the X module end-to-end since month N — I know that's quick.'");

    /* Indian HR illegally but routinely probes these — especially for
       women candidates (maternity intent, spouse-job, relocation-if-
       husband-transfers). The drill must cover them so candidates can
       practise deflection, not so the analyzer endorses the prompts. */
    const ILLEGAL_PROMPT_RE = /\b(?:caste|religion|mother tongue|marital|married|family.*(?:plan|soon)|are you (?:from|originally)|community|maternity (?:plan|leave|intent)|pregnan|baby plan|when (?:are|do) you plan(?:ning)? (?:to have|on having) (?:a |any )?(?:baby|child|kids)|(?:husband|wife|spouse)(?:'?s)? (?:job|work|company|transfer|location)|relocat.*(?:if|when) (?:husband|wife|spouse))\b/i;
    const touchedIllegal = transcript.some((t) => isAi(t) && ILLEGAL_PROMPT_RE.test(t.text || ""));
    if (touchedIllegal) {
      flags.add("illegal_prompt_used_for_practice");
      tips.push("Note: this session included prompts (marital, caste, religion, origin, family-planning) that are illegal-in-India under Equal Remuneration Act and constitutional non-discrimination — included ONLY to drill deflection. Tempo does not endorse asking them. If a real interviewer asks, deflect warmly: 'I'd prefer to keep the conversation on the role.'");
    }

    /* When rescore dropped a flag, drop its tagged gap too so the report
       stays internally consistent. Untagged gaps (the vast majority —
       all the non-rescore detections) pass through unchanged. */
    result.rubricGaps = gaps.filter((g) => !g.flag || flags.has(g.flag));
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
