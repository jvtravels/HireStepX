import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CandidateRequestsCard, { contactInputsFor, validateContactValue } from "../CandidateRequestsCard";

const updateUser = vi.fn();
const resolveCandidateRequest = vi.fn();
vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", resumeData: { _type: "fallback", name: "A", phone: "", linkedin: "" }, portfolioLinks: [] },
    updateUser,
  }),
}));
vi.mock("../employerActions", () => ({
  REQUEST_REPLY_MAX: 500,
  resolveCandidateRequest: (...a: unknown[]) => resolveCandidateRequest(...a),
}));

const contactRequest = {
  id: "r1", kind: "contact" as const, headline: "Contact details: phone number and LinkedIn profile",
  fields: ["phone", "linkedin"], note: null, createdAt: new Date().toISOString(),
};

function renderCard(onResolved = vi.fn(), onError = vi.fn()) {
  render(<CandidateRequestsCard matchId="m1" requests={[contactRequest]} unlocked={false} onResolved={onResolved} onError={onError} />);
  return { onResolved, onError };
}

describe("contact request helpers", () => {
  it("asks only for the requested inputs and never for email", () => {
    expect(contactInputsFor(["phone", "email"])).toEqual(["phone"]);
    expect(contactInputsFor(["email"])).toEqual([]);
    expect(contactInputsFor(null)).toEqual(["phone", "linkedin", "portfolio"]);
  });

  it("validates phone, LinkedIn and portfolio values", () => {
    expect(validateContactValue("phone", "+91 98765 43210")).toEqual({ value: "+91 98765 43210" });
    expect(validateContactValue("phone", "abc")).toHaveProperty("error");
    expect(validateContactValue("phone", "123")).toHaveProperty("error");
    expect(validateContactValue("linkedin", "linkedin.com/in/jay")).toEqual({ value: "https://linkedin.com/in/jay" });
    expect(validateContactValue("linkedin", "example.com/in/jay")).toHaveProperty("error");
    expect(validateContactValue("portfolio", "github.com/jay")).toEqual({ value: "https://github.com/jay" });
    expect(validateContactValue("portfolio", "nodots")).toHaveProperty("error");
    expect(validateContactValue("portfolio", "  ")).toHaveProperty("error");
  });
});

describe("CandidateRequestsCard contact request", () => {
  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue(undefined);
    resolveCandidateRequest.mockReset().mockResolvedValue({ ok: true });
  });

  it("shows inputs for the asked fields instead of a 'mark done' button", () => {
    renderCard();
    expect(screen.getByLabelText("Phone number")).toBeTruthy();
    expect(screen.getByLabelText("LinkedIn profile")).toBeTruthy();
    expect(screen.queryByLabelText("Portfolio or GitHub link")).toBeNull();
    expect(screen.queryByRole("button", { name: /mark done/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Share details" })).toBeTruthy();
  });

  it("blocks an empty submit and does not resolve the request", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBe(2));
    expect(updateUser).not.toHaveBeenCalled();
    expect(resolveCandidateRequest).not.toHaveBeenCalled();
  });

  it("saves the details onto the profile, then resolves the request", async () => {
    const { onResolved } = renderCard();
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+91 98765 43210" } });
    fireEvent.change(screen.getByLabelText("LinkedIn profile"), { target: { value: "linkedin.com/in/jay" } });
    fireEvent.click(screen.getByRole("button", { name: "Share details" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("r1", "fulfilled"));
    expect(updateUser).toHaveBeenCalledWith({
      resumeData: expect.objectContaining({ phone: "+91 98765 43210", linkedin: "https://linkedin.com/in/jay" }),
    });
    expect(resolveCandidateRequest).toHaveBeenCalledWith("m1", "r1", "fulfilled", "");
  });

  it("declining skips validation and saves nothing", async () => {
    const { onResolved } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("r1", "declined"));
    expect(updateUser).not.toHaveBeenCalled();
  });
});
