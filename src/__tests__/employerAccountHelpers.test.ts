import { describe, it, expect } from "vitest";
import {
  tierPresentation, describeLimits, tierLadder, openJobCount, exportFilename, exportIsIncomplete, exportBody,
} from "../employer/_accountHelpers";
import { deletionWarnings } from "../employer/EmployerDeletionNotice";
import { shouldDiscardPendingEmployerProfile } from "../AuthContext";
import { TIER_LIMITS } from "../../server-handlers/_employer-trust";
import { formatPaise } from "../../server-handlers/_unlock-pricing";

describe("tierPresentation", () => {
  it("earns the Verified badge only at the verified tier", () => {
    expect(tierPresentation("verified")).toMatchObject({ label: "Verified", verifiedBadge: true, nextStep: null });
    expect(tierPresentation("email_verified").verifiedBadge).toBe(false);
    expect(tierPresentation("basic").verifiedBadge).toBe(false);
  });
  it("tells a basic account to verify with a work email", () => {
    expect(tierPresentation("basic").nextStep).toMatch(/work email/i);
  });
  it("tells a work-email account to match the website domain", () => {
    expect(tierPresentation("email_verified").nextStep).toMatch(/website/i);
  });
});

describe("limits", () => {
  it("describes the server's numbers", () => {
    const text = describeLimits(TIER_LIMITS.basic);
    expect(text).toContain(`${TIER_LIMITS.basic.unlocksPerDay} unlocks a day`);
    expect(text).toContain(`${TIER_LIMITS.basic.openRequirements} open jobs`);
  });
  it("lists all three tiers in order", () => {
    expect(tierLadder().map((r) => r.tier)).toEqual(["basic", "email_verified", "verified"]);
  });
});

describe("openJobCount", () => {
  it("counts everything not closed", () => {
    expect(openJobCount([{ status: "ready" }, { status: "closed" }, { status: "failed" }, { status: "generating" }])).toBe(3);
    expect(openJobCount([])).toBe(0);
  });
});

describe("export helpers", () => {
  it("reads a safe filename from Content-Disposition, else a default", () => {
    expect(exportFilename({ "content-disposition": 'attachment; filename="hirestepx-export-2026.json"' })).toBe("hirestepx-export-2026.json");
    expect(exportFilename({ "content-disposition": 'attachment; filename="../evil.json"' })).toBe("hirestepx-data-export.json");
    expect(exportFilename({})).toBe("hirestepx-data-export.json");
  });
  it("flags an incomplete export only when the server says false", () => {
    expect(exportIsIncomplete({ "x-export-complete": "false" })).toBe(true);
    expect(exportIsIncomplete({ "x-export-complete": "true" })).toBe(false);
    expect(exportIsIncomplete({})).toBe(false);
  });
  it("serialises object bodies and passes strings through", () => {
    expect(exportBody("raw")).toBe("raw");
    expect(JSON.parse(exportBody({ a: 1 }))).toEqual({ a: 1 });
  });
});

describe("deletionWarnings", () => {
  it("warns about open jobs with correct plurals", () => {
    expect(deletionWarnings({ openJobs: 1, creditPaise: null })[0]).toMatch(/1 open job\. It stops/);
    expect(deletionWarnings({ openJobs: 3, creditPaise: null })[0]).toMatch(/3 open jobs\. They stop/);
  });
  it("warns about unspent credit using formatPaise, never a hard-coded amount", () => {
    const out = deletionWarnings({ openJobs: 0, creditPaise: 150000 });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(formatPaise(150000));
  });
  it("has no warnings for an empty account or an unknown balance", () => {
    expect(deletionWarnings({ openJobs: 0, creditPaise: 0 })).toEqual([]);
    expect(deletionWarnings({ openJobs: 0, creditPaise: null })).toEqual([]);
  });
});

describe("shouldDiscardPendingEmployerProfile", () => {
  it("drops the stash only on validation failures", () => {
    expect(shouldDiscardPendingEmployerProfile(400)).toBe(true);
    expect(shouldDiscardPendingEmployerProfile(422)).toBe(true);
  });
  it("keeps it on transient or account-state errors", () => {
    for (const s of [401, 403, 409, 429, 500, 503]) expect(shouldDiscardPendingEmployerProfile(s)).toBe(false);
  });
});
