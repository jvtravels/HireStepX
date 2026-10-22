import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorPanel, InWhiteCardProvider, StatePanel } from "../employer/_consoleParts";
import { EmptyNote, ErrorRetry } from "../employer/_requirementAtoms";

const card = (el: HTMLElement) => el.closest("[class*='bg-white']");

describe("employer StatePanel", () => {
  it("draws its own white container by default and centres its content", () => {
    render(<StatePanel title="Nothing here" message="Add something." />);
    const heading = screen.getByText("Nothing here");
    expect(card(heading)).not.toBeNull();
    expect(heading.closest("[data-slot='empty']")?.className).toContain("justify-center");
  });

  it("does not draw a second container inside a page the shell already wraps", () => {
    render(<InWhiteCardProvider value><StatePanel title="Nothing here" message="Add something." /></InWhiteCardProvider>);
    expect(card(screen.getByText("Nothing here"))).toBeNull();
  });

  it("lets a caller that owns the card opt out", () => {
    render(<StatePanel contained={false} title="Nothing here" message="Add something." />);
    expect(card(screen.getByText("Nothing here"))).toBeNull();
  });

  it("announces errors and wires the retry", () => {
    const retry = vi.fn();
    render(<ErrorPanel title="We couldn't load it" message="Try again." onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load it");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders the legacy ErrorRetry and EmptyNote through the same panel", () => {
    render(
      <>
        <ErrorRetry title="Broken" message="Oops" onRetry={() => {}} />
        <EmptyNote title="Empty" action={<a href="/x">Go</a>}>Nothing yet.</EmptyNote>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Broken");
    expect(screen.getByText("Empty").closest("[data-slot='empty']")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Go" })).toBeInTheDocument();
  });
});
