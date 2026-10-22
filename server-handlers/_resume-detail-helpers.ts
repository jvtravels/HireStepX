/* Normalizes the two StoredResume shapes (see src/resumeParser.ts) into one
   shape the employer candidate-detail screen can render without caring which
   parser produced it. "ai" resumes (src/dashboardData.ts ResumeProfile) carry
   `topSkills`; "fallback" regex-parsed resumes (ParsedResume) carry `skills` —
   same duck-typing check server-handlers/_requirement-match-helpers.ts
   already uses to tell them apart. */

export interface ResumeExperienceEntry {
  title: string;
  company: string;
  period: string;
  // Present only when the resume carried them. AI resumes give scope, team
  // size, partners and top projects; regex-parsed resumes give raw bullets.
  scope?: string;
  teamSize?: number;
  partners?: string[];
  topProjects?: string[];
  bullets?: string[];
}

export interface ResumeSkillEntry {
  name: string;
  depth: "primary" | "secondary" | "exposure";
  yearsUsed?: number;
  recent?: boolean;
}

export interface ResumeEducationEntry {
  degree: string;
  school: string;
  year: string;
}

export interface ResumeDomainYears {
  domain: string;
  years: number;
}

export interface ResumeDetail {
  summary: string;
  headline: string | null;
  seniorityLevel: string | null;
  yearsExperience: number | null;
  keyAchievements: string[];
  industries: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  certifications: string[];
  // AI-resume only; coaching fields (interviewGaps, improvements, scores) are
  // deliberately never copied across, they are advice to the candidate.
  careerTrajectory: string | null;
  promotionSignals: string[];
  primaryDomain: string | null;
  domainYears: ResumeDomainYears[];
  // What the resume shows they will do well in an interview. The mirror
  // image (interviewGaps) is coaching and stays withheld.
  interviewStrengths: string[];
  skillsDetailed: ResumeSkillEntry[];
  linkedin: string | null;
  phone: string | null;
  // Self-reported on the resume text, not verified — render with that caveat.
  noticePeriod: string | null;
  currentCtc: string | null;
  // Only ever entered by the candidate, and shown after an unlock.
  expectedCtc: string | null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** AI-written summaries/achievements are free text and routinely open with
 *  the candidate's full name ("Shaik Rukiyabi is an enthusiastic..."), which
 *  defeats the "Candidate #xxxxx" masking the moment an employer reads the
 *  bio. Strips every occurrence of the candidate's first/last name tokens
 *  (name parts of length > 1, to skip bare initials) case-insensitively,
 *  word-bounded so it doesn't gut unrelated substrings. */
function scrubName(text: string, fullName: string): string {
  if (!text) return text;
  // Split on anything that is not a letter or digit: "A.Jaleel" or "Jaleel." never match as whole words.
  const parts = fullName.split(/[^\p{L}\p{M}\p{N}]+/u).filter((p) => p.length > 1);
  if (parts.length === 0) return text;
  let out = text;
  for (const part of parts) {
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{M}\\p{N}])`, "giu"), "The candidate");
  }
  // Collapse repeats left behind when first+last name both matched back to back.
  return out.replace(/(The candidate)(\s+\1)+/gi, "$1");
}

/** Placeholder for an employer, school or project name taken out of free text. */
const ENTITY_PLACEHOLDER = "[withheld]";
// Shorter names ("EY", "HP") would match inside ordinary words.
const MIN_ENTITY_NAME_LEN = 3;

/** Employer, school, partner and project names are the strongest way to work
 *  out who a locked candidate is (a CV lists a handful of them, and the
 *  employer can search for the person). They are also written into the
 *  AI-generated prose, so the names from the structured fields are scrubbed
 *  from the free text too. Whole-word, case-insensitive. */
const CORPORATE_SUFFIX_RE = /[\s,]+(?:pvt\.?|private|ltd\.?|limited|inc\.?|llp|llc|corp(?:oration)?|co\.?|technologies|technology|solutions|services|systems|labs|software|india|global)\.?$/i;

/** The forms a CV and its AI summary use for one employer: "Infosys Ltd" is
 *  written "Infosys", "Tata Consultancy Services" is written "TCS". */
function entityAliases(name: string): string[] {
  const out: string[] = [];
  let base = name;
  while (CORPORATE_SUFFIX_RE.test(base)) base = base.replace(CORPORATE_SUFFIX_RE, "").trim();
  if (base !== name && base.length >= MIN_ENTITY_NAME_LEN) out.push(base);
  for (const form of new Set([name, base])) {
    const words = form.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
    if (words.length >= 3) out.push(words.map((w) => w[0].toUpperCase()).join(""));
  }
  return out;
}

const MONTH_WORD_RE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?,?\s*/gi;

/** "Jan 2020 – Mar 2022" and "03/2020" narrow a person down far more than the
 *  year does; a locked candidate keeps the year and nothing finer. */
export function coarsenPeriod(period: string): string {
  return period
    .replace(/\b\d{1,2}[/.-](?=\d{4}\b)/g, "")
    .replace(MONTH_WORD_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lockedEntityNames(detail: ResumeDetail): string[] {
  const names = new Set<string>();
  const add = (v: string | undefined) => {
    const t = (v ?? "").trim();
    if (t.length < MIN_ENTITY_NAME_LEN) return;
    names.add(t);
    for (const alias of entityAliases(t)) names.add(alias);
  };
  for (const e of detail.experience) {
    add(e.company);
    e.partners?.forEach(add);
    e.topProjects?.forEach(add);
  }
  for (const ed of detail.education) add(ed.school);
  return [...names].sort((a, b) => b.length - a.length);
}

function scrubEntities(text: string, names: string[]): string {
  let out = text;
  for (const n of names) out = out.replace(new RegExp(`(?<![\\w])${escapeRegExp(n)}(?![\\w])`, "gi"), ENTITY_PLACEHOLDER);
  return out;
}

/** Locking a candidate hides who they are and how to reach them: their name
    (including inside the AI-written free text, which routinely opens with
    "<Full Name> is a ...") plus phone and LinkedIn, and every name that could
    identify them by search: employers, schools, partners, projects and the
    bullets that describe them. Role titles, tenure, degree level, scope and
    team size stay, so the employer can still judge fit before paying.
    `realName` is the candidate's actual name, known only server-side. */
export function redactResumeDetailForLock(detail: ResumeDetail, realName: string): ResumeDetail {
  const entities = lockedEntityNames(detail);
  const clean = (t: string) => scrubEntities(scrubName(t, realName), entities);
  return {
    ...detail,
    summary: clean(detail.summary),
    headline: detail.headline ? clean(detail.headline) : detail.headline,
    keyAchievements: detail.keyAchievements.map(clean),
    certifications: detail.certifications.map((c) => scrubName(c, realName)),
    careerTrajectory: detail.careerTrajectory ? clean(detail.careerTrajectory) : detail.careerTrajectory,
    promotionSignals: detail.promotionSignals.map(clean),
    interviewStrengths: detail.interviewStrengths.map(clean),
    experience: detail.experience.map((e) => ({
      title: clean(e.title),
      company: "",
      period: coarsenPeriod(e.period),
      ...(e.scope ? { scope: clean(e.scope) } : {}),
      ...(e.teamSize !== undefined ? { teamSize: e.teamSize } : {}),
    })),
    education: detail.education.map((ed) => ({ ...ed, school: "" })),
    linkedin: null,
    phone: null,
  };
}

/** Only these large metros are shown for a locked candidate: a free-text
 *  locality or a small town, combined with a role and tenure, narrows a person
 *  down far more than the city filter is worth. */
const LOCKED_VISIBLE_CITIES: ReadonlySet<string> = new Set([
  "bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "delhi ncr", "gurgaon", "gurugram",
  "noida", "hyderabad", "pune", "chennai", "kolkata", "ahmedabad",
]);

export function coarsenLockedCity(city: string): string {
  return LOCKED_VISIBLE_CITIES.has(city.trim().toLowerCase()) ? city : "";
}

function extractDomainYears(v: unknown): ResumeDomainYears[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const out: ResumeDomainYears[] = [];
  for (const [domain, years] of Object.entries(v as Record<string, unknown>)) {
    const name = domain.trim();
    if (name && typeof years === "number" && years > 0) out.push({ domain: name, years });
  }
  return out.sort((a, b) => b.years - a.years).slice(0, MAX_BULLETS);
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

const MAX_BULLETS = 5;
const SKILL_DEPTHS: ReadonlySet<string> = new Set(["primary", "secondary", "exposure"]);

function nonEmpty(list: string[], max: number): string[] {
  return list.map((t) => t.trim()).filter(Boolean).slice(0, max);
}

function extractSkillsDetailed(v: unknown): ResumeSkillEntry[] {
  if (!Array.isArray(v)) return [];
  const out: ResumeSkillEntry[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const name = asString(e.name);
    if (!name) continue;
    const depth = typeof e.depth === "string" && SKILL_DEPTHS.has(e.depth) ? (e.depth as ResumeSkillEntry["depth"]) : "secondary";
    const entry: ResumeSkillEntry = { name: name.trim(), depth };
    if (typeof e.yearsUsed === "number" && e.yearsUsed > 0) entry.yearsUsed = e.yearsUsed;
    if (e.recent === true) entry.recent = true;
    out.push(entry);
  }
  return out;
}

/** Only adds a key when the resume actually carried it, so entries from
 *  older resumes stay as small as before. */
function experienceExtras(e: Record<string, unknown>): Partial<ResumeExperienceEntry> {
  const out: Partial<ResumeExperienceEntry> = {};
  const scope = asString(e.scope);
  if (scope) out.scope = scope.trim();
  if (typeof e.teamSize === "number" && e.teamSize > 0) out.teamSize = e.teamSize;
  const partners = nonEmpty(asStringArray(e.partners), MAX_BULLETS);
  if (partners.length) out.partners = partners;
  const projects = nonEmpty(asStringArray(e.topProjects), MAX_BULLETS);
  if (projects.length) out.topProjects = projects;
  const bullets = nonEmpty(asStringArray(e.bullets), MAX_BULLETS);
  if (bullets.length) out.bullets = bullets;
  return out;
}

export function extractResumeDetail(resumeData: unknown): ResumeDetail {
  const empty: ResumeDetail = {
    summary: "",
    headline: null,
    seniorityLevel: null,
    yearsExperience: null,
    keyAchievements: [],
    industries: [],
    experience: [],
    education: [],
    certifications: [],
    careerTrajectory: null,
    promotionSignals: [],
    primaryDomain: null,
    domainYears: [],
    interviewStrengths: [],
    skillsDetailed: [],
    linkedin: null,
    phone: null,
    noticePeriod: null,
    currentCtc: null,
    expectedCtc: null,
  };
  if (!resumeData || typeof resumeData !== "object") return empty;
  const r = resumeData as Record<string, unknown>;

  const isAi = Array.isArray(r.topSkills);

  if (isAi) {
    const experiences = Array.isArray(r.experiences) ? r.experiences : [];
    return {
      ...empty,
      summary: asString(r.summary) || "",
      linkedin: asString(r.linkedin),
      phone: asString(r.phone),
      headline: asString(r.headline),
      seniorityLevel: asString(r.seniorityLevel),
      yearsExperience: typeof r.yearsExperience === "number" ? r.yearsExperience : null,
      keyAchievements: asStringArray(r.keyAchievements),
      industries: asStringArray(r.industries),
      experience: experiences
        .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
        .map((e) => ({
          title: asString(e.title) || "",
          company: asString(e.company) || "",
          period: [asString(e.start), asString(e.end)].filter(Boolean).join(" – "),
          ...experienceExtras(e),
        })),
      careerTrajectory: asString(r.careerTrajectory),
      promotionSignals: nonEmpty(asStringArray(r.promotionSignals), MAX_BULLETS),
      primaryDomain: asString(r.primaryDomain),
      domainYears: extractDomainYears(r.domainYearsExperience),
      interviewStrengths: nonEmpty(asStringArray(r.interviewStrengths), MAX_BULLETS),
      skillsDetailed: extractSkillsDetailed(r.skillsDetailed),
      noticePeriod: asString(r.noticePeriod),
      currentCtc: asString(r.currentCtc),
      expectedCtc: asString(r.expectedCtc),
    };
  }

  const experience = Array.isArray(r.experience) ? r.experience : [];
  const education = Array.isArray(r.education) ? r.education : [];
  return {
    ...empty,
    summary: asString(r.summary) || "",
    linkedin: asString(r.linkedin),
    phone: asString(r.phone),
    experience: experience
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => ({
        title: asString(e.title) || "",
        company: asString(e.company) || "",
        period: asString(e.period) || "",
        ...experienceExtras(e),
      })),
    education: education
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .map((e) => ({
        degree: asString(e.degree) || "",
        school: asString(e.school) || "",
        year: asString(e.year) || "",
      }))
      .filter((e) => e.degree || e.school),
    certifications: asStringArray(r.certifications),
  };
}
