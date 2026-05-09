import { describe, expect, it } from "vitest";
import {
  ENGINEERING_TRACK_ROLES,
  IT_NON_ENG_ROLES,
  JUNIOR_LEVELS,
  LEAD_EXEC_LEVELS,
  MID_OR_SENIOR_LEVELS,
  NON_ENTRY_LEVELS,
  UNICORN_SEED_FLIP_COMPANIES,
  extractSampleSize,
  isAbOnlyCuratorSource,
  isMisbinnedScrape,
  isPass2YoeBucket,
  isResearchSourced,
  isSeedSource,
} from "../../data/_salary-source-helpers";

describe("extractSampleSize", () => {
  it("parses n=NNN out of scrape notes", () => {
    expect(extractSampleSize("AB pass-2 yoe-bucket (n=1234)")).toBe(1234);
    expect(extractSampleSize("AB pass-1 (n=42)")).toBe(42);
  });
  it("returns 0 when notes are absent or have no n=", () => {
    expect(extractSampleSize(undefined)).toBe(0);
    expect(extractSampleSize("AB pass-2 no count")).toBe(0);
  });
  it("matches the first n= occurrence", () => {
    expect(extractSampleSize("scrape n=50 ; subsample n=999")).toBe(50);
  });
});

describe("isSeedSource", () => {
  it("matches sources beginning with 'Seed dataset'", () => {
    expect(isSeedSource("Seed dataset 2026-05-08 (paytm 0.85x)")).toBe(true);
  });
  it("rejects everything else (case-sensitive prefix)", () => {
    expect(isSeedSource("AmbitionBox 2026-05-08")).toBe(false);
    expect(isSeedSource("seed dataset (lowercase)")).toBe(false);
    expect(isSeedSource(undefined)).toBe(false);
  });
});

describe("isAbOnlyCuratorSource", () => {
  it("matches plain AmbitionBox sources", () => {
    expect(isAbOnlyCuratorSource("AmbitionBox 2026-05-08 (Zoho PM)")).toBe(true);
  });
  it("rejects AB blended with Levels.fyi / DRHP / disclosure / verified", () => {
    expect(isAbOnlyCuratorSource("AmbitionBox + Levels.fyi cross-source")).toBe(false);
    expect(isAbOnlyCuratorSource("AmbitionBox + DRHP filing 2024")).toBe(false);
    expect(isAbOnlyCuratorSource("AmbitionBox verified disclosure")).toBe(false);
  });
  it("rejects non-AB sources", () => {
    expect(isAbOnlyCuratorSource("Levels.fyi (Bangalore)")).toBe(false);
    expect(isAbOnlyCuratorSource(undefined)).toBe(false);
  });
});

describe("isPass2YoeBucket", () => {
  it("detects yoe-bucket marker in notes", () => {
    expect(isPass2YoeBucket("AB pass-2 yoe-bucket (n=120)")).toBe(true);
  });
  it("rejects pass-1 notes and undefined", () => {
    expect(isPass2YoeBucket("AB pass-1 (n=900)")).toBe(false);
    expect(isPass2YoeBucket(undefined)).toBe(false);
  });
});

describe("isResearchSourced", () => {
  it("matches independently-sourced curator strings", () => {
    expect(isResearchSourced("Levels.fyi (Bangalore ₹13.73M+)")).toBe(true);
    expect(isResearchSourced("Glassdoor median 2024")).toBe(true);
    expect(isResearchSourced("Curated research worksheet 2025-Q4")).toBe(true);
    expect(isResearchSourced("DRHP filing 2024")).toBe(true);
    expect(isResearchSourced("Indeed aggregate")).toBe(true);
    expect(isResearchSourced("Weekday platform median")).toBe(true);
    expect(isResearchSourced("NLTH Wipro talent hunt")).toBe(true);
    expect(isResearchSourced("JPMC India Analyst program")).toBe(true);
  });
  it("rejects pure AmbitionBox / seed sources", () => {
    expect(isResearchSourced("AmbitionBox 2026-05-08")).toBe(false);
    expect(isResearchSourced("Seed dataset 2026-05-08 (0.85x)")).toBe(false);
    expect(isResearchSourced(undefined)).toBe(false);
  });
});

