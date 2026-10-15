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
  skillsDetailed: ResumeSkillEntry[];
  linkedin: string | null;
  phone: string | null;
  // Self-reported on the resume text, not verified — render with that caveat.
  noticePeriod: string | null;
  currentCtc: string | null;
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
  const parts = fullName.trim().split(/\s+/).filter((p) => p.length > 1);
  if (parts.length === 0) return text;
  let out = text;
  for (const part of parts) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, "gi"), "The candidate");
  }
  // Collapse repeats left behind when first+last name both matched back to back.
  return out.replace(/(The candidate)(\s+\1)+/gi, "$1");
}

/** Locking a candidate hides only their contact details and identity —
    summary, headline, achievements, certifications, seniority, industries,
    and self-reported notice period / CTC all stay visible so an employer
    has enough to get impressed and pay to unlock. What must never leak
    pre-unlock is how to find the person outside HireStepX: phone/LinkedIn,
    the specific employer/school names in their work and education history
    (C7 — a name like "Meesho" combined with a title is enough to identify
    someone on LinkedIn for free), and — easy to miss — their own name
    re-appearing inside free-text fields an AI wrote about them (summary,
    achievements, headline, certifications all routinely open with
    "<Full Name> is a ..."). `realName` is the candidate's actual name,
    known only server-side; never forwarded to the client unredacted. */
export function redactResumeDetailForLock(detail: ResumeDetail, realName: string): ResumeDetail {
  return {
    ...detail,
    summary: scrubName(detail.summary, realName),
    headline: detail.headline ? scrubName(detail.headline, realName) : detail.headline,
    keyAchievements: detail.keyAchievements.map((a) => scrubName(a, realName)),
    certifications: detail.certifications.map((c) => scrubName(c, realName)),
    careerTrajectory: detail.careerTrajectory ? scrubName(detail.careerTrajectory, realName) : detail.careerTrajectory,
    promotionSignals: detail.promotionSignals.map((p) => scrubName(p, realName)),
    experience: detail.experience.map((e) => ({
      ...e,
      company: "",
      ...(e.scope ? { scope: scrubName(e.scope, realName) } : {}),
      ...(e.topProjects ? { topProjects: e.topProjects.map((t) => scrubName(t, realName)) } : {}),
      ...(e.bullets ? { bullets: e.bullets.map((b) => scrubName(b, realName)) } : {}),
    })),
    education: detail.education.map((e) => ({ ...e, school: "" })),
    linkedin: null,
    phone: null,
  };
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
    skillsDetailed: [],
    linkedin: null,
    phone: null,
    noticePeriod: null,
    currentCtc: null,
  };
  if (!resumeData || typeof resumeData !== "object") return empty;
  const r = resumeData as Record<string, unknown>;

  const isAi = Array.isArray(r.topSkills);

  if (isAi) {
    const experiences = Array.isArray(r.experiences) ? r.experiences : [];
    return {
      ...empty,
      summary: asString(r.summary) || "",
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
      skillsDetailed: extractSkillsDetailed(r.skillsDetailed),
      noticePeriod: asString(r.noticePeriod),
      currentCtc: asString(r.currentCtc),
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
      })),
    certifications: asStringArray(r.certifications),
  };
}
