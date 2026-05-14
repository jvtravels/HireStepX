import { describe, it, expect } from "vitest";
import { detectDocumentRequest, stripDocumentRequest } from "../../server-handlers/_adversarial-detector";

describe("Bug 3: detectDocumentRequest", () => {
  it("flags an Aadhaar ask", () => {
    const r = detectDocumentRequest("Please share your Aadhaar and PAN card to proceed.");
    expect(r.violated).toBe(true);
    expect(r.phrases.length).toBeGreaterThan(0);
  });
  it("flags a payslip ask", () => {
    const r = detectDocumentRequest("Can you send over your recent payslip?");
    expect(r.violated).toBe(true);
  });
  it("flags 'please share your relieving letter'", () => {
    const r = detectDocumentRequest("Kindly share your relieving letter at the earliest.");
    expect(r.violated).toBe(true);
  });
  it("does NOT flag passing reference to BGV", () => {
    const r = detectDocumentRequest("In a real flow HR would conduct background verification later.");
    expect(r.violated).toBe(false);
  });
  it("does NOT flag a non-request mention", () => {
    expect(detectDocumentRequest("We discuss salary slips later in onboarding.").violated).toBe(false);
  });
  it("strips document-request sentences", () => {
    const orig = "Great. Please share your Aadhaar card. The offer is 22 LPA.";
    const out = stripDocumentRequest(orig);
    expect(out.toLowerCase()).not.toContain("aadhaar");
    expect(out).toContain("22 LPA");
  });
});
