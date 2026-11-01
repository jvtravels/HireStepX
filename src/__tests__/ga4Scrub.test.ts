import { describe, it, expect } from "vitest";
import { buildGa4InitScript } from "../../app/_ga4-script";

describe("GA4 init script page address scrub", () => {
  it("is valid JavaScript and strips candidate and requirement ids", () => {
    const src = buildGa4InitScript("G-TEST");
    const calls: unknown[][] = [];
    const win: Record<string, unknown> = { addEventListener: () => {} };
    const loc = { href: "https://app.hirestepx.com/employer/requirements/abc123/candidates/xyz789?tab=notes" };
    const hist = { pushState: () => {}, replaceState: () => {} };
    const run = new Function("window", "localStorage", "location", "history", "dataLayer", src.replace("window.dataLayer = window.dataLayer || [];", ""));
    const dl: unknown[] = [];
    run(win, { getItem: () => null }, loc, hist, dl);
    dl.forEach((a) => calls.push(Array.from(a as ArrayLike<unknown>)));
    const config = calls.find((c) => c[0] === "config");
    expect((config?.[2] as { page_location: string }).page_location).toBe("https://app.hirestepx.com/employer/requirements/:id/candidates/:id?tab=notes");
  });
});
