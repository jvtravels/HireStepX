/* Client logic for the "import from a job description" panel: reading the file,
   calling the parse endpoint, and deciding which extracted fields fill the form
   straight away and which are only offered as suggestions. Pure where it can be. */

import type { JdConfidence, JdField, JdFieldKey, JdFields, JdParseResponse } from "../../data/jd-extraction";
import { JD_MAX_FILE_BYTES, JD_MAX_TEXT_CHARS, JD_MIN_TEXT_CHARS } from "../../data/jd-extraction";
import { apiFetch } from "../apiClient";
import { needsDuration } from "./_requirementFormHelpers";
import type { RequirementDraft } from "./_requirementPayload";

export const JD_ACCEPT = ".pdf,.docx,.txt";

export const JD_LABELS: Record<JdFieldKey, string> = {
  title: "Job title", department: "Department", locations: "Location", workMode: "Work mode",
  employmentType: "Employment type", experience: "Experience", salary: "Salary", openPositions: "Open positions",
  noticePeriodPref: "Notice period", skills: "Skills", responsibilities: "Responsibilities", niceToHave: "Nice to have",
  preferredIndustry: "Preferred industry", preferredColleges: "Preferred colleges", targetCompanies: "Target companies",
  perksAndBenefits: "Perks and benefits", workSchedule: "Work schedule", durationWeeks: "Duration (weeks)",
  hoursPerWeek: "Hours per week", description: "Description",
};

const DISPLAY_ORDER: readonly JdFieldKey[] = [
  "title", "department", "employmentType", "workMode", "locations", "openPositions", "experience", "salary",
  "noticePeriodPref", "skills", "responsibilities", "niceToHave", "durationWeeks", "hoursPerWeek", "preferredIndustry",
  "preferredColleges", "targetCompanies", "perksAndBenefits", "workSchedule", "description",
];

/** Draft keys each extracted field writes to. */
const DRAFT_KEYS: Record<JdFieldKey, ReadonlyArray<keyof RequirementDraft>> = {
  title: ["title"], department: ["department"], locations: ["locations"], workMode: ["workMode"],
  employmentType: ["employmentType"], experience: ["experienceMin", "experienceMax"],
  salary: ["salaryType", "budgetMin", "budgetMax"], openPositions: ["openPositions"], noticePeriodPref: ["noticePeriodPref"],
  skills: ["skills"], responsibilities: ["responsibilities"], niceToHave: ["niceToHave"], preferredIndustry: ["preferredIndustry"],
  preferredColleges: ["preferredColleges"], targetCompanies: ["targetCompanies"], perksAndBenefits: ["perksAndBenefits"],
  workSchedule: ["workSchedule"], durationWeeks: ["durationWeeks"], hoursPerWeek: ["hoursPerWeek"], description: ["description"],
};

/** Fields whose form default is a real choice, so "untouched" means equal to the initial draft. */
const ENUM_KEYS: ReadonlySet<JdFieldKey> = new Set<JdFieldKey>(["workMode", "employmentType", "noticePeriodPref", "openPositions"]);

const LIST_KEYS: ReadonlySet<JdFieldKey> = new Set<JdFieldKey>(["locations", "skills", "preferredColleges", "targetCompanies", "perksAndBenefits"]);

export type ImportStatus = "applied" | "suggested";
export type SuggestReason = "low-confidence" | "already-filled";

export interface ReviewItem {
  key: JdFieldKey;
  label: string;
  status: ImportStatus;
  reason?: SuggestReason;
  confidence: JdConfidence;
  evidence: string;
  display: string;
  patch: Partial<RequirementDraft>;
}

type Draftish = Partial<RequirementDraft>;

const str = (n: number | null): string => (n === null ? "" : String(n));

