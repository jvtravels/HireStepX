import { describe, it, expect } from "vitest";
import {
  deleteSucceeded,
  extractAttachmentPaths,
  mustRetainEmployerFinancials,
  anonymisedAuthEmail,
  anonymisedEmployerPatch,
} from "../../server-handlers/_delete-account-helpers";

describe("deleteSucceeded", () => {
  it("accepts ok responses", () => {
    expect(deleteSucceeded("sessions", 200, true)).toBe(true);
  });
  it("tolerates 404 only for agency tables from migration 0032", () => {
    expect(deleteSucceeded("employer_blocks", 404, false)).toBe(true);
    expect(deleteSucceeded("requirement_matches", 404, false)).toBe(true);
    expect(deleteSucceeded("sessions", 404, false)).toBe(false);
  });
  it("rejects other failures even on agency tables", () => {
    expect(deleteSucceeded("employer_blocks", 500, false)).toBe(false);
  });
});

describe("extractAttachmentPaths", () => {
  it("dedupes and drops empty / non-string / traversal paths", () => {
    expect(
      extractAttachmentPaths([{ attachment_path: "a/b.pdf" }, { attachment_path: "a/b.pdf" }, { attachment_path: "" }, { attachment_path: null }, { attachment_path: "../x" }, null, {}]),
    ).toEqual(["a/b.pdf"]);
  });
  it("returns [] for non-arrays", () => {
    expect(extractAttachmentPaths(null)).toEqual([]);
    expect(extractAttachmentPaths({})).toEqual([]);
  });
});

describe("mustRetainEmployerFinancials", () => {
  it("retains when any payment or order exists", () => {
    expect(mustRetainEmployerFinancials({ payments: 1, orders: 0 })).toBe(true);
    expect(mustRetainEmployerFinancials({ payments: 0, orders: 2 })).toBe(true);
  });
  it("does not retain with no financial rows", () => {
    expect(mustRetainEmployerFinancials({ payments: 0, orders: 0 })).toBe(false);
  });
});

describe("anonymisation", () => {
  it("builds a non-routable email and strips unsafe characters", () => {
    expect(anonymisedAuthEmail("abc-123")).toBe("deleted-abc-123@deleted.invalid");
    expect(anonymisedAuthEmail("a/b@c")).toBe("deleted-abc@deleted.invalid");
  });
  it("clears identity columns but keeps tax-invoice fields untouched", () => {
    const patch = anonymisedEmployerPatch("2026-10-10T00:00:00Z");
    expect(patch).toMatchObject({ company_name: "", website: "", logo_path: null, suspended_at: "2026-10-10T00:00:00Z" });
    expect(patch).not.toHaveProperty("gstin");
    expect(patch).not.toHaveProperty("billing_name");
  });
});
