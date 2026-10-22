/**
 * Prompt-formatter helpers built on top of the 100-company CSV-extracted
 * salary dataset (`csv-company-role-bands.ts`). Used by:
 *   • `buildSalaryNegotiationGuidance()` in `salary-lookup.ts`
 *     — emits the curated research block (asks, pushback, red flags, rubric).
 *   • `generate-questions.ts`
 *     — emits a smaller focus-tailored block for the other 9 focus areas
 *       (Behavioral, Strategic, Technical Leadership, Case Study, Panel,
 *       Campus, HR Round, Management, Government/PSU) when the (company, role,
 *       level) tuple has a band and the requested focus is supported.
 *
 * Design rules:
 *   - Returns "" on miss — caller concatenates safely.
 *   - All prose comes from the CSV's interned tables (no hand-written
 *     content here) so updates flow from re-running the build script.
 *   - Block is INTENTIONALLY placed in the dynamic section of prompts
 *     (per-call), not the static prefix, since (company × role × level)
 *     varies per session.
 */

import type { ExperienceLevel } from "./salaries";
import {
  getCsvCompanyBand,
  getCsvRoleLevelBand,
  type CsvLevel,
  type CsvRoleBand,
} from "./csv-company-role-bands";

/** Return the CSV's `likelyIndiaLocations` for a company (e.g.
 *  "Bangalore, Hyderabad, Pune"). Empty string when unknown.
 *  Aggregated across roles — first non-empty value wins. */
export function getCsvLikelyLocations(company: string | undefined | null): string {
  if (!company) return "";
  const co = getCsvCompanyBand(company);
  if (!co) return "";
  for (const role of Object.keys(co.roles)) {
    for (const lvl of Object.keys(co.roles[role]) as CsvLevel[]) {
      const band = co.roles[role][lvl];
      if (band && typeof band.likelyIndiaLocations === "string" && band.likelyIndiaLocations.trim()) {
        return band.likelyIndiaLocations.trim();
      }
    }
  }
  return "";
}

/** Return the CSV's `v6PrimaryInterviewFocus` for a (company, role).
 *  Empty when unknown. Tells the LLM what round dominates at this
 *  company for this role (e.g. "System Design" for SDE-Senior at FAANG). */
export function getCsvPrimaryInterviewFocus(
  company: string | undefined | null,
  role: string | undefined | null,
): string {
  if (!company || !role) return "";
  const co = getCsvCompanyBand(company);
  if (!co) return "";
  const roleEntry = co.roles[role];
  const candidate = roleEntry || co.roles[Object.keys(co.roles).find(k => k.toLowerCase().trim() === role.toLowerCase().trim()) || ""];
  if (!candidate) return "";
  for (const lvl of Object.keys(candidate) as CsvLevel[]) {
    const band = candidate[lvl];
    if (band && typeof band.v6PrimaryInterviewFocus === "string" && band.v6PrimaryInterviewFocus.trim()) {
      return band.v6PrimaryInterviewFocus.trim();
    }
  }
  return "";
}

/** Map the app's ExperienceLevel vocabulary to the CSV-dataset CsvLevel
 *  vocabulary. Two-way inexact: the CSV has a "fresher" tier the app
 *  treats as part of "entry"; the app's "executive" maps to the CSV
 *  "manager" tier (closest analogue — CSV does not model board-level). */
export function mapExperienceToCsvLevel(
  exp: ExperienceLevel | string | null | undefined,
): CsvLevel | null {
  switch ((exp || "").toLowerCase()) {
    case "fresher":
    case "entry":
      return "junior";
    case "mid":
      return "mid";
    case "senior":
      return "senior";
    case "lead":
      return "lead";
    case "executive":
      return "manager";
    default:
      return null;
  }
}

/** Try several CsvLevels around the candidate's level, returning the first
 *  band that exists. Lets us fall back from `lead` → `senior` → `mid`
 *  rather than emitting an empty block when the dataset has thinner
 *  coverage at the extremes. */
function findBandWithFallback(
  company: string | undefined | null,
  role: string | undefined | null,
  primary: CsvLevel,
): { band: CsvRoleBand; level: CsvLevel } | null {
  const order: CsvLevel[] =
    primary === "manager"
      ? ["manager", "lead", "senior"]
      : primary === "lead"
        ? ["lead", "senior", "mid"]
        : primary === "senior"
          ? ["senior", "mid"]
          : primary === "mid"
            ? ["mid", "senior", "junior"]
            : primary === "junior"
              ? ["junior", "fresher", "mid"]
              : ["fresher", "junior"];
  for (const lvl of order) {
    const band = getCsvRoleLevelBand(company, role, lvl);
    if (band) return { band, level: lvl };
  }
  return null;
}

function fmtRange(min: number, max: number, unit = "LPA"): string {
  if (!min && !max) return ",";
  if (min === max) return `₹${min} ${unit}`;
  return `₹${min}–${max} ${unit}`;
}

