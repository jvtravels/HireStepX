import { describe, it, expect } from "vitest";
import { canonicalSkillToken, matchRequiredSkills, skillKey } from "../skillNormalize";

describe("skillKey", () => {
  it("folds .js suffixes and common aliases onto one key", () => {
    expect(skillKey("React.js")).toBe("react");
    expect(skillKey("ReactJS")).toBe("react");
    expect(skillKey("Node.js")).toBe("node");
    expect(skillKey("JS")).toBe("javascript");
    expect(skillKey("Postgres")).toBe("postgresql");
    expect(skillKey("Machine Learning")).toBe("machinelearning");
  });

  it("leaves distinct skills distinct", () => {
    expect(skillKey("Java")).not.toBe(skillKey("JavaScript"));
    expect(skillKey("C#")).toBe("c#");
  });
});

describe("canonicalSkillToken", () => {
  it("strips trailing sentence dots", () => {
    expect(canonicalSkillToken("react.")).toBe("react");
  });
});

describe("matchRequiredSkills", () => {
  it("matches React against React.js on the resume", () => {
    expect(matchRequiredSkills(["React", "Node"], ["React.js", "Node.js"])).toEqual(["React", "Node"]);
  });

  it("finds a skill named in resume text but not listed", () => {
    expect(matchRequiredSkills(["TypeScript", "Go"], ["Python"], "Built services in TypeScript for payments.")).toEqual(["TypeScript"]);
  });

  it("does not match a skill inside a longer word", () => {
    expect(matchRequiredSkills(["Go"], [], "Worked on mongodb and good practice")).toEqual([]);
  });
});
