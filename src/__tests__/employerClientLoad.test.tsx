import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { writeFileSync } from "node:fs";

/* Client-side load behaviour of the employer data layer on a virtual clock:
 * every API call takes LATENCY_MS, so elapsed / LATENCY_MS is the number of
 * sequential round trips the screen waits for, and the call log shows what a
 * navigation re-requests. */

vi.mock("@/supabase", () => ({ authHeaders: vi.fn().mockResolvedValue({}) }));
vi.mock("../errorReporter", () => ({ reportHandledError: vi.fn() }));
vi.mock("@/apiClient", () => ({ apiFetch: vi.fn(async () => ({ ok: true, status: 200, data: { id: "m1", candidateStatus: "shortlisted" }, error: null, errorData: null })) }));
vi.mock("@/posthogClient", () => ({ captureClientEvent: vi.fn() }));

import { EmployerDataProvider, useEmployerData } from "../employer/EmployerDataContext";

const LATENCY_MS = 80;
let log: string[] = [];

let totalMatched = 1;

function install() {
  log = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = String(input);
    log.push(url.split("?")[0] + (url.includes("&page=") ? "?page" : ""));
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    const body = url.startsWith("/api/employer-profile")
      ? { status: "approved", companyName: "Acme", verificationTier: "basic" }
      : url.startsWith("/api/employer-requirements")
        ? { requirements: [{ id: "req-1", title: "Dev", aiScreening: { evaluated: totalMatched, totalMatched } }], total: 1 }
        : url.startsWith("/api/employer-requirement-detail")
          ? { id: "req-1", title: "Dev", candidates: [{ id: "m1", unlocked: false }], total: 1, nextPage: null }
          : {};
    return new Response(JSON.stringify(body), { status: 200 });
  }));
}

let ctx: ReturnType<typeof useEmployerData> | null = null;
function Probe() { ctx = useEmployerData(); return <span data-loaded={String(!ctx.companyStatusLoading && !ctx.requirementsLoading)} />; }

const results: string[] = [];

beforeEach(() => { vi.useFakeTimers(); totalMatched = 1; install(); ctx = null; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function settle(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }

describe("employer client load (virtual clock, 80 ms per call)", () => {
  it("first paint of the jobs list needs profile then requirements", async () => {
    const start = Date.now();
    const { container } = render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    let trips = 0;
    while (container.querySelector("[data-loaded=false]") && trips < 10) { await settle(LATENCY_MS); trips++; }
    expect(container.querySelector("[data-loaded=true]")).not.toBeNull();
    const t = Math.round((Date.now() - start) / LATENCY_MS);
    results.push(`app start -> jobs list ready | ${t} sequential trips | ${log.length} calls | ${t * LATENCY_MS} ms`);
    expect(t).toBeLessThanOrEqual(1);
  });

  it("opening the same job twice (job page, then candidate page)", async () => {
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    log.length = 0;
    const first = ctx!.fetchRequirementDetail("req-1", { onFirstPage: () => {} });
    await settle(LATENCY_MS * 2);
    await first;
    const afterFirst = log.length;
    const second = ctx!.fetchRequirementDetail("req-1");
    await settle(LATENCY_MS * 2);
    await second;
    results.push(`open job then candidate page | detail calls: first open ${afterFirst}, second open ${log.length - afterFirst}`);
    expect(log.length - afterFirst).toBe(0);
  });

  const detailCalls = () => log.filter((u) => u.startsWith("/api/employer-requirement-detail")).length;

  it("a prefetch on hover is joined by the click instead of fetching twice", async () => {
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    log.length = 0;
    ctx!.prefetchRequirementDetail("req-1");
    await settle(150 + 10);
    const click = ctx!.fetchRequirementDetail("req-1");
    await settle(LATENCY_MS * 2);
    expect((await click)?.id).toBe("req-1");
    expect(detailCalls()).toBe(1);
  });

  it("only the row the pointer rests on is prefetched", async () => {
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    log.length = 0;
    ctx!.prefetchRequirementDetail("req-a");
    await settle(50);
    ctx!.prefetchRequirementDetail("req-b");
    await settle(150 + LATENCY_MS * 2);
    expect(log.filter((u) => u.includes("employer-requirement-detail"))).toHaveLength(1);
  });

  it("fresh bypasses the cache and a candidate update invalidates it", async () => {
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    const open = async (fresh = false) => { const p = ctx!.fetchRequirementDetail("req-1", { fresh }); await settle(LATENCY_MS * 2); return p; };
    await open();
    log.length = 0;
    await open();
    expect(detailCalls()).toBe(0);
    await open(true);
    expect(detailCalls()).toBe(1);
    await act(async () => { await ctx!.updateCandidateStatusResult("m1", { candidateStatus: "shortlisted" } as Parameters<ReturnType<typeof useEmployerData>["updateCandidateStatusResult"]>[1]); });
    log.length = 0;
    await open();
    expect(detailCalls()).toBe(1);
  });

  it("serves a cached job only for 30 seconds", async () => {
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    const open = async () => { const p = ctx!.fetchRequirementDetail("req-1"); await settle(LATENCY_MS * 2); return p; };
    await open();
    log.length = 0;
    await settle(29_000);
    await open();
    expect(detailCalls()).toBe(0);
    await settle(2_000);
    await open();
    expect(detailCalls()).toBe(1);
  });

  it("skips the small first-paint page when the list says the shortlist fits one full page", async () => {
    totalMatched = 40;
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    log.length = 0;
    const open = ctx!.fetchRequirementDetail("req-1", { onFirstPage: () => {} });
    await settle(LATENCY_MS * 3);
    await open;
    results.push(`open job, 40 matches | detail calls: ${detailCalls()}`);
    expect(detailCalls()).toBe(1);
  });

  it("keeps the small first-paint page for a shortlist bigger than one page", async () => {
    totalMatched = 300;
    render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
    await settle(LATENCY_MS * 3);
    log.length = 0;
    const open = ctx!.fetchRequirementDetail("req-1", { onFirstPage: () => {} });
    await settle(LATENCY_MS * 3);
    await open;
    expect(detailCalls()).toBeGreaterThanOrEqual(2);
  });

  describe("dashboard request", () => {
    const dashboardCalls = () => log.filter((u) => u.startsWith("/api/employer-dashboard")).length;
    afterEach(() => window.history.pushState({}, "", "/"));
    const load = async (range: 7 | 30 | 90) => {
      const p = ctx!.fetchDashboard(range);
      await settle(LATENCY_MS * 2);
      return p;
    };

    it("starts with the profile on /employer and is reused by the page's own fetch", async () => {
      window.history.pushState({}, "", "/employer");
      render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
      await settle(1);
      expect(dashboardCalls()).toBe(1);
      await settle(LATENCY_MS * 3);
      await load(30);
      expect(dashboardCalls()).toBe(1);
      await load(30);
      expect(dashboardCalls()).toBe(2);
    });

    it("does not reuse the early request for another range", async () => {
      window.history.pushState({}, "", "/employer");
      render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
      await settle(LATENCY_MS * 3);
      await load(7);
      expect(dashboardCalls()).toBe(2);
    });

    it("is not requested on other employer pages", async () => {
      window.history.pushState({}, "", "/employer/jobs");
      render(<EmployerDataProvider><Probe /></EmployerDataProvider>);
      await settle(LATENCY_MS * 3);
      expect(dashboardCalls()).toBe(0);
    });
  });

  it("prints the table", () => {
    const out = process.env.LATENCY_REPORT_CLIENT;
    if (out) writeFileSync(out, results.join("\n") + "\n");
    expect(results.length).toBeGreaterThan(0);
  });
});
