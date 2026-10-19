import { describe, it, expect } from "vitest";
import { extractResumeDetail, redactResumeDetailForLock, coarsenLockedCity, coarsenPeriod } from "../../server-handlers/_resume-detail-helpers";
import { scrubLockedResume } from "../../server-handlers/_employer-matching-helpers";

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
    expect(detail.experience).toEqual([{ title: "Designer", company: "Orange Digital", period: "2021 - 2023", bullets: ["Redesigned onboarding"] }]);
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

describe("redactResumeDetailForLock", () => {
  it("hides identity, contact and employer names but keeps role, tenure and level signals", () => {
    const detail = extractResumeDetail({
      topSkills: ["Figma"],
      summary: "Product Manager at Meesho, drives strategy for Valmo.",
      headline: "Senior PM @ Meesho",
      seniorityLevel: "Senior",
      yearsExperience: 6,
      keyAchievements: ["Led a 4-person team"],
      industries: ["E-commerce"],
      experiences: [{ title: "Product Manager", company: "Meesho", start: "2022", end: "Present" }],
      noticePeriod: "30 days",
      currentCtc: "₹22 LPA",
    });

    const redacted = redactResumeDetailForLock(detail, "Jane Doe");

    expect(redacted.summary).toBe("Product Manager at [withheld], drives strategy for Valmo.");
    expect(redacted.headline).toBe("Senior PM @ [withheld]");
    expect(redacted.keyAchievements).toEqual(["Led a 4-person team"]);
    expect(redacted.linkedin).toBeNull();
    expect(redacted.phone).toBeNull();
    expect(redacted.experience).toEqual([{ title: "Product Manager", company: "", period: "2022 – Present" }]);
    expect(redacted.seniorityLevel).toBe("Senior");
    expect(redacted.yearsExperience).toBe(6);
    expect(redacted.industries).toEqual(["E-commerce"]);
    expect(redacted.noticePeriod).toBe("30 days");
    expect(redacted.currentCtc).toBe("₹22 LPA");
  });

  it("keeps certifications visible", () => {
    const detail = extractResumeDetail({
      skills: [],
      certifications: ["Google UX Design"],
    });

    expect(redactResumeDetailForLock(detail, "Jane Doe").certifications).toEqual(["Google UX Design"]);
  });

  it("drops the school but keeps degree and year in education entries", () => {
    const detail = extractResumeDetail({
      skills: [],
      education: [{ degree: "B.Tech", school: "IIT Bombay", year: "2018" }],
    });

    const redacted = redactResumeDetailForLock(detail, "Jane Doe");

    expect(redacted.education).toEqual([{ degree: "B.Tech", school: "", year: "2018" }]);
    expect(JSON.stringify(redacted)).not.toMatch(/Bombay/);
  });

  it("strips the candidate's name out of the AI-written summary so a locked candidate stays anonymous", () => {
    const detail = extractResumeDetail({
      topSkills: ["React"],
      summary: "Shaik Rukiyabi is an enthusiastic final-year student. Shaik has built several projects.",
    });

    const redacted = redactResumeDetailForLock(detail, "Shaik Rukiyabi");

    expect(redacted.summary).toBe("The candidate is an enthusiastic final-year student. The candidate has built several projects.");
    expect(redacted.summary).not.toMatch(/Shaik|Rukiyabi/);
  });

  it("strips the name out of headline, achievements, and certifications too", () => {
    const detail = extractResumeDetail({
      topSkills: ["React"],
      headline: "Jane Doe — Senior Engineer",
      keyAchievements: ["Jane Doe led a 4-person team"],
      experiences: [],
    });
    const withCerts = { ...detail, certifications: ["Jane Doe Certified Scrum Master"] };

    const redacted = redactResumeDetailForLock(withCerts, "Jane Doe");

    expect(redacted.headline).toBe("The candidate — Senior Engineer");
    expect(redacted.keyAchievements).toEqual(["The candidate led a 4-person team"]);
    expect(redacted.certifications).toEqual(["The candidate Certified Scrum Master"]);
  });

  it("is a no-op on free text when the candidate's name is empty or has no usable tokens", () => {
    const detail = extractResumeDetail({ topSkills: [], summary: "A short bio." });

    expect(redactResumeDetailForLock(detail, "").summary).toBe("A short bio.");
    expect(redactResumeDetailForLock(detail, "A").summary).toBe("A short bio.");
  });

  it("does not mangle unrelated substrings — word-bounded, not a blind substring replace", () => {
    const detail = extractResumeDetail({ topSkills: [], summary: "Experienced with Ravi Shastri's leadership books." });

    // Name "Ravi" should only match the whole word, not clobber "leadership".
    const redacted = redactResumeDetailForLock(detail, "Ravi");
    expect(redacted.summary).toBe("Experienced with The candidate Shastri's leadership books.");
  });
});

