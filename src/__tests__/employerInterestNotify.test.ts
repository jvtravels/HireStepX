import { describe, it, expect, vi, beforeEach } from "vitest";
import { interestNotification, notifyCandidatesOfInterest } from "../../server-handlers/_employer-interest-notify";

const target = { matchId: "m1", candidateUserId: "u1", name: "Asha Rao", email: "asha@example.com" };

describe("employer interest notification", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("is generic and links to the role", () => {
    const n = interestNotification(target);
    expect(n.type).toBe("employer_contact_request");
    expect(n.link).toBe("/jobs/m1");
    expect(`${n.title} ${n.body}`).not.toMatch(/asha/i);
  });

  it("notifies every target in-app and skips email when Resend is not configured", async () => {
    const notifyFn = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn();
    await notifyCandidatesOfInterest({
      targets: [target, { ...target, matchId: "m2", candidateUserId: "u2" }],
      notifyFn,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(notifyFn).toHaveBeenCalledTimes(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws when the notifier fails", async () => {
    const notifyFn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(notifyCandidatesOfInterest({ targets: [target], notifyFn })).resolves.toBeUndefined();
  });
});
