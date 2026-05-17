/* Credibility-callout — pure logic.
 *
 * The Wave-7/8.x resume cross-checks (campus-placement analyzer) fire
 * high-severity flags that the candidate genuinely needs to see, because
 * each one mirrors what Indian BGV teams cross-check against the offer
 * letter / transcript / degree certificate. Today these flags surface
 * inside the generic rubric-gap list, which buries them next to filler-
 * word warnings. This helper extracts the credibility-dimension subset
 * into a dedicated, named bucket so the report can render them in a
 * standalone callout.
 *
 * Pure — no React, no fetch. The fetch lives in `dashboardData.ts`
 * (`fetchSessionCredibility`); the render lives in `SessionReportView`.
 *
 * NOTE: kept analyzer-agnostic on purpose. Today every member of the
 * credibility set comes from the campus-placement analyzer, but the
 * same shape will absorb future hr-round / behavioral resume cross-
 * checks without a schema change.
 */

import { friendlyFlag } from "./qualityFlagDictionary";

/** Flags that belong in the credibility callout — every entry here is
 *  a BGV-checkable mismatch between what the candidate said and what
 *  the resume claims. Order is the rendering order in the callout. */
export const CREDIBILITY_FLAGS = [
  "claimed_internship_not_in_resume",
  "branch_mismatch_with_resume",
  "grad_year_mismatch_with_resume",
  "college_mismatch_with_resume",
  "cgpa_mismatch_with_resume",
  "internship_duration_mismatch_with_resume",
] as const;

export type CredibilityFlag = (typeof CREDIBILITY_FLAGS)[number];

const FLAG_SET = new Set<string>(CREDIBILITY_FLAGS);

/** Hand-curated one-liner the candidate should DO after the session.
 *  Distinct from the analyzer's longer coaching tip (which goes into
 *  `coaching_notes` and the rubric gap's `expected` field). Short
 *  enough to render as a single line under the headline. */
const ACTION_FOR_FLAG: Record<CredibilityFlag, string> = {
  claimed_internship_not_in_resume:
    "Add this company to your resume before the next interview — BGV will pull the resume, not the transcript.",
  branch_mismatch_with_resume:
    "Use the exact branch on your degree certificate every time. If it's a dual-degree / minor, say so once.",
  grad_year_mismatch_with_resume:
    "State the year on your provisional / final degree, even if you had an extended semester. Drift > 1 year reads as fabrication.",
  college_mismatch_with_resume:
    "Name the exact college on your resume. Tier-1 acronym swaps (IIT vs NIT) are an instant disqualifier in campus BGV.",
  cgpa_mismatch_with_resume:
    "Quote the CGPA on your transcript. If a recent semester moved the average, say so explicitly — don't round up.",
  internship_duration_mismatch_with_resume:
    "Match the exact dates on your relieving / offer letter. If you extended, frame it cleanly — don't round 3 months up to 'six'.",
};

export interface CredibilityItem {
  /** Raw flag code — e.g. "cgpa_mismatch_with_resume". */
  flag: CredibilityFlag;
  /** Headline copy (from qualityFlagDictionary). */
  label: string;
  /** Longer description (from qualityFlagDictionary). */
  description: string;
  /** Concrete action the candidate takes before the next round. */
  action: string;
  /** Verbatim observed-vs-expected detail from the analyzer's
   *  rubric_gaps entry, when one paired up. Undefined when only the
   *  flag fired (analyzer didn't push a rubric gap alongside). */
  evidence?: { observed: string; expected: string };
}

export interface CredibilitySummary {
  /** True when at least one credibility flag fired. The view should
   *  hide the entire callout when this is false. */
  hasIssues: boolean;
  /** Items in render order — already deduped + ordered per
   *  `CREDIBILITY_FLAGS`. Empty array when `hasIssues` is false. */
  items: CredibilityItem[];
  /** Count — convenience for the headline badge. */
  count: number;
}

/** Minimal shape of the `session_insights` row this helper reads.
 *  Only the two columns we actually use — kept narrow so the fetcher
 *  in `dashboardData.ts` can `select("flags, rubric_gaps")` and not
 *  pay for the full row. */
export interface SessionInsightsRowForCredibility {
  flags?: string[] | null;
  rubric_gaps?: unknown;
}

interface RubricGapShape {
  dimension?: unknown;
  expected?: unknown;
  observed?: unknown;
}

/** Filter a session_insights row down to its credibility surface.
 *  Safe to call with `null` / `undefined` / a row that has no
 *  credibility flags — returns `{ hasIssues: false, items: [], count: 0 }`. */
export function summarizeCredibility(
  row: SessionInsightsRowForCredibility | null | undefined,
): CredibilitySummary {
  const empty: CredibilitySummary = { hasIssues: false, items: [], count: 0 };
  if (!row) return empty;

  const rawFlags = Array.isArray(row.flags) ? row.flags : [];
  const credFlags = rawFlags.filter((f): f is CredibilityFlag => FLAG_SET.has(f));
  if (credFlags.length === 0) return empty;

  // Build a quick lookup of the FIRST credibility-dimension rubric gap
  // whose expected/observed text contains the flag's keyword. The
  // analyzer doesn't tag gaps with a flag code directly, so we match
  // heuristically on the dimension + content. Imperfect but better
  // than nothing — falls back to no evidence when nothing pairs.
  const rubricGaps: RubricGapShape[] = Array.isArray(row.rubric_gaps)
    ? (row.rubric_gaps as RubricGapShape[]).filter(
        (g) => g && typeof g === "object" && (g as RubricGapShape).dimension === "credibility",
      )
    : [];
  // Per-flag regex matched against the analyzer's gap text. The
  // rubric_gap entries don't carry a flag code, so we match heuristically
  // on a substring known to appear in the analyzer's `expected` /
  // `observed` strings for each flag. Centralized — a Wave-9 flag
  // addition is a one-line entry.
  const FLAG_GAP_KEYWORD: Record<CredibilityFlag, RegExp> = {
    claimed_internship_not_in_resume: /company|companies|uploaded resume|not present/i,
    branch_mismatch_with_resume: /branch/i,
    grad_year_mismatch_with_resume: /graduation year|graduated/i,
    college_mismatch_with_resume: /college|nit|iit|iiit|bits/i,
    cgpa_mismatch_with_resume: /cgpa/i,
    internship_duration_mismatch_with_resume: /duration|months|years|drift/i,
  };
  const evidenceForFlag = (flag: CredibilityFlag): CredibilityItem["evidence"] => {
    const rx = FLAG_GAP_KEYWORD[flag];
    const hit = rubricGaps.find((g) => {
      const blob = `${String(g.expected ?? "")} ${String(g.observed ?? "")}`;
      return rx.test(blob);
    });
    if (!hit) return undefined;
    return {
      observed: String(hit.observed ?? "").slice(0, 400),
      expected: String(hit.expected ?? "").slice(0, 400),
    };
  };

  // Render in the canonical CREDIBILITY_FLAGS order, deduped, only
  // including those that actually fired.
  const seen = new Set<string>();
  const items: CredibilityItem[] = [];
  for (const flag of CREDIBILITY_FLAGS) {
    if (!credFlags.includes(flag) || seen.has(flag)) continue;
    seen.add(flag);
    const friendly = friendlyFlag(flag);
    items.push({
      flag,
      label: friendly.label,
      description: friendly.description,
      action: ACTION_FOR_FLAG[flag],
      evidence: evidenceForFlag(flag),
    });
  }

  return { hasIssues: items.length > 0, items, count: items.length };
}