/** Converts an extracted field to the string-typed draft values the form edits. */
export function patchFor<K extends JdFieldKey>(key: K, field: JdFields[K], draft: RequirementDraft, mergeLists: boolean): Draftish {
  if (!field) return {};
  const value: unknown = field.value;
  switch (key) {
    case "experience": {
      const v = field.value as { min: number | null; max: number | null };
      const p: Draftish = {};
      if (v.min !== null) p.experienceMin = str(v.min);
      if (v.max !== null) p.experienceMax = str(v.max);
      else if (v.min !== null && draft.experienceMax !== "" && Number(draft.experienceMax) < v.min) p.experienceMax = "";
      return p;
    }
    case "salary": {
      const v = field.value as { type: RequirementDraft["salaryType"]; min: number | null; max: number | null };
      return { salaryType: v.type, budgetMin: str(v.min), budgetMax: str(v.max) };
    }
    case "openPositions":
    case "durationWeeks":
    case "hoursPerWeek":
      return { [key]: String(value) } as Draftish;
    default:
      if (LIST_KEYS.has(key) && Array.isArray(value)) {
        const incoming = value.filter((x): x is string => typeof x === "string");
        const current = (draft[key as "locations" | "skills" | "preferredColleges" | "targetCompanies" | "perksAndBenefits"] ?? []) as string[];
        if (!mergeLists) return { [key]: incoming } as Draftish;
        const seen = new Set(current.map((c) => c.toLowerCase()));
        return { [key]: [...current, ...incoming.filter((i) => !seen.has(i.toLowerCase()))] } as Draftish;
      }
      return { [key]: value } as Draftish;
  }
}

const rupees = (n: number): string => n.toLocaleString("en-IN");

export function displayValue(key: JdFieldKey, field: JdField<unknown>): string {
  const v = field.value;
  switch (key) {
    case "experience": {
      const e = v as { min: number | null; max: number | null };
      if (e.min !== null && e.max !== null) return e.min === e.max ? `${e.min} years` : `${e.min} to ${e.max} years`;
      if (e.min !== null) return `${e.min}+ years`;
      return e.max !== null ? `Up to ${e.max} years` : "";
    }
    case "salary": {
      const s = v as { type: "per-annum" | "per-month" | "fixed"; min: number | null; max: number | null };
      const fmt = (n: number) => (s.type === "per-annum" ? String(n) : rupees(n));
      const unit = s.type === "per-annum" ? " LPA" : s.type === "per-month" ? " per month" : " fixed";
      const lo = s.min === null ? null : fmt(s.min);
      const hi = s.max === null ? null : fmt(s.max);
      const body = lo && hi ? (lo === hi ? lo : `${lo} to ${hi}`) : lo ? `From ${lo}` : hi ? `Up to ${hi}` : "";
      return body ? `₹${body}${unit}` : "";
    }
    case "workMode":
      return v === "onsite" ? "Onsite" : v === "hybrid" ? "Hybrid" : "Remote";
    case "employmentType":
      return typeof v === "string" ? v.replace(/^./, (c) => c.toUpperCase()) : "";
    case "description":
      return `Full job description text (${String(v).length.toLocaleString("en-IN")} characters)`;
    case "durationWeeks":
      return `${String(v)} weeks`;
    case "hoursPerWeek":
      return `${String(v)} hours`;
    default:
      if (Array.isArray(v)) return v.join(", ");
      return typeof v === "string" ? (v.length > 220 ? `${v.slice(0, 220).trimEnd()}…` : v) : String(v);
  }
}

function slice(draft: RequirementDraft, keys: ReadonlyArray<keyof RequirementDraft>): string {
  return JSON.stringify(keys.map((k) => draft[k]));
}

/** What the form shows for these fields right now; used to detect later edits. */
export function draftSignature(key: JdFieldKey, draft: RequirementDraft): string {
  return slice(draft, DRAFT_KEYS[key]);
}

function isBlank(key: JdFieldKey, draft: RequirementDraft, baseline: RequirementDraft): boolean {
  const keys = DRAFT_KEYS[key];
  if (ENUM_KEYS.has(key)) return slice(draft, keys) === slice(baseline, keys);
  if (key === "salary") return draft.budgetMin.trim() === "" && draft.budgetMax.trim() === "";
  return keys.every((k) => {
    const v = draft[k];
    return Array.isArray(v) ? v.length === 0 : typeof v === "string" ? v.trim() === "" : v === baseline[k];
  });
}

export interface ImportPlan {
  items: ReviewItem[];
  /** Combined patch for everything applied straight away. */
  applyNow: Draftish;
}

/** Splits extracted fields into those applied now (blank form field, not low
 *  confidence) and those left as suggestions the employer applies one by one. */
