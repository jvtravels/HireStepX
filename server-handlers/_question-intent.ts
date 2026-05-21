/* Question-intent classifier (2026-05-21).
 *
 * Audit follow-up — DEBT #1 consolidation. Single source of truth for
 * the coarse bucket label attached to a candidate's off-script question.
 *
 * Lives in its own file so that BOTH `_negotiation-kernel.ts` (which
 * tags TurnDelta.candidateAskedQuestion.intent and writes the
 * answeredQuestionLedger keyed on this bucket) AND `_fact-pack.ts` /
 * `_response-pipeline.ts` (which read the same bucket at request time)
 * can depend on the same function without circular import risk between
 * the kernel and fact-pack modules.
 *
 * Pure. No state, no IO.
 */

/** Coarse intent bucket for a candidate question. Every token that any
 *  of the three pre-consolidation classifiers historically produced is
 *  preserved below — the kernel-side spelling was chosen where the
 *  legacy vocabularies disagreed on the same semantic (e.g. "wfh" over
 *  the older "work-mode"; "perks" over the older "benefits"). */
export type QuestionIntent =
  | "wfh"
  | "team"
  | "reporting"
  | "growth-path"
  | "perf-cycle"
  | "equity"
  | "joining"
  | "perks"
  | "process"
  | "tax"
  | "documents"
  | "clawback"
  | "retention"
  | "bgv"
  | "insurance"
  | "fbp"
  | "pf"
  | "appraisal"
  | "hike"
  | "policy";

/** Pure regex classifier. Order matters — more-specific patterns first
 *  (clawback / retention / appraisal / perf-cycle precede the broader
 *  hike / cycle catch; BGV-process precedes generic document keywords). */
export function classifyQuestionIntent(question: string): QuestionIntent | null {
  const q = (question || "").toLowerCase();
  if (/\bwfh\b|work.from.home|\bremote\b|\bhybrid\b|\boffice\b/.test(q)) return "wfh";
  if (/clawback|prorat/.test(q)) return "clawback";
  if (/retention\s*bonus|\bretention\b/.test(q)) return "retention";
  if (/bgv|background.*verif(?:y|ication)/.test(q)) return "bgv";
  if (/relieving|form.?16|payslip|\bdocument\b/.test(q)) return "documents";
  if (/medical|insurance|floater|esic|parental.*insurance/.test(q)) return "insurance";
  if (/meal\s*voucher|sodexo|\bfbp\b/.test(q)) return "fbp";
  if (/\buan\b|\bpf\b|\bepf\b|provident/.test(q)) return "pf";
  if (/gratuity/.test(q)) return "policy";
  if (/esop|equity|\brsu\b|stock|vesting/.test(q)) return "equity";
  if (/joining|notice|start.*date|when.*join|buyout|last working day/.test(q)) return "joining";
  if (/appraisal|march\s*cycle|hike\s*cycle/.test(q)) return "appraisal";
  if (/perf.*cycle|review.*cycle/.test(q)) return "perf-cycle";
  if (/team.size|how many|team structure|how big|\bteam\b/.test(q)) return "team";
  if (/report|manager|who.*report|reporting to|hierarchy/.test(q)) return "reporting";
  if (/growth|career path|progression/.test(q)) return "growth-path";
  if (/perk|benefit|\bleave\b|wellness/.test(q)) return "perks";
  if (/process|interview|next.*round/.test(q)) return "process";
  if (/tax|87a|deduction|new.regime|old.regime|rebate|regime/.test(q)) return "tax";
  if (/\bhike\b|\braise\b|\bcycle\b/.test(q)) return "hike";
  return null;
}
