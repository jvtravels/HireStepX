// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TablePaginationFooter } from "../components/TablePaginationFooter";

const base = { entityLabel: "job", rowsPerPage: 10, onRowsPerPageChange: vi.fn(), page: 1, onPageChange: vi.fn() };

describe("TablePaginationFooter", () => {
  it("shows only the count when everything fits on one page", () => {
    render(<TablePaginationFooter {...base} totalCount={8} filteredCount={8} totalPages={1} />);
    expect(screen.getByText("8 jobs total")).toBeTruthy();
    expect(screen.queryByText("Rows per page")).toBeNull();
    expect(screen.queryByLabelText("Go to next page")).toBeNull();
  });

  it("shows paging controls once rows exceed the smallest page size", () => {
    render(<TablePaginationFooter {...base} totalCount={25} filteredCount={25} totalPages={3} />);
    expect(screen.getByText("Rows per page")).toBeTruthy();
    expect(screen.getByLabelText("Go to next page")).toBeTruthy();
  });
});
