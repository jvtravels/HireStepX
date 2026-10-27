import { describe, it, expect } from "vitest";
import { classifyAuthIntent } from "../auth/authIntent";

const T = "t".repeat(43);

describe("classifyAuthIntent", () => {
  it("treats a join link as an invite and keeps the token", () => {
    expect(classifyAuthIntent(`/employer/join?token=${T}`)).toEqual({ kind: "invite", token: T });
    expect(classifyAuthIntent(`/employer/join/?token=${T}`)).toEqual({ kind: "invite", token: T });
  });

  it("keeps an invite with no token an invite so the join page can explain it", () => {
    expect(classifyAuthIntent("/employer/join")).toEqual({ kind: "invite", token: "" });
  });

  it("treats other employer paths as a new company", () => {
    expect(classifyAuthIntent("/employer")).toEqual({ kind: "employer" });
    expect(classifyAuthIntent("/employer/team")).toEqual({ kind: "employer" });
    expect(classifyAuthIntent("/employer/requirements/new?x=1")).toEqual({ kind: "employer" });
  });

  it("does not mistake look-alike paths for an invite or employer", () => {
    expect(classifyAuthIntent("/employer/joinery")).toEqual({ kind: "employer" });
    expect(classifyAuthIntent("/employers")).toEqual({ kind: "candidate" });
    expect(classifyAuthIntent("/employer-next")).toEqual({ kind: "candidate" });
  });

  it("falls back to candidate for empty, external or malformed targets", () => {
    for (const v of [null, undefined, "", "/dashboard", "//evil.com/employer/join", "/\\evil.com", "https://evil.com/employer", "employer/join"]) {
      expect(classifyAuthIntent(v)).toEqual({ kind: "candidate" });
    }
  });
});

describe("auth forms share one classifier", () => {
  it("no form re-derives the flow from the raw next string", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["src/auth/Login.tsx", "src/auth/Signup.tsx", "src/home2/AuthForms.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain("classifyAuthIntent(");
      expect(src, f).not.toMatch(/nextParam\??\.startsWith\(/);
    }
  });
});
