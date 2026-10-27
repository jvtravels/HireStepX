import { describe, it, expect, vi, afterEach } from "vitest";
import { sendTeamInviteEmail, sendTeamChangeEmail } from "../../server-handlers/_employer-team-emails";

function captureSend() {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return () => JSON.parse(fetchMock.mock.calls[0][1].body as string) as { from: string; subject: string; html: string };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("team emails use the shared layout", () => {
  it("invite opens with the hero card, sends from hello@, and has a no-account footer", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    const sent = captureSend();
    await sendTeamInviteEmail({ to: "a@b.co", token: "t", companyName: "JV", inviterName: "JAY VYAS", role: "viewer" });
    const { from, subject, html } = sent();
    expect(from).toContain("hello@hirestepx.com");
    expect(subject).toBe("Jay Vyas invited you to JV on HireStepX");
    expect(html).toContain("hsx-hero-card");
    expect(html).toContain("a teammate invited this address");
    expect(html).not.toContain("you have an account");
    expect(html).not.toContain("Manage notifications");
    expect(html).not.toContain("a@b.co");
  });

  it("role change uses the hero card and the normal account footer", async () => {
    vi.stubEnv("RESEND_API_KEY", "k");
    const sent = captureSend();
    await sendTeamChangeEmail({ to: "a@b.co", change: { kind: "removed" }, companyName: "JV", actorName: "Sam" });
    const { html } = sent();
    expect(html).toContain("hsx-hero-card");
    expect(html).toContain("you have an account");
  });
});
