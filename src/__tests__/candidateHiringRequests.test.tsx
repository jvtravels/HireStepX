import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CandidateRequestsCard, { hiringInputsFor, hiringReplyText, validateHiringValue } from "../CandidateRequestsCard";

const updateUser = vi.fn();
const resolveCandidateRequest = vi.fn();
let resumeData: Record<string, unknown> | null = null;
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", resumeData, portfolioLinks: [] }, updateUser }),
}));
vi.mock("../employerActions", () => ({
  REQUEST_REPLY_MAX: 500,
  resolveCandidateRequest: (...a: unknown[]) => resolveCandidateRequest(...a),
}));

const hiringRequest = {
  id: "r2", kind: "contact" as const, headline: "Hiring details: notice period and expected CTC",
  fields: ["notice_period", "expected_ctc"], note: null, createdAt: new Date().toISOString(),
};

function renderCard(request = hiringRequest) {
  const onResolved = vi.fn();
  const onError = vi.fn();
  render(<CandidateRequestsCard matchId="m1" requests={[request]} unlocked={false} onResolved={onResolved} onError={onError} />);
  return { onResolved, onError };
}

describe("hiring request helpers", () => {
  it("lists only the hiring facts that were asked for, in display order", () => {
    expect(hiringInputsFor(["expected_ctc", "phone", "notice_period"])).toEqual(["notice_period", "expected_ctc"]);
    expect(hiringInputsFor(["phone"])).toEqual([]);
    expect(hiringInputsFor(null)).toEqual([]);
  });

  it("reads a bare CTC number as LPA and rejects text without a figure", () => {
    expect(validateHiringValue("current_ctc", "18")).toEqual({ value: "18 LPA" });
    expect(validateHiringValue("expected_ctc", "22.5")).toEqual({ value: "22.5 LPA" });
    expect(validateHiringValue("expected_ctc", "₹24 lakh")).toEqual({ value: "₹24 lakh" });
    expect(validateHiringValue("expected_ctc", "negotiable")).toHaveProperty("error");
    expect(validateHiringValue("current_ctc", "  ")).toHaveProperty("error");
  });

  it("accepts Immediate or a number of days for notice period", () => {
    expect(validateHiringValue("notice_period", "Immediate")).toEqual({ value: "Immediate" });
    expect(validateHiringValue("notice_period", " 30   days ")).toEqual({ value: "30 days" });
    expect(validateHiringValue("notice_period", "soon")).toHaveProperty("error");
  });

  it("builds the reply the employer reads", () => {
    expect(hiringReplyText({ expected_ctc: "24 LPA", notice_period: "30 days" })).toBe("Notice period: 30 days · Expected CTC: 24 LPA");
  });
});

describe("CandidateRequestsCard hiring request", () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue(undefined);
    resolveCandidateRequest.mockReset().mockResolvedValue({ ok: true });
    resumeData = { _type: "ai", name: "A", noticePeriod: null, currentCtc: "18 LPA", expectedCtc: null };
  });

  it("shows only the asked inputs, prefilled from saved hiring details", () => {
    renderCard();
    expect(screen.getByLabelText("Notice period")).toBeTruthy();
    expect(screen.getByLabelText("Expected CTC")).toBeTruthy();
    expect(screen.queryByLabelText("Current CTC")).toBeNull();
    expect(screen.queryByLabelText("Phone number")).toBeNull();
  });

  it("blocks an empty submit", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBe(2));
    expect(resolveCandidateRequest).not.toHaveBeenCalled();
  });

  it("saves to the profile and sends the figures in the reply", async () => {
    const { onResolved } = renderCard();
    fireEvent.change(screen.getByLabelText("Notice period"), { target: { value: "30 days" } });
    fireEvent.change(screen.getByLabelText("Expected CTC"), { target: { value: "24" } });
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("r2", "fulfilled"));
    expect(updateUser).toHaveBeenCalledWith({
      resumeData: expect.objectContaining({ noticePeriod: "30 days", expectedCtc: "24 LPA", currentCtc: "18 LPA" }),
    });
    expect(resolveCandidateRequest).toHaveBeenCalledWith("m1", "r2", "fulfilled", "Notice period: 30 days · Expected CTC: 24 LPA");
  });

  it("still replies when the resume cannot hold the facts", async () => {
    resumeData = { _type: "fallback", name: "A", phone: "", linkedin: "" };
    const { onResolved } = renderCard();
    fireEvent.change(screen.getByLabelText("Notice period"), { target: { value: "Immediate" } });
    fireEvent.change(screen.getByLabelText("Expected CTC"), { target: { value: "20 LPA" } });
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(updateUser).not.toHaveBeenCalled();
    expect(resolveCandidateRequest).toHaveBeenCalledWith("m1", "r2", "fulfilled", "Notice period: Immediate · Expected CTC: 20 LPA");
  });

  it("declines without validating or saving", async () => {
    const { onResolved } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("r2", "declined"));
    expect(updateUser).not.toHaveBeenCalled();
  });
});
