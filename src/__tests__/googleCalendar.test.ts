import { describe, it, expect } from "vitest";
import {
  googleConfigured,
  buildAuthUrl,
  isAccessTokenExpired,
  signState,
  verifyState,
  googleEventToAction,
  rowToGoogleResource,
  parseSyncResponse,
  shouldExportToGoogle,
  GOOGLE_CALENDAR_SCOPE,
  HSX_PROP,
  type GoogleEvent,
} from "../../server-handlers/_google-calendar";

describe("googleConfigured", () => {
  it("requires both id and secret", () => {
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "x", GOOGLE_CLIENT_SECRET: "y" })).toBe(true);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "x" })).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_SECRET: "y" })).toBe(false);
    expect(googleConfigured({ GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "y" })).toBe(false);
    expect(googleConfigured({})).toBe(false);
  });
});

describe("buildAuthUrl", () => {
  it("requests the calendar scope, offline access, and forced consent", () => {
    const url = buildAuthUrl({ clientId: "cid", redirectUri: "https://app/cb", state: "st" });
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(decodeURIComponent(url)).toContain(GOOGLE_CALENDAR_SCOPE);
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=st");
    expect(url).toContain("client_id=cid");
  });
});

describe("isAccessTokenExpired", () => {
  const now = Date.parse("2026-06-13T12:00:00.000Z");
  it("treats missing/garbage expiry as expired", () => {
    expect(isAccessTokenExpired(null, now)).toBe(true);
    expect(isAccessTokenExpired("nonsense", now)).toBe(true);
  });
  it("refreshes slightly early via the skew", () => {
    expect(isAccessTokenExpired("2026-06-13T12:01:00.000Z", now, 120)).toBe(true); // within skew
    expect(isAccessTokenExpired("2026-06-13T12:30:00.000Z", now, 120)).toBe(false);
  });
});

describe("signState / verifyState", () => {
  it("round-trips a signed payload", async () => {
    const state = await signState("secret", { userId: "u1", nonce: "n1" });
    const back = await verifyState("secret", state);
    expect(back).toEqual({ userId: "u1", nonce: "n1" });
  });
  it("rejects a tampered body", async () => {
    const state = await signState("secret", { userId: "u1", nonce: "n1" });
    const [, sig] = state.split(".");
    const forged = `${Buffer.from(JSON.stringify({ userId: "attacker", nonce: "n1" })).toString("base64url")}.${sig}`;
    expect(await verifyState("secret", forged)).toBeNull();
  });
  it("rejects the wrong secret and malformed input", async () => {
    const state = await signState("secret", { userId: "u1", nonce: "n1" });
    expect(await verifyState("other", state)).toBeNull();
    expect(await verifyState("secret", "no-dot")).toBeNull();
  });
});

describe("googleEventToAction", () => {
  const ctx = { timezone: "Asia/Kolkata" };
  it("maps a timed event to an upsert with derived duration", () => {
    const g: GoogleEvent = {
      id: "g1",
      status: "confirmed",
      summary: "Amazon screen",
      location: "Meet",
      start: { dateTime: "2026-07-01T09:00:00Z" },
      end: { dateTime: "2026-07-01T10:30:00Z" },
    };
    const a = googleEventToAction(g, ctx);
    expect(a.action).toBe("upsert");
    if (a.action !== "upsert") return;
    expect(a.googleEventId).toBe("g1");
    expect(a.body.start_utc).toBe("2026-07-01T09:00:00.000Z");
    expect(a.body.duration).toBe(90);
    expect(a.body.source).toBe("google");
    expect(a.body.google_event_id).toBe("g1");
  });
  it("maps a cancelled event to a delete", () => {
    const a = googleEventToAction({ id: "g2", status: "cancelled" }, ctx);
    expect(a).toEqual({ action: "delete", googleEventId: "g2" });
  });
  it("handles all-day events", () => {
    const a = googleEventToAction({ id: "g3", start: { date: "2026-07-01" } }, ctx);
    expect(a.action).toBe("upsert");
    if (a.action !== "upsert") return;
    expect(a.body.start_utc).toBe("2026-07-01T00:00:00.000Z");
    expect(a.body.duration).toBe(60); // default when no end
  });
  it("skips events with no id or unparseable start", () => {
    expect(googleEventToAction({ status: "confirmed" }, ctx).action).toBe("skip");
    expect(googleEventToAction({ id: "g4", start: {} }, ctx).action).toBe("skip");
  });
});

describe("rowToGoogleResource", () => {
  it("stamps the hirestepx id and derives end from duration", () => {
    const res = rowToGoogleResource({
      id: "row-1",
      title: "Mock",
      start_utc: "2026-07-01T09:00:00.000Z",
      end_utc: null,
      duration_minutes: 45,
      timezone: "Asia/Kolkata",
    });
    expect(res.summary).toBe("Mock");
    expect((res.start as { dateTime: string }).dateTime).toBe("2026-07-01T09:00:00.000Z");
    expect((res.end as { dateTime: string }).dateTime).toBe("2026-07-01T09:45:00.000Z");
    expect((res.extendedProperties as { private: Record<string, string> }).private[HSX_PROP]).toBe("row-1");
  });
});

describe("parseSyncResponse", () => {
  const ctx = { timezone: "Asia/Kolkata" };
  it("flags a 410 as gone (full resync needed)", () => {
    expect(parseSyncResponse(410, null, ctx)).toEqual({ gone: true, actions: [] });
  });
  it("extracts actions and the next sync token", () => {
    const out = parseSyncResponse(200, {
      items: [
        { id: "a", start: { dateTime: "2026-07-01T09:00:00Z" } },
        { id: "b", status: "cancelled" },
      ],
      nextSyncToken: "tok-123",
    }, ctx);
    expect(out.gone).toBe(false);
    expect(out.nextSyncToken).toBe("tok-123");
    expect(out.actions.map((a) => a.action)).toEqual(["upsert", "delete"]);
  });
});

describe("shouldExportToGoogle", () => {
  it("skips google-origin and non-real events to avoid echo loops", () => {
    expect(shouldExportToGoogle({ source: "google", kind: "real" })).toBe(false);
    expect(shouldExportToGoogle({ source: "manual", kind: "prep-session" })).toBe(false);
    expect(shouldExportToGoogle({ source: "manual", kind: "real" })).toBe(true);
    expect(shouldExportToGoogle({ source: "nl", kind: "real" })).toBe(true);
  });
});