function nonEmpty(s: string | undefined | null): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/**
 * Salary-negotiation context block. Emits the *full* curated research
 * row: numeric ask ladders, walkaway, pushback, candidate best/bad
 * response, rubric, benefits. Designed to slot in between the
 * legacy `companyNegContext` and the dynamic `marketReality` block.
 */
export function formatCsvSalaryNegContext(
  company: string | undefined | null,
  role: string | undefined | null,
  exp: ExperienceLevel | string | null | undefined,
): string {
  const lvl = mapExperienceToCsvLevel(exp);
  if (!lvl) return "";
  const hit = findBandWithFallback(company, role, lvl);
  if (!hit) return "";
  const b = hit.band;

  const lines: string[] = [];
  lines.push(
    `\n\nCURATED COMPANY-ROLE CONTEXT (research-verified, 100-company dataset; level: ${hit.level}${
      hit.level !== lvl ? `, requested: ${lvl}` : ""
    }):`,
  );
  lines.push(
    `- Total CTC band: ${fmtRange(b.totalMinLpa, b.totalMaxLpa)} (median ₹${b.totalMedianLpa} LPA). Fixed: ${fmtRange(
      b.fixedMinLpa,
      b.fixedMaxLpa,
    )}. Bonus/variable: ${fmtRange(b.bonusMinLpa, b.bonusMaxLpa)}. Equity: ${fmtRange(
      b.equityMinLpa,
      b.equityMaxLpa,
    )}/yr. Joining bonus: ${fmtRange(b.joiningBonusMinLpa, b.joiningBonusMaxLpa)}.`,
  );
  if (nonEmpty(b.equityType) || nonEmpty(b.vestingSchedule) || nonEmpty(b.equityLiquidityRisk)) {
    lines.push(
      `- Equity: ${b.equityType || ","}${b.vestingSchedule ? ` · vest ${b.vestingSchedule}` : ""}${
        b.equityLiquidityRisk ? ` · liquidity risk: ${b.equityLiquidityRisk}` : ""
      }.`,
    );
  }
  if (nonEmpty(b.noticePeriod)) {
    lines.push(`- Notice period: ${b.noticePeriod}.`);
  }
  lines.push(
    `- ASK LADDER (LPA): safe ${fmtRange(b.safeAskMinLpa, b.safeAskMaxLpa, "")} · strong ${fmtRange(
      b.strongAskMinLpa,
      b.strongAskMaxLpa,
      "",
    )} · stretch ${fmtRange(b.stretchAskMinLpa, b.stretchAskMaxLpa, "")} · walkaway floor ₹${b.walkawayThresholdLpa} LPA. Counter-offer should land between strong-min and stretch-max; do NOT exceed stretch-max.`,
  );
  if (nonEmpty(b.bestNegotiationFocus)) {
    lines.push(`- Best lever for this row: ${b.bestNegotiationFocus}.`);
  }
  if (nonEmpty(b.likelyHrPushback)) {
    lines.push(`- Likely HR pushback (use this verbatim or paraphrased when candidate stretches): "${b.likelyHrPushback}"`);
  }
  if (nonEmpty(b.hrFollowupQuestion)) {
    lines.push(`- HR follow-up to probe candidate: "${b.hrFollowupQuestion}"`);
  }
  if (b.candidateQuestionsToVerify?.length) {
    lines.push(
      `- Candidate SHOULD ask to verify (coach toward these): ${b.candidateQuestionsToVerify
        .filter(nonEmpty)
        .slice(0, 6)
        .join("; ")}.`,
    );
  }
  if (nonEmpty(b.candidateRedFlags)) {
    lines.push(`- Red flags candidate must surface: ${b.candidateRedFlags}.`);
  }
  if (nonEmpty(b.candidateBestResponse)) {
    lines.push(`- Strong candidate response template: "${b.candidateBestResponse}"`);
  }
  if (nonEmpty(b.candidateBadResponse)) {
    lines.push(`- Weak candidate response (penalize): "${b.candidateBadResponse}"`);
  }
  if (nonEmpty(b.salaryNegotiationRubric)) {
    lines.push(`- Scoring rubric: ${b.salaryNegotiationRubric}`);
  }
  if (nonEmpty(b.benefitsSummary)) {
    lines.push(`- Standard benefits package: ${b.benefitsSummary}.`);
  }
  return lines.join("\n");
}

/** Map app focus / interviewType strings to the CSV's supportedInterviewFocus
 *  vocabulary. Each app focus accepts several CSV labels (the CSV is more
 *  granular). Returns the list of CSV labels that count as a "match". */
