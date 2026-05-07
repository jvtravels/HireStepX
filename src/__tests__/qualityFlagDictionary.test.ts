import { describe, it, expect } from "vitest";
import { friendlyFlag, friendlyStatus, friendlySeverity, friendlyFocus, CATEGORY_LABEL } from "../qualityFlagDictionary";

describe("friendlyFlag", () => {
  it("translates known flags with label + description + category", () => {
    const f = friendlyFlag("implausible_salary_claim");
    expect(f.label).toBe("AI gave unrealistic salary number");
    expect(f.description).toContain("compensation");
    expect(f.category).toBe("ai_made_up_info");
  });

  it("falls back to humanized snake_case for unknown flags", () => {
    const f = friendlyFlag("brand_new_flag_name");
    expect(f.label).toBe("Brand new flag name");
    expect(f.description).toBe("");
  });

  it("guesses category for unknown flags via prefix", () => {
    expect(friendlyFlag("ai_accepted_garbage").category).toBe("ai_didnt_push_back");
    expect(friendlyFlag("implausible_xyz").category).toBe("ai_made_up_info");
    expect(friendlyFlag("duplicate_question").category).toBe("question_quality");
    expect(friendlyFlag("analyzer_error").category).toBe("system");
  });
});

describe("friendlyStatus / friendlySeverity / friendlyFocus", () => {
  it("translates statuses to plain English", () => {
    expect(friendlyStatus("open")).toBe("Needs review");
    expect(friendlyStatus("resolved")).toBe("Fixed");
    expect(friendlyStatus("wont_fix")).toBe("Closed (won't fix)");
  });

  it("translates severities", () => {
    expect(friendlySeverity("high")).toBe("High priority");
    expect(friendlySeverity("medium")).toBe("Medium priority");
    expect(friendlySeverity("low")).toBe("Low priority");
  });

  it("translates focus keys", () => {
    expect(friendlyFocus("salary-negotiation")).toBe("Salary negotiation");
    expect(friendlyFocus("hr-round")).toBe("HR round");
    expect(friendlyFocus("system-design")).toBe("System design");
  });

  it("returns the raw key for unknown focuses (no crash)", () => {
    expect(friendlyFocus("future-focus")).toBe("future-focus");
  });
});

describe("CATEGORY_LABEL", () => {
  it("has a label for every category produced by friendlyFlag", () => {
    const knownCategories = ["ai_made_up_info", "ai_didnt_push_back", "user_skipped_step", "question_quality", "system"] as const;
    for (const cat of knownCategories) {
      expect(CATEGORY_LABEL[cat]).toBeTruthy();
    }
  });
});
