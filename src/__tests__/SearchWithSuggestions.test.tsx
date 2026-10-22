import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchWithSuggestions } from "../components/SearchWithSuggestions";

describe("SearchWithSuggestions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderInput(overrides: Partial<React.ComponentProps<typeof SearchWithSuggestions>> = {}) {
    const onChange = vi.fn();
    const props = {
      id: "search",
      label: "Search jobs",
      value: "",
      onChange,
      placeholder: "Search by title or company",
      storageKey: "test-search-key",
      ...overrides,
    };
    const utils = render(<SearchWithSuggestions {...props} />);
    return { ...utils, onChange };
  }

  it("renders the underlying search input", () => {
    renderInput();
    expect(screen.getByPlaceholderText("Search by title or company")).toBeInTheDocument();
  });

  it("does not show a dropdown when focused with no recent searches or suggested filters", () => {
    renderInput();
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggested filters")).not.toBeInTheDocument();
  });

  it("shows recent searches in the dropdown when focused", () => {
    window.localStorage.setItem("test-search-key", JSON.stringify(["backend engineer"]));
    renderInput();
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByText("backend engineer")).toBeInTheDocument();
  });

  it("shows suggested filter chips when focused", () => {
    const apply = vi.fn();
    renderInput({ suggestedFilters: [{ label: "Remote", apply }] });
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    expect(screen.getByText("Suggested filters")).toBeInTheDocument();
    expect(screen.getByText("+ Remote")).toBeInTheDocument();
  });

  it("commits the current value and blurs on Enter", () => {
    renderInput({ value: "product manager" });
    const input = screen.getByPlaceholderText("Search by title or company") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(JSON.parse(window.localStorage.getItem("test-search-key") || "[]")).toEqual(["product manager"]);
  });

  it("clicking a recent search fills the input and closes the dropdown", () => {
    window.localStorage.setItem("test-search-key", JSON.stringify(["frontend engineer"]));
    const { onChange } = renderInput();
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    const option = screen.getByText("frontend engineer");
    fireEvent.mouseDown(option);
    expect(onChange).toHaveBeenCalledWith("frontend engineer");
    expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
  });

  it("clicking a suggested filter applies it and closes the dropdown", () => {
    const apply = vi.fn();
    renderInput({ suggestedFilters: [{ label: "Remote", apply }] });
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText("+ Remote"));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Suggested filters")).not.toBeInTheDocument();
  });

  it("closes the dropdown on blur after its delay", async () => {
    window.localStorage.setItem("test-search-key", JSON.stringify(["qa engineer"]));
    renderInput();
    const input = screen.getByPlaceholderText("Search by title or company");
    fireEvent.focus(input);
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.queryByText("Recent searches")).not.toBeInTheDocument();
    });
  });
});
