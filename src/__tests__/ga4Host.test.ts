import { describe, it, expect } from "vitest";
import { isGa4Host } from "../../app/_ga4-script";

describe("isGa4Host", () => {
  it("allows the production apex and www hosts", () => {
    expect(isGa4Host("hirestepx.com")).toBe(true);
    expect(isGa4Host("www.hirestepx.com")).toBe(true);
    expect(isGa4Host("HireStepX.com")).toBe(true);
  });

  it("blocks staging, previews, localhost and lookalike hosts", () => {
    expect(isGa4Host("staging.hirestepx.com")).toBe(false);
    expect(isGa4Host("hirestepx-git-main-jvtravels.vercel.app")).toBe(false);
    expect(isGa4Host("localhost")).toBe(false);
    expect(isGa4Host("hirestepx.com.evil.example")).toBe(false);
  });
});
