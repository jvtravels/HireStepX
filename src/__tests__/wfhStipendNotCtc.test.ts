/* OA-B63 regression lock (2026-07-18 audit).
 *
 * A number scoped to a WFH / setup / wellness / L&D / meal / travel allowance,
 * stipend, or budget is a PERK ask, not the candidate's CTC. Before the
 * `isPerkComponentScopedSpan` guard in _number-role-classifier.ts, a WFH setup
 * allowance false-bound as the candidate's total-CTC TARGET (harmful data
 * corruption), and a stipend stated alongside a real total was silently
 * dropped. These pin the guard. */

import { describe, it, expect } from "vitest";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

describe("OA-B63 — perk allowances/stipends must not bind as CTC roles", () => {
  it("does not read a WFH setup allowance as a total-CTC target", () => {
    const r = classifyNumberRoles("I'd like a 1 lakh work-from-home setup allowance.", {});
    expect(r.target).toBeNull();
    expect(r.currentCtc).toBeNull();
  });

  it("does not read a WFH stipend as a target (right-anchored perk noun)", () => {
    const r = classifyNumberRoles("Can you add a 2 lakh WFH stipend?", {});
    expect(r.target).toBeNull();
    expect(r.currentCtc).toBeNull();
  });

  it("keeps the real total when a stipend is stated alongside it", () => {
    // "26 LPA" is the total; the "2 lakh WFH stipend" must not clobber or drop it.
    const r = classifyNumberRoles("My current package is 26 LPA plus a 2 lakh WFH stipend.", {});
    expect(r.currentCtc).toBe(26);
    expect(r.target).toBeNull();
  });

  it("does not read a left-anchored perk ('wellness budget of 1 lakh') as CTC", () => {
    const r = classifyNumberRoles("I'd want a wellness budget of 1 lakh a year.", {});
    expect(r.target).toBeNull();
    expect(r.currentCtc).toBeNull();
  });

  it("a genuine target with no perk noun still binds (guard is not over-broad)", () => {
    const r = classifyNumberRoles("I'm targeting 45 LPA total.", {});
    expect(r.target).toBe(45);
  });
});
