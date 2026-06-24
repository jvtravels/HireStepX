import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpgradeModal } from "../dashboardComponents";

// Mock supabase
vi.mock("../supabase", () => ({
  authHeaders: vi.fn(() => Promise.resolve({ "Content-Type": "application/json" })),
}));

// Mock AuthContext
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

describe("UpgradeModal", () => {
  const defaultProps = {
    onClose: vi.fn(),
    sessionsUsed: 3,
    user: { id: "u1", email: "test@test.com", name: "Test" },
    currentTier: "free",
    onPaymentSuccess: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it("renders all three plan options", () => {
    render(<UpgradeModal {...defaultProps} />);

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Sprint Pack")).toBeInTheDocument();
    // Per session is rendered as the interactive slider card (null slot),
    // not as a named plan card. Monthly plan is hidden (hidden: true).
    expect(screen.getByText("Per Session")).toBeInTheDocument();
  });

  it("shows current plan indicator for free tier", () => {
    render(<UpgradeModal {...defaultProps} />);
    expect(screen.getByText(/on this plan/)).toBeInTheDocument();
  });

  it("shows title in header", () => {
    render(<UpgradeModal {...defaultProps} />);
    expect(screen.getByText("Choose your plan")).toBeInTheDocument();
  });

  it("has role=dialog and aria-modal for accessibility", () => {
    render(<UpgradeModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape key", () => {
    render(<UpgradeModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("closes when clicking overlay backdrop", () => {
    render(<UpgradeModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not close when clicking modal content", () => {
    render(<UpgradeModal {...defaultProps} />);
    fireEvent.click(screen.getByText("Choose your plan"));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("shows checkout buttons for non-current plans", () => {
    render(<UpgradeModal {...defaultProps} />);
    expect(screen.getByText(/Get Sprint Pack/)).toBeInTheDocument();
    // Monthly plan is hidden (hidden: true) — no "Go monthly" button rendered.
  });

  it("offers a single-session (₹9) purchase option", () => {
    render(<UpgradeModal {...defaultProps} />);
    // The interactive slider card shows "Buy 1 session" (for qty=1).
    expect(screen.getByText(/Buy 1 session/)).toBeInTheDocument();
  });

  it("marks starter as current when user is on starter plan", () => {
    render(<UpgradeModal {...defaultProps} currentTier="starter" />);
    // Sprint Pack header copy switches to top-up messaging for starter users
    expect(screen.getByText(/Top up sessions/)).toBeInTheDocument();
  });

  it("shows Razorpay footer text", () => {
    render(<UpgradeModal {...defaultProps} />);
    expect(screen.getByText(/Razorpay/)).toBeInTheDocument();
  });
});