function csvFocusLabelsFor(appFocus: string): string[] {
  const f = appFocus.toLowerCase().replace(/[-_/]/g, " ").trim();
  if (/salary|negotiat/.test(f)) return ["Salary Negotiation"];
  if (/hr|culture/.test(f)) return ["HR Round"];
  if (/behavioral|behaviour|star/.test(f)) return ["Behavioral"];
  if (/system design|tech lead|technical leadership/.test(f))
    return ["System Design", "Technical Interview"];
  if (/case|product case|product sense|business/.test(f))
    return ["Case Study", "Product Case", "Product Sense", "Product Sense / Case Study", "Case Study / Domain Interview"];
  if (/panel/.test(f)) return ["Behavioral", "HR Round"];
  if (/campus|fresher/.test(f)) return ["Behavioral", "Coding Round", "Technical Interview"];
  if (/management|leadership/.test(f)) return ["Behavioral", "HR Round"];
  if (/government|psu|govt/.test(f)) return ["Role-specific Interview", "HR Round"];
  if (/strategic|strategy/.test(f)) return ["Product Case", "Case Study", "Growth Strategy", "Case Study / Domain Interview"];
  if (/coding|technical/.test(f)) return ["Coding Round", "Technical Interview"];
  if (/sales/.test(f)) return ["Sales Roleplay", "Objection Handling"];
  if (/design/.test(f)) return ["Portfolio Review", "Design Critique", "Product Thinking"];
  if (/data|sql|analytics|ml/.test(f)) return ["SQL / Analytics", "ML / Data Science"];
  if (/ops|operations/.test(f)) return ["Ops Case", "Operations Scenario Interview", "Execution / Process"];
  if (/marketing|growth|campaign/.test(f)) return ["Campaign Case", "Growth Strategy"];
  if (/customer|cs|support/.test(f)) return ["Customer Scenario", "Communication Round"];
  return ["Behavioral"]; // safe default
}

/**
 * Focus-area context block (for the 9 non-salary focus areas). Smaller
 * than the salary block — only emits fields that ground question-
 * generation: company type, role family, locations, primary focus,
 * pushback / red flags / rubric scaffolding the LLM can hang STAR
 * questions off, and a short benefits summary for HR-round style asks.
 *
 * Empty string when:
 *   • no (company, role, level) match, OR
 *   • the requested focus isn't in `supportedInterviewFocus` for this row
 *     (CSV signals "we don't have curated guidance for this combination").
 */
export function formatCsvFocusContext(
  company: string | undefined | null,
  role: string | undefined | null,
  exp: ExperienceLevel | string | null | undefined,
  appFocus: string,
): string {
  const lvl = mapExperienceToCsvLevel(exp);
  if (!lvl) return "";
  const hit = findBandWithFallback(company, role, lvl);
  if (!hit) return "";
  const b = hit.band;

  const wanted = csvFocusLabelsFor(appFocus);
  const supported = b.supportedInterviewFocus ?? [];
  const intersects = wanted.some(w => supported.includes(w));
  if (!intersects && wanted[0] !== "Behavioral") {
    // Only suppress when we have specific evidence of mismatch; if the
    // request defaults to Behavioral, always emit (Behavioral is universal).
    return "";
  }

  const lines: string[] = [];
  lines.push(
    `\n\nCURATED COMPANY-ROLE GROUNDING (research-verified, 100-company dataset; level: ${hit.level}):`,
  );
  if (nonEmpty(b.companyType) || nonEmpty(b.roleFamily)) {
    lines.push(
      `- Company type: ${b.companyType || ","}. Role family: ${b.roleFamily || ","}${
        nonEmpty(b.roleSubfamily) ? ` · ${b.roleSubfamily}` : ""
      }.`,
    );
  }
  if (nonEmpty(b.likelyIndiaLocations)) {
    lines.push(`- Likely India locations: ${b.likelyIndiaLocations}.`);
  }
  if (nonEmpty(b.experienceRange)) {
    lines.push(`- Typical experience for this level at this company: ${b.experienceRange}.`);
  }
  if (nonEmpty(b.v6PrimaryInterviewFocus)) {
    lines.push(`- Primary interview focus the company emphasizes for this role: ${b.v6PrimaryInterviewFocus}.`);
  }
  if (supported.length) {
    lines.push(`- Curated rounds available: ${supported.join(", ")}.`);
  }
  // HR-round / management / behavioral all benefit from benefits + pushback context.
  const isHrish = /hr|behavioral|management|panel|campus|government|psu/i.test(appFocus);
  if (isHrish && nonEmpty(b.benefitsSummary)) {
    lines.push(`- Benefits the candidate may ask about: ${b.benefitsSummary}.`);
  }
  if (isHrish && nonEmpty(b.likelyHrPushback)) {
    lines.push(`- Common HR posture: "${b.likelyHrPushback}"`);
  }
  if (nonEmpty(b.candidateRedFlags)) {
    lines.push(`- Watch for these candidate red flags: ${b.candidateRedFlags}.`);
  }
  if (nonEmpty(b.salaryNegotiationRubric) && /salary|hr|management/.test(appFocus.toLowerCase())) {
    lines.push(`- Compensation-discussion rubric (apply if the candidate raises pay): ${b.salaryNegotiationRubric}`);
  }
  return lines.join("\n");
}