describe("redactResumeDetailForLock entity names", () => {
  const detail = extractResumeDetail({
    topSkills: ["SQL"],
    summary: "Ex-Razorpay analyst who later joined Zerodha; studied at IIT Madras.",
    keyAchievements: ["Cut Razorpay settlement time by 30%"],
    experiences: [
      {
        title: "Data Analyst", company: "Razorpay", start: "2020", end: "2022", scope: "Owned reporting for Razorpay merchants",
        teamSize: 4, partners: ["Zerodha"], topProjects: ["Project Orion"], bullets: ["Built Project Orion dashboards"],
      },
    ],
  });
  const withSchool = { ...detail, education: [{ degree: "M.Tech", school: "IIT Madras", year: "2019" }] };

  it("removes employer, school, partner and project names from structure and prose", () => {
    const locked = redactResumeDetailForLock(withSchool, "Jane Doe");
    expect(JSON.stringify(locked)).not.toMatch(/Razorpay|Zerodha|Orion|Madras/);
    expect(locked.experience[0]).toEqual({ title: "Data Analyst", company: "", period: "2020 – 2022", scope: "Owned reporting for [withheld] merchants", teamSize: 4 });
    expect(locked.education[0]).toEqual({ degree: "M.Tech", school: "", year: "2019" });
  });

  it("matches whole words only, so a short name does not gut longer words", () => {
    const d = extractResumeDetail({
      topSkills: [],
      summary: "Knows metadata pipelines and worked at Meta.",
      experiences: [{ title: "Engineer", company: "Meta", start: "2020", end: "2022" }],
    });
    expect(redactResumeDetailForLock(d, "Jane").summary).toBe("Knows metadata pipelines and worked at [withheld].");
  });

  it("leaves everything intact when no entity names are known", () => {
    const d = extractResumeDetail({ topSkills: [], summary: "Plain summary.", experiences: [] });
    expect(redactResumeDetailForLock(d, "Jane").summary).toBe("Plain summary.");
  });
});

