// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmptyState from "@/components/EmptyState";

describe("EmptyState pageLevel", () => {
  it("exposes the title as the page's H1 when pageLevel is set", () => {
    render(<EmptyState title="We couldn't find that page" pageLevel />);
    expect(screen.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeTruthy();
  });

  it("leaves the title as plain text by default", () => {
    render(<EmptyState title="Nothing here yet" />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
