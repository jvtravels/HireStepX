"use client";

/* Shared table-footer pagination bar — used by SessionsV2.tsx and
   DashboardJobs.tsx so both tables present rows-per-page + page nav in
   one consistent shape, with just the entity noun and row-count copy
   varying per page. */

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";
import { tokens as T, fonts as F } from "@/auth/_tokens";

export function TablePaginationFooter({
  entityLabel,
  entityLabelPlural,
  totalCount,
  filteredCount,
  rowsPerPage,
  rowsPerPageOptions = [10, 20, 30, 50],
  onRowsPerPageChange,
  page,
  totalPages,
  onPageChange,
}: {
  /* Singular noun for the count copy, e.g. "session" or "opportunity". */
  entityLabel: string;
  /* Irregular plural override, e.g. "opportunity" -> "opportunities".
     Defaults to entityLabel + "s". */
  entityLabelPlural?: string;
  totalCount: number;
  filteredCount: number;
  rowsPerPage: number;
  rowsPerPageOptions?: number[];
  onRowsPerPageChange: (rowsPerPage: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const plural = (n: number) => (n === 1 ? entityLabel : entityLabelPlural ?? `${entityLabel}s`);
  return (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
      <span style={{ fontFamily: F.sans, fontSize: 13, color: T.inkFaint }}>
        {filteredCount === totalCount
          ? `${totalCount} ${plural(totalCount)} total`
          : `Showing ${filteredCount} of ${totalCount} ${plural(totalCount)}`}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: F.sans, fontSize: 13, color: T.inkFaint }}>Rows per page</span>
          <Select value={String(rowsPerPage)} onValueChange={(v) => onRowsPerPageChange(Number(v))}>
            <SelectTrigger
              size="sm"
              style={{ borderRadius: 6, fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.inkFaint }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rowsPerPageOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: F.sans, fontSize: 13, fontWeight: 500, color: T.inkFaint }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Button variant="outline" size="icon-sm" aria-label="Go to first page" disabled={page <= 1} onClick={() => onPageChange(1)}>
              <ChevronsLeftIcon aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Go to previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Go to next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRightIcon aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Go to last page" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
              <ChevronsRightIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
