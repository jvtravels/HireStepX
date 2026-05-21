/* Contract tests for the API boundary validator (2026-05-21 audit).
 *
 * This is the gatekeeper at the negotiate-turn route — every request
 * body must pass these checks before any kernel code runs. The tests
 * assert:
 *
 *   1. Valid INIT and TURN bodies are accepted and produce typed,
 *      pre-cleaned output (no `||` defaults needed downstream).
 *   2. Each documented failure mode (non-object body, missing
 *      sessionId, oversized candidateAnswer, wrong-typed resumeFactPack,
 *      etc.) is rejected with status=400 and a precise error message.
 *   3. Unknown extra fields are tolerated (forwards-compat).
 *   4. Length / value bounds are enforced.
 */
import { describe, it, expect } from "vitest";
import {
  validateInitRequest,
  validateTurnRequest,
  validateRequestBody,
} from "../../../server-handlers/_request-validator";

const VALID_INIT = {
  action: "init",
  sessionId: "s-1",
  role: "Senior Product Designer",
  company: "Flipkart",
  experienceLevel: "senior",
  totalYoe: 7,
  applicableYoe: 7,
  primaryDomain: "design",
  collegeTier: "tier-1",
  internshipMonths: 6,
  resumeFactPack: { latestRole: { companyName: "Swiggy" } },
  parsedResume: { name: "Jay" },
};

const VALID_TURN = {
  action: "turn",
  state: '{"sessionId":"s-1","turnIndex":3}',
  candidateAnswer: "currently at 18 LPA, expecting 28",
};

describe("validateInitRequest — happy path", () => {
  it("accepts a fully-populated valid body", () => {
    const r = validateInitRequest(VALID_INIT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.sessionId).toBe("s-1");
    expect(r.body.role).toBe("Senior Product Designer");
    expect(r.body.applicableYoe).toBe(7);
    expect(r.body.collegeTier).toBe("tier-1");
    expect(r.body.resumeFactPack).toEqual({ latestRole: { companyName: "Swiggy" } });
  });

  it("normalises missing optional fields to documented defaults", () => {
    const r = validateInitRequest({ action: "init", sessionId: "s-2" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.role).toBe("");
    expect(r.body.company).toBe("");
    expect(r.body.totalYoe).toBeNull();
    expect(r.body.applicableYoe).toBeNull();
    expect(r.body.primaryDomain).toBeNull();
    expect(r.body.collegeTier).toBeNull();
    expect(r.body.resumeFactPack).toBeNull();
    expect(r.body.parsedResume).toBeNull();
  });

  it("tolerates unknown extra fields (forwards-compat)", () => {
    const r = validateInitRequest({ ...VALID_INIT, futureField: "ignored", x: 42 });
    expect(r.ok).toBe(true);
  });

  it("maps unknown collegeTier strings to null (no rejection)", () => {
    const r = validateInitRequest({ ...VALID_INIT, collegeTier: "tier-99" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.collegeTier).toBeNull();
  });
});

describe("validateInitRequest — rejections", () => {
  it("rejects non-object body", () => {
    expect(validateInitRequest("not an object")).toMatchObject({ ok: false, status: 400 });
    expect(validateInitRequest(null)).toMatchObject({ ok: false, status: 400 });
    expect(validateInitRequest([])).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects missing/empty sessionId", () => {
    expect(validateInitRequest({ action: "init" })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "" })).toMatchObject({ ok: false });
  });

  it("rejects 200+ char sessionId (DoS floor)", () => {
    const r = validateInitRequest({ action: "init", sessionId: "x".repeat(300) });
    expect(r.ok).toBe(false);
  });

  it("rejects non-string role / company", () => {
    expect(validateInitRequest({ action: "init", sessionId: "s", role: 123 })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", company: { x: 1 } })).toMatchObject({ ok: false });
  });

  it("rejects non-finite totalYoe / applicableYoe", () => {
    expect(validateInitRequest({ action: "init", sessionId: "s", totalYoe: "five" })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", applicableYoe: NaN })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", applicableYoe: Infinity })).toMatchObject({ ok: false });
  });

  it("rejects maxTurns outside (0, 100]", () => {
    expect(validateInitRequest({ action: "init", sessionId: "s", maxTurns: 0 })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", maxTurns: -3 })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", maxTurns: 200 })).toMatchObject({ ok: false });
  });

  it("rejects string / array resumeFactPack (must be object-or-null)", () => {
    expect(validateInitRequest({ action: "init", sessionId: "s", resumeFactPack: "[object Object]" })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", resumeFactPack: [] })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", resumeFactPack: 42 })).toMatchObject({ ok: false });
  });

  it("rejects string / array parsedResume (must be object-or-null)", () => {
    expect(validateInitRequest({ action: "init", sessionId: "s", parsedResume: "not-an-obj" })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init", sessionId: "s", parsedResume: [{}] })).toMatchObject({ ok: false });
  });

  it("rejects wrong action", () => {
    expect(validateInitRequest({ action: "turn", sessionId: "s" })).toMatchObject({ ok: false });
    expect(validateInitRequest({ action: "init-malicious", sessionId: "s" })).toMatchObject({ ok: false });
  });
});

describe("validateTurnRequest — happy path + rejections", () => {
  it("accepts a valid turn body", () => {
    const r = validateTurnRequest(VALID_TURN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.candidateAnswer).toBe("currently at 18 LPA, expecting 28");
  });

  it("rejects empty / non-string state", () => {
    expect(validateTurnRequest({ action: "turn", state: "", candidateAnswer: "x" })).toMatchObject({ ok: false });
    expect(validateTurnRequest({ action: "turn", state: { x: 1 }, candidateAnswer: "x" })).toMatchObject({ ok: false });
  });

  it("rejects oversized state (>32KB)", () => {
    const r = validateTurnRequest({ action: "turn", state: "a".repeat(40_000), candidateAnswer: "x" });
    expect(r.ok).toBe(false);
  });

  it("rejects oversized candidateAnswer (>20KB)", () => {
    const r = validateTurnRequest({ action: "turn", state: "{}", candidateAnswer: "a".repeat(25_000) });
    expect(r.ok).toBe(false);
  });

  it("rejects non-string candidateAnswer", () => {
    expect(validateTurnRequest({ action: "turn", state: "{}", candidateAnswer: 42 })).toMatchObject({ ok: false });
    expect(validateTurnRequest({ action: "turn", state: "{}", candidateAnswer: null })).toMatchObject({ ok: false });
  });

  it("accepts empty string candidateAnswer (init-followup turn)", () => {
    /* The init handshake produces a state, then turn 1 can land with an
     * empty candidateAnswer if the UI auto-advances. Length zero must
     * be accepted; only NON-string is rejected. */
    const r = validateTurnRequest({ action: "turn", state: "{}", candidateAnswer: "" });
    expect(r.ok).toBe(true);
  });
});

describe("validateRequestBody — dispatcher", () => {
  it("dispatches to init validator", () => {
    expect(validateRequestBody(VALID_INIT).ok).toBe(true);
  });
  it("dispatches to turn validator", () => {
    expect(validateRequestBody(VALID_TURN).ok).toBe(true);
  });
  it("rejects bodies with unknown action", () => {
    expect(validateRequestBody({ action: "delete-all" })).toMatchObject({ ok: false, status: 400 });
  });
  it("rejects non-object root", () => {
    expect(validateRequestBody(null)).toMatchObject({ ok: false });
    expect(validateRequestBody("init")).toMatchObject({ ok: false });
  });
});