describe("richer resume detail", () => {
  const aiResume = {
    topSkills: ["React"],
    careerTrajectory: "Moved from QA into product at Flipkart within two years.",
    promotionSignals: ["Promoted to Senior PM in 18 months at Flipkart", "  "],
    interviewGaps: ["No system design"],
    improvements: ["Add metrics"],
    resumeScore: 71,
    skillsDetailed: [
      { name: "React", depth: "primary", yearsUsed: 5, recent: true },
      { name: "Go", depth: "bogus" },
      { name: "", depth: "primary" },
      null,
    ],
    experiences: [
      { company: "Flipkart", title: "PM", start: "2021", end: "Present", scope: "Owned Flipkart checkout", teamSize: 8, partners: ["Design", "Eng"], topProjects: ["UPI autopay at Flipkart"] },
      { company: "Acme", title: "QA", start: "2019", end: "2021", scope: "", teamSize: null, partners: [], topProjects: [] },
    ],
  };

  it("carries trajectory, promotions, skill depth and per-role context from an AI resume", () => {
    const d = extractResumeDetail(aiResume);
    expect(d.careerTrajectory).toContain("QA into product");
    expect(d.promotionSignals).toEqual(["Promoted to Senior PM in 18 months at Flipkart"]);
    expect(d.skillsDetailed).toEqual([
      { name: "React", depth: "primary", yearsUsed: 5, recent: true },
      { name: "Go", depth: "secondary" },
    ]);
    expect(d.experience[0]).toMatchObject({ scope: "Owned Flipkart checkout", teamSize: 8, partners: ["Design", "Eng"], topProjects: ["UPI autopay at Flipkart"] });
    expect(d.experience[1]).toEqual({ title: "QA", company: "Acme", period: "2019 – 2021" });
  });

  it("never copies the coaching-only fields", () => {
    expect(JSON.stringify(extractResumeDetail(aiResume))).not.toMatch(/system design|Add metrics|resumeScore|interviewGaps|improvements/);
  });

  it("carries primary domain, years per domain and interview strengths, scrubbing the name when locked", () => {
    const d = extractResumeDetail({
      topSkills: ["Figma"],
      primaryDomain: "Product Design",
      domainYearsExperience: { "Frontend Engineering": 1, "Product Design": 5, Bad: "x" },
      interviewStrengths: ["Ravi explains design tradeoffs clearly", " "],
      interviewGaps: ["No system design"],
    });
    expect(d.primaryDomain).toBe("Product Design");
    expect(d.domainYears).toEqual([{ domain: "Product Design", years: 5 }, { domain: "Frontend Engineering", years: 1 }]);
    expect(d.interviewStrengths).toEqual(["Ravi explains design tradeoffs clearly"]);
    expect(redactResumeDetailForLock(d, "Ravi Kumar").interviewStrengths).toEqual(["The candidate explains design tradeoffs clearly"]);
    expect(JSON.stringify(d)).not.toMatch(/system design/);
  });

  it("keeps bullets from a regex-parsed resume, capped at five", () => {
    const d = extractResumeDetail({ skills: [], experience: [{ title: "Dev", company: "X", period: "2020", bullets: ["a", "b", "c", "d", "e", "f"] }] });
    expect(d.experience[0].bullets).toEqual(["a", "b", "c", "d", "e"]);
    expect(d.skillsDetailed).toEqual([]);
    expect(d.careerTrajectory).toBeNull();
  });

  it("leaks no candidate name or contact detail through the new fields while locked", () => {
    const original = extractResumeDetail({
      ...aiResume,
      careerTrajectory: "Jane Doe moved from QA into product at Flipkart. Reach her at jane@doe.in.",
    });
    const locked = scrubLockedResume(redactResumeDetailForLock(original, "Jane Doe"));
    const json = JSON.stringify(locked);
    expect(json).not.toMatch(/Jane|Doe|jane@/);
    expect(json).not.toContain("Flipkart");
    expect(locked.experience[0]).toMatchObject({ company: "", teamSize: 8 });
    expect(locked.experience[0]).not.toHaveProperty("partners");
    expect(locked.skillsDetailed).toHaveLength(2);
  });
});

describe("extractResumeDetail education", () => {
  it("drops entries with neither a degree nor a school", () => {
    const d = extractResumeDetail({ education: [{ year: "Sep / 2021" }, { degree: "B.Des", school: "NID", year: "2020" }] });
    expect(d.education).toEqual([{ degree: "B.Des", school: "NID", year: "2020" }]);
  });
});

describe("coarsenLockedCity", () => {
  it("keeps a large metro and withholds anything narrower", () => {
    expect(coarsenLockedCity("Bengaluru")).toBe("Bengaluru");
    expect(coarsenLockedCity("Gurugram")).toBe("Gurugram");
    expect(coarsenLockedCity("Vikaspuri, West Delhi near metro")).toBe("");
    expect(coarsenLockedCity("Jodhpur")).toBe("");
    expect(coarsenLockedCity("")).toBe("");
  });
});

describe("locked resume aliasing and period coarsening", () => {
  it("coarsens periods to years", () => {
    expect(coarsenPeriod("Jan 2020 – Mar 2022")).toBe("2020 – 2022");
    expect(coarsenPeriod("03/2020 - Present")).toBe("2020 - Present");
    expect(coarsenPeriod("September 2019 to present")).toBe("2019 to present");
    expect(coarsenPeriod("2021 - 2023")).toBe("2021 - 2023");
  });

  it("scrubs a suffix-stripped name and an acronym of the employer from the prose", () => {
    const base = extractResumeDetail({
      summary: "Spent four years at Infosys and then TCS building payments.",
      experience: [
        { title: "Engineer", company: "Infosys Ltd", period: "Jan 2018 – Dec 2021" },
        { title: "Lead", company: "Tata Consultancy Services", period: "2022 – Present" },
      ],
    } as never);
    const locked = redactResumeDetailForLock(base, "Jane Doe");
    expect(locked.summary).not.toMatch(/infosys|tcs/i);
    expect(locked.experience[0].period).toBe("2018 – 2021");
  });
});
