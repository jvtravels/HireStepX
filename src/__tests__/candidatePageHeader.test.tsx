import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CandidatePageHeader, { CandidatePageContainer, CandidatePagePanel } from "../CandidatePageHeader";

describe("CandidatePageHeader", () => {
  it("renders the title as the page h1 with an optional subtitle", () => {
    render(<CandidatePageHeader title="Sessions" subtitle="Review your practice." titleId="t1" />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Sessions" });
    expect(h1.id).toBe("t1");
    expect(screen.getByText("Review your practice.")).toBeTruthy();
  });

  it("omits the subtitle and actions slot when not provided", () => {
    const { container } = render(<CandidatePageHeader title="Jobs" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it("renders actions and wraps rather than overflowing", () => {
    const { container } = render(<CandidatePageHeader title="Jobs" actions={<button type="button">Start session</button>} />);
    expect(screen.getByRole("button", { name: "Start session" })).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).style.flexWrap).toBe("wrap");
  });

  it("applies per-screen padding and actions overrides", () => {
    const { container } = render(
      <CandidatePageHeader title="Jobs" padding="14px 16px" actionsStyle={{ flex: "1 1 100%" }} actions={<span>x</span>} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.padding).toBe("14px 16px");
    expect((root.lastElementChild as HTMLElement).style.flex).toBe("1 1 100%");
  });

  it("centers the container at the requested max width", () => {
    const { container } = render(<CandidatePageContainer maxWidth={720}><p>body</p></CandidatePageContainer>);
    expect((container.firstElementChild as HTMLElement).style.maxWidth).toBe("720px");
  });

  it("wraps children in the bordered panel", () => {
    const { container } = render(<CandidatePagePanel><p>body</p></CandidatePagePanel>);
    expect((container.firstElementChild as HTMLElement).style.overflow).toBe("hidden");
  });
});
