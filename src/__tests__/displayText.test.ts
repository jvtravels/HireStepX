import { describe, it, expect } from "vitest";
import { tidyName, tidyRole } from "../displayText";

describe("tidyName", () => {
  it("fixes all-caps and all-lowercase names", () => {
    expect(tidyName("JAY VYAS")).toBe("Jay Vyas");
    expect(tidyName("sufiyan sanderwale")).toBe("Sufiyan Sanderwale");
    expect(tidyName("anne-marie SMITH")).toBe("anne-marie SMITH");
    expect(tidyName("ANNE-MARIE SMITH")).toBe("Anne-Marie Smith");
  });
  it("leaves deliberate mixed casing alone", () => {
    expect(tidyName("Himani")).toBe("Himani");
    expect(tidyName("McDonald Rao")).toBe("McDonald Rao");
  });
  it("handles empty and non-letter input", () => {
    expect(tidyName("  ")).toBe("");
    expect(tidyName("123")).toBe("123");
  });
});

describe("tidyRole", () => {
  it("title-cases uniform text and keeps acronyms", () => {
    expect(tidyRole("SOFTWARE ENGINEER")).toBe("Software Engineer");
    expect(tidyRole("software engineer")).toBe("Software Engineer");
    expect(tidyRole("head of QA")).toBe("head of QA");
    expect(tidyRole("HEAD OF HR")).toBe("Head of HR");
  });
  it("leaves mixed case alone", () => {
    expect(tidyRole("iOS Engineer")).toBe("iOS Engineer");
  });
});
