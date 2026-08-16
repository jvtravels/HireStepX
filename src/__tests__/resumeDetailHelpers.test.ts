import { describe, it, expect } from "vitest";
import { extractResumeDetail } from "../../server-handlers/_resume-detail-helpers";

describe("extractResumeDetail", () => {
  it("returns an empty detail for null/non-object input", () => {
    expect(extractResumeDetail(null)).toMatchObject({ summary: "", experience: [], education: [] });
    expect(extractResumeDetail("not an object")).toMatchObject({ summary: "", experience: [] });
  });

  it("normalizes an ai-parsed resume (ResumeProfile)", () => {
    const detail = extractResumeDetail({
      topSkills: ["React", "TypeScript"],
      summary: "Product engineer with a bias for shipping.",
      headline: "Senior Product Engineer",
      seniorityLevel: "Senior",
      yearsExperience: 6,
      keyAchievements: ["Led a 4-person team", "Shipped v2 redesign"],
      industries: ["Fintech", "EdTech"],
      noticePeriod: "30 days",
      currentCtc: "₹22 LPA",
      experiences: [
        { company: "Acme", title: "Product Engineer", start: "2022", end: "Present", scope: "", teamSize: null, partners: [], topProjects: [] },
      ],
    });

    expect(detail.headline).toBe("Senior Product Engineer");
    expect(detail.yearsExperience).toBe(6);
    expect(detail.keyAchievements).toEqual(["Led a 4-person team", "Shipped v2 redesign"]);
    expect(detail.experience).toEqual([{ title: "Product Engineer", company: "Acme", period: "2022 – Present" }]);
    expect(detail.noticePeriod).toBe("30 days");
    expect(detail.currentCtc).toBe("₹22 LPA");
    expect(detail.linkedin).toBeNull();
    expect(detail.education).toEqual([]);
  });

  it("normalizes a fallback-parsed resume (ParsedResume)", () => {
    const detail = extractResumeDetail({
      skills: ["Figma", "UX Research"],
      summary: "Designer focused on B2B SaaS.",
      linkedin: "linkedin.com/in/jdoe",
      phone: "9123456780",
      experience: [{ title: "Designer", company: "Orange Digital", period: "2021 - 2023", bullets: ["Redesigned onboarding"] }],
      education: [{ degree: "B.Des", school: "NID", year: "2019" }],
      certifications: ["Google UX Design"],
    });

    expect(detail.linkedin).toBe("linkedin.com/in/jdoe");
    expect(detail.phone).toBe("9123456780");
    expect(detail.experience).toEqual([{ title: "Designer", company: "Orange Digital", period: "2021 - 2023" }]);
    expect(detail.education).toEqual([{ degree: "B.Des", school: "NID", year: "2019" }]);
    expect(detail.certifications).toEqual(["Google UX Design"]);
    expect(detail.headline).toBeNull();
    expect(detail.noticePeriod).toBeNull();
  });

  it("drops malformed entries in experience/education arrays instead of throwing", () => {
    const detail = extractResumeDetail({
      skills: [],
      experience: [null, "not an object", { title: "Designer", company: "X", period: "2020" }],
      education: [42, { degree: "B.Tech", school: "IIT", year: "2018" }],
    });
    expect(detail.experience).toEqual([{ title: "Designer", company: "X", period: "2020" }]);
    expect(detail.education).toEqual([{ degree: "B.Tech", school: "IIT", year: "2018" }]);
  });
});