describe("isMisbinnedScrape", () => {
  it("flags high-YOE buckets on entry-level cells", () => {
    expect(isMisbinnedScrape("AB pass-2 9-12y (n=120)", "entry")).toBe(true);
    expect(isMisbinnedScrape("AB pass-2 12+y (n=80)", "entry")).toBe(true);
    expect(isMisbinnedScrape("AB pass-2 6-9y (n=80)", "entry")).toBe(true);
  });
  it("flags low-YOE buckets on lead/exec cells", () => {
    expect(isMisbinnedScrape("AB pass-2 0-1y (n=200)", "lead")).toBe(true);
    expect(isMisbinnedScrape("AB pass-2 1-3y (n=150)", "executive")).toBe(true);
  });
  it("does not flag aligned bucket/level pairs", () => {
    expect(isMisbinnedScrape("AB pass-2 0-1y (n=200)", "entry")).toBe(false);
    expect(isMisbinnedScrape("AB pass-2 9-12y (n=120)", "lead")).toBe(false);
    expect(isMisbinnedScrape("AB pass-2 3-6y (n=120)", "mid")).toBe(false);
    expect(isMisbinnedScrape(undefined, "entry")).toBe(false);
  });
});

describe("level-membership sets", () => {
  it("JUNIOR_LEVELS covers entry+mid", () => {
    expect(JUNIOR_LEVELS.has("entry")).toBe(true);
    expect(JUNIOR_LEVELS.has("mid")).toBe(true);
    expect(JUNIOR_LEVELS.has("senior")).toBe(false);
  });
  it("LEAD_EXEC_LEVELS covers lead+executive only", () => {
    expect(LEAD_EXEC_LEVELS.has("lead")).toBe(true);
    expect(LEAD_EXEC_LEVELS.has("executive")).toBe(true);
    expect(LEAD_EXEC_LEVELS.has("senior")).toBe(false);
    expect(LEAD_EXEC_LEVELS.has("mid")).toBe(false);
  });
  it("MID_OR_SENIOR_LEVELS covers mid+senior only", () => {
    expect(MID_OR_SENIOR_LEVELS.has("mid")).toBe(true);
    expect(MID_OR_SENIOR_LEVELS.has("senior")).toBe(true);
    expect(MID_OR_SENIOR_LEVELS.has("lead")).toBe(false);
    expect(MID_OR_SENIOR_LEVELS.has("entry")).toBe(false);
  });
  it("NON_ENTRY_LEVELS is the complement of {entry}", () => {
    expect(NON_ENTRY_LEVELS.has("entry")).toBe(false);
    for (const lvl of ["mid", "senior", "lead", "executive"] as const) {
      expect(NON_ENTRY_LEVELS.has(lvl)).toBe(true);
    }
  });
});

describe("role-membership sets", () => {
  it("IT_NON_ENG_ROLES tags PM/QA/BA/PrM", () => {
    expect(IT_NON_ENG_ROLES.has("product-manager")).toBe(true);
    expect(IT_NON_ENG_ROLES.has("project-manager")).toBe(true);
    expect(IT_NON_ENG_ROLES.has("business-analyst")).toBe(true);
    expect(IT_NON_ENG_ROLES.has("qa-engineer")).toBe(true);
    expect(IT_NON_ENG_ROLES.has("software-engineer")).toBe(false);
  });
  it("ENGINEERING_TRACK_ROLES covers SE/QA/DE/DevOps", () => {
    expect(ENGINEERING_TRACK_ROLES.has("software-engineer")).toBe(true);
    expect(ENGINEERING_TRACK_ROLES.has("data-engineer")).toBe(true);
    expect(ENGINEERING_TRACK_ROLES.has("devops-engineer")).toBe(true);
    expect(ENGINEERING_TRACK_ROLES.has("product-manager")).toBe(false);
  });
});

describe("UNICORN_SEED_FLIP_COMPANIES", () => {
  it("contains the runtime PREFER_IMPORTED_OVER_SEED_COMPANIES extension", () => {
    for (const c of ["paytm", "zomato", "meesho"]) {
      expect(UNICORN_SEED_FLIP_COMPANIES.has(c)).toBe(true);
    }
  });
});
