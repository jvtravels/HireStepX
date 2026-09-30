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
  linkedin: string | null;
  phone: string | null;
  // Self-reported on the resume text, not verified — render with that caveat.
  noticePeriod: string | null;
  currentCtc: string | null;
}

/** A locked candidate's free-text resume fields routinely name their
    current employer and team (e.g. "Product Manager at Meesho... drives
    product strategy for Valmo") — enough to identify the specific person on
    LinkedIn without paying the unlock fee. Redacting only phone/linkedin
    left this wide open (C7). Strip every field that names an employer,
    school, or reads as free-text prose, keeping only what's useful for
    gauging fit: seniority, years of experience, industries, self-reported
    notice period / CTC, and generic (title-only) work/education history. */
export function redactResumeDetailForLock(detail: ResumeDetail): ResumeDetail {
  return {
    ...detail,
    summary: "",
    headline: null,
    keyAchievements: [],
    certifications: [],
    experience: detail.experience.map((e) => ({ ...e, company: "" })),
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
        })),
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
