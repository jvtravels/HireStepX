import { describe, it, expect, vi, beforeEach } from "vitest";

const suppressed = vi.hoisted(() => ({ value: false }));
vi.mock("../../server-handlers/_unsubscribe", () => ({
  isSuppressed: vi.fn(async () => suppressed.value),
  preferenceDepsFromEnv: vi.fn(() => ({})),
  employerMarketingParts: vi.fn(async () => ({
    footer: { marketing: true, manageUrl: "https://hirestepx.com/employer/settings", unsubUrl: "https://hirestepx.com/api/unsubscribe?t=x" },
    resend: { reply_to: "hello@hirestepx.com", headers: { "List-Unsubscribe": "<x>" } },
  })),
}));
vi.mock("../../server-handlers/_entitlements", () => ({ loadAuthIdentity: vi.fn(async () => ({ email: "owner@acme.com", emailConfirmed: true })) }));

import {
  buildCreditRefundedEmail, buildMatchesReadyEmail, buildTeamJoinedEmail,
  sendCreditRefundedEmail, sendMatchesReadyEmail, sendTeamJoinedEmail,
} from "../../server-handlers/_employer-lifecycle-emails";

const fetchMock = vi.fn(async (_url: string, _init: { headers: Record<string, string>; body: string }) => new Response("{}", { status: 200 }));
const sent = () => fetchMock.mock.calls.map(([, i]) => ({ key: i.headers["Idempotency-Key"], body: JSON.parse(i.body) as Record<string, unknown> }));

beforeEach(() => {
  suppressed.value = false;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  process.env.RESEND_API_KEY = "re_test";
});

describe("builders", () => {
  it("credit refunded states amount, count and reason, with a plain-text part", () => {
    const m = buildCreditRefundedEmail({ candidateCount: 2, amountPaise: 199800, reasonLabel: "Candidate declined" });
    expect(m.subject).toBe("₹1,998 credit added to your HireStepX account");
    expect(m.html).toContain("2 candidates you unlocked can't be reached");
    expect(m.text).toContain("/employer/settings");
    expect(m.html).toContain("/employer/settings");
  });
  it("credit refunded uses singular wording for one candidate", () => {
    expect(buildCreditRefundedEmail({ candidateCount: 1, amountPaise: 99900, reasonLabel: "x" }).html).toContain("A candidate you unlocked can't be reached");
  });
  it("matches ready names the role and links the requirement; role is escaped", () => {
    const m = buildMatchesReadyEmail({ requirementId: "r1", roleTitle: "<b>Dev</b>" });
    expect(m.subject).toContain("Candidates are ready to review");
    expect(m.html).toContain("/employer/requirements/r1");
    expect(m.html).not.toContain("<b>Dev</b>");
  });
  it("team joined names the member and role and links /employer/team", () => {
    const m = buildTeamJoinedEmail({ memberName: "Asha", roleLabel: "Recruiter" });
    expect(m.subject).toBe("Asha joined your team on HireStepX");
    expect(m.html).toContain("/employer/team");
  });
});

describe("senders", () => {
  it("credit refund is a receipt: sent even when the employer opted out", async () => {
    suppressed.value = true;
    await sendCreditRefundedEmail({ employerId: "e1", candidateCount: 1, amountPaise: 99900, reasonLabel: "Candidate declined", dedupeKey: "e1-m1-1" });
    const [s] = sent();
    expect(s.key).toBe("credit-refunded-e1-m1-1");
    expect(s.body.to).toEqual(["owner@acme.com"]);
    expect(typeof s.body.text).toBe("string");
  });
  it("matches ready honours the opt-out and carries unsubscribe headers when sent", async () => {
    suppressed.value = true;
    await sendMatchesReadyEmail({ employerId: "e1", requirementId: "r1", roleTitle: "Dev" });
    expect(fetchMock).not.toHaveBeenCalled();
    suppressed.value = false;
    await sendMatchesReadyEmail({ employerId: "e1", requirementId: "r1", roleTitle: "Dev" });
    const [s] = sent();
    expect(s.key).toBe("matches-ready-r1");
    expect(s.body.headers).toEqual({ "List-Unsubscribe": "<x>" });
  });
  it("team joined honours the opt-out", async () => {
    suppressed.value = true;
    await sendTeamJoinedEmail({ ownerId: "o", memberId: "m", memberName: "A", roleLabel: "Recruiter" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends nothing without a Resend key and never throws", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendCreditRefundedEmail({ employerId: "e1", candidateCount: 1, amountPaise: 1, reasonLabel: "x", dedupeKey: "k" })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("swallows a delivery failure", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    await expect(sendTeamJoinedEmail({ ownerId: "o", memberId: "m", memberName: "A", roleLabel: "Recruiter" })).resolves.toBeUndefined();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
  });
});