export function planImport(
  fields: JdFields,
  draft: RequirementDraft,
  baseline: RequirementDraft,
): ImportPlan {
  const items: ReviewItem[] = [];
  let applyNow: Draftish = {};
  const employmentType = (fields.employmentType?.value ?? draft.employmentType) as RequirementDraft["employmentType"];
  for (const key of DISPLAY_ORDER) {
    const field = fields[key];
    if (!field) continue;
    if ((key === "durationWeeks" || key === "hoursPerWeek") && !needsDuration(employmentType)) continue;
    const display = displayValue(key, field);
    if (!display) continue;
    const blank = isBlank(key, draft, baseline);
    const applyCandidate = blank && field.confidence !== "low";
    const patch = patchFor(key, fields[key], draft, !applyCandidate);
    const item: ReviewItem = {
      key, label: JD_LABELS[key], confidence: field.confidence, evidence: field.evidence, display, patch,
      status: applyCandidate ? "applied" : "suggested",
      ...(applyCandidate ? {} : { reason: blank ? "low-confidence" as const : "already-filled" as const }),
    };
    if (applyCandidate) applyNow = { ...applyNow, ...patch };
    items.push(item);
  }
  return { items, applyNow };
}

/** The draft values that a patch would overwrite, so an undo can put them back. */
export function snapshotFor(draft: RequirementDraft, patch: Draftish): Draftish {
  const prev: Draftish = {};
  for (const k of Object.keys(patch) as Array<keyof RequirementDraft>) {
    (prev as Record<string, unknown>)[k] = draft[k];
  }
  return prev;
}

/** After submit: how many of the imported fields survived unchanged. */
export function outcomeCounts(imported: Record<string, string>, draft: RequirementDraft): { kept: number; edited: number } {
  let kept = 0;
  let edited = 0;
  for (const [key, sig] of Object.entries(imported)) {
    if (draftSignature(key as JdFieldKey, draft) === sig) kept++;
    else edited++;
  }
  return { kept, edited };
}

/* ── File and network ── */

export function checkJdFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!/\.(pdf|docx|txt)$/.test(name)) {
    return name.endsWith(".doc") ? "Old .doc files are not supported. Save it as .docx or PDF and try again." : "Upload a PDF, DOCX or TXT file.";
  }
  if (file.size > JD_MAX_FILE_BYTES) return "That file is over 5 MB. Upload a smaller file or paste the text.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export async function readJdFile(file: File): Promise<string> {
  const problem = checkJdFile(file);
  if (problem) throw new Error(problem);
  const { extractResumeText } = await import("../resumeParser");
  try {
    const text = await extractResumeText(file);
    return text.slice(0, JD_MAX_TEXT_CHARS);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/scanned|no extractable text|very little text/i.test(msg)) {
      throw new Error("We could not read text from that PDF. It may be a scan. Upload a text-based PDF or DOCX, or paste the text.");
    }
    throw new Error(msg.replace(/resume/gi, "job description") || "We could not read that file. Try pasting the text instead.");
  }
}

export type ParseOutcome =
  | { ok: true; data: JdParseResponse }
  | { ok: false; error: string; limitReached: boolean };

export async function requestJdParse(text: string, signal?: AbortSignal): Promise<ParseOutcome> {
  if (text.trim().length < JD_MIN_TEXT_CHARS) {
    return { ok: false, error: "That is too short to be a job description. Paste the full text.", limitReached: false };
  }
  const res = await apiFetch<JdParseResponse>("/api/employer-parse-jd", { text: text.slice(0, JD_MAX_TEXT_CHARS) }, { signal, timeoutMs: 65000 });
  if (res.ok && res.data && typeof res.data === "object" && res.data.ok === true) return { ok: true, data: res.data };
  const limitReached = res.status === 429 && (res.errorData as { limitReached?: boolean } | null)?.limitReached === true;
  if (res.status === 0) return { ok: false, error: "Could not reach the server. Check your connection and try again.", limitReached: false };
  if (res.status === 429 && !limitReached) return { ok: false, error: "Too many attempts. Wait a minute and try again.", limitReached: false };
  return { ok: false, error: res.error ?? "Could not read that job description. Try again.", limitReached };
}
