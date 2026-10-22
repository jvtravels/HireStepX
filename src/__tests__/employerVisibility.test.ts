// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  describeHistoryEntry, dismissVisibilityNotice, isVisibilityNoticeDismissed, viewedLabel,
} from "../employerVisibility";

describe("employerVisibility helpers", () => {
  beforeEach(() => localStorage.clear());

  it("pluralises the 30-day viewed stat", () => {
    expect(viewedLabel(0)).toMatch(/^No employers/);
    expect(viewedLabel(1)).toMatch(/^1 employer viewed/);
    expect(viewedLabel(4)).toMatch(/^4 employers viewed/);
  });

  it("describes consent history entries with source", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    const granted = describeHistoryEntry({ action: "granted", createdAt: "2026-10-01T00:00:00Z", source: "settings" }, now);
    expect(granted).toContain("Allowed employer discovery");
    expect(granted).toContain("via Settings");
    const withdrawn = describeHistoryEntry({ action: "withdrawn", createdAt: "not-a-date", source: "mystery" }, now);
    expect(withdrawn).toBe("Turned off employer discovery");
  });

  it("includes the year only for old entries", () => {
    const now = Date.parse("2026-10-10T00:00:00Z");
    expect(describeHistoryEntry({ action: "granted", createdAt: "2024-01-05T00:00:00Z", source: "system" }, now)).toContain("2024");
    expect(describeHistoryEntry({ action: "granted", createdAt: "2026-09-05T00:00:00Z", source: "system" }, now)).not.toContain("2026");
  });

  it("remembers notice dismissal", () => {
    expect(isVisibilityNoticeDismissed()).toBe(false);
    dismissVisibilityNotice();
    expect(isVisibilityNoticeDismissed()).toBe(true);
  });
});
