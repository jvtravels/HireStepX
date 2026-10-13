import { describe, it, expect } from "vitest";
import {
  CONSENT_METADATA_KEY,
  consentDoneKey,
  consentFromUserMetadata,
  currentSignupConsent,
  parsePendingConsent,
  resolveConsentToRecord,
} from "../_consent-record";
import { TERMS_PRIVACY_CONSENT_VERSION, TERMS_PRIVACY_PURPOSE } from "../../data/legal-versions";

describe("signup consent record resolution", () => {
  it("current consent carries the shared purpose and version constant", () => {
    expect(currentSignupConsent()).toEqual({ purpose: TERMS_PRIVACY_PURPOSE, version: TERMS_PRIVACY_CONSENT_VERSION });
    expect(TERMS_PRIVACY_CONSENT_VERSION).toBe("2026-10-11");
  });

  it("parses a pending flag and rejects malformed ones", () => {
    expect(parsePendingConsent(JSON.stringify({ purpose: "terms_privacy", version: "v" }))).toEqual({ purpose: "terms_privacy", version: "v" });
    expect(parsePendingConsent("nope")).toBeNull();
    expect(parsePendingConsent(JSON.stringify({ purpose: 1 }))).toBeNull();
    expect(parsePendingConsent(null)).toBeNull();
  });

  it("falls back to the signup metadata stamp (cross-device verification)", () => {
    expect(consentFromUserMetadata({ [CONSENT_METADATA_KEY]: "2026-10-11" })).toEqual({ purpose: "terms_privacy", version: "2026-10-11" });
    expect(consentFromUserMetadata({})).toBeNull();
    expect(consentFromUserMetadata(null)).toBeNull();
  });

  it("prefers the pending flag over metadata, and returns null when neither exists", () => {
    const pending = JSON.stringify({ purpose: "terms_privacy", version: "pending-v" });
    expect(resolveConsentToRecord(pending, { [CONSENT_METADATA_KEY]: "meta-v" })?.version).toBe("pending-v");
    expect(resolveConsentToRecord(null, { [CONSENT_METADATA_KEY]: "meta-v" })?.version).toBe("meta-v");
    expect(resolveConsentToRecord(null, {})).toBeNull();
  });

  it("done key is scoped per user, purpose and version", () => {
    expect(consentDoneKey("u1", { purpose: "p", version: "v" })).not.toBe(consentDoneKey("u2", { purpose: "p", version: "v" }));
  });
});
