/* Audit fix 2026-05-21 — vesting schedule overlay (Product Lie #1).
 *
 * The 1,776 `equityVesting` strings in company-salary-overrides.ts are
 * uniformly hard-coded "4yr / 1yr cliff" — wrong for Walmart-owned
 * Flipkart, buyback-dependent unicorns (Razorpay/CRED/Zerodha), listed
 * cos (Swiggy/Zomato/Paytm), MNC India arms (Amazon back-loaded),
 * and IT-services (TCS/Infosys/etc. — no equity for ICs).
 *
 * The resolver-layer overlay (`data/company-vesting-overlay.ts`) maps
 * each company to the correct canonical schedule. This test pins down
 * that mapping for the headline cases called out in the audit. */
import { describe, it, expect } from "vitest";
import {
  resolveVestingSchedule,
  VESTING_SCHEDULES,
  VESTING_SCHEDULE_IDS,
} from "../../../data/company-vesting-overlay";

describe("vesting schedule overlay (audit fix #1)", () => {
  it("Flipkart resolves to Walmart RSU annual schedule", () => {
    const s = resolveVestingSchedule("Flipkart");
    expect(s.scheduleId).toBe("walmart-rsu-annual");
    expect(s.description).toMatch(/Walmart/i);
    expect(s.description).toMatch(/annual/i);
  });

  it("Myntra (Flipkart group) also resolves to Walmart RSU annual", () => {
    expect(resolveVestingSchedule("Myntra").scheduleId).toBe("walmart-rsu-annual");
  });

  it("Razorpay resolves to ESOP buyback-dependent", () => {
    const s = resolveVestingSchedule("Razorpay");
    expect(s.scheduleId).toBe("esop-buyback-dependent");
    expect(s.liquidityNote).toBeDefined();
    expect(s.liquidityNote).toMatch(/buyback/i);
  });

  it("Zerodha and CRED also resolve to ESOP buyback-dependent", () => {
    expect(resolveVestingSchedule("Zerodha").scheduleId).toBe("esop-buyback-dependent");
    expect(resolveVestingSchedule("CRED").scheduleId).toBe("esop-buyback-dependent");
  });

  it("PhonePe resolves to phonepe-flip-buyback (distinct buyback cadence)", () => {
    const s = resolveVestingSchedule("PhonePe");
    expect(s.scheduleId).toBe("phonepe-flip-buyback");
    expect(s.description).toMatch(/1,150 Cr|buyback/i);
  });

  it.each(["Swiggy", "Zomato", "Paytm", "Nykaa"])(
    "listed Indian product co %s resolves to listed-rsu-quarterly",
    (company) => {
      expect(resolveVestingSchedule(company).scheduleId).toBe("listed-rsu-quarterly");
    },
  );

  it.each(["TCS", "Infosys", "Wipro", "HCL", "LTIMindtree", "Tech Mahindra"])(
    "IT-services %s resolves to it-services-none (no equity)",
    (company) => {
      const s = resolveVestingSchedule(company);
      expect(s.scheduleId).toBe("it-services-none");
      expect(s.description).toMatch(/No equity|performance bonus/i);
    },
  );

  it("Amazon India resolves to back-loaded 5/15/40/40", () => {
    const s = resolveVestingSchedule("Amazon");
    expect(s.scheduleId).toBe("mnc-amazon-back-loaded");
    expect(s.description).toMatch(/5%.*15%.*40%/);
  });

  it("Google / Microsoft / Meta resolve to MNC Google-monthly", () => {
    expect(resolveVestingSchedule("Google").scheduleId).toBe("mnc-google-monthly");
    expect(resolveVestingSchedule("Microsoft").scheduleId).toBe("mnc-google-monthly");
    expect(resolveVestingSchedule("Meta").scheduleId).toBe("mnc-google-monthly");
  });

  it("unknown company falls through to tier default (US standard 4yr/1yr)", () => {
    // A truly unknown company name with no tier signal lands on the
    // safe US default. This guarantees the resolver never throws.
    const s = resolveVestingSchedule("Some Random Co XYZ");
    expect(VESTING_SCHEDULE_IDS).toContain(s.scheduleId);
  });

  it("null / empty company also resolves cleanly (safe US default)", () => {
    expect(resolveVestingSchedule(null).scheduleId).toBe("us-standard-4yr-cliff");
    expect(resolveVestingSchedule(undefined).scheduleId).toBe("us-standard-4yr-cliff");
    expect(resolveVestingSchedule("").scheduleId).toBe("us-standard-4yr-cliff");
  });

  it("every canonical schedule id has a definition", () => {
    for (const id of VESTING_SCHEDULE_IDS) {
      expect(VESTING_SCHEDULES[id]).toBeDefined();
      expect(VESTING_SCHEDULES[id].description.length).toBeGreaterThan(10);
    }
  });
});
