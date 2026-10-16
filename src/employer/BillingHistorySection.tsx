"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OutlineCta } from "@/employer/_atoms";
import { useEmployerData, type UnlockPurchase } from "@/employer/EmployerDataContext";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { formatPaise } from "../../server-handlers/_unlock-pricing";

function describe(p: UnlockPurchase): string {
  const names = p.candidates.map((c) => c.name).filter((n): n is string => !!n);
  if (names.length > 0) return names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
  return p.matchIds.length > 1 ? `Batch of ${p.matchIds.length} candidates` : "Single candidate";
}

export default function BillingHistorySection() {
  const { fetchUnlockHistory } = useEmployerData();
  const [purchases, setPurchases] = useState<UnlockPurchase[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setPurchases(null);
    void fetchUnlockHistory().then((res) => {
      if (res == null) setFailed(true);
      else setPurchases(res);
    });
  }, [fetchUnlockHistory]);

  useEffect(() => { load(); }, [load]);

  if (failed) {
    return (
      <InlineNotice tone="error" title="Couldn't load your billing history" action={<OutlineCta size="sm" onClick={load}>Try again</OutlineCta>}>
        Check your connection and try again.
      </InlineNotice>
    );
  }
  if (purchases == null) {
    return (
      <div className="grid gap-2.5" aria-busy="true">
        <span className="sr-only">Loading billing history</span>
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    );
  }
  if (purchases.length === 0) {
    return <p className="m-0 text-[13px] text-hx-ink-soft">No purchases yet. Contact unlocks you buy will be listed here.</p>;
  }
  return (
    <Table className="mx-fade">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Candidates</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="whitespace-nowrap tabular-nums">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
            <TableCell className="max-w-[260px] truncate">{describe(p)}</TableCell>
            <TableCell className="tabular-nums text-hx-ink-soft">{p.invoiceNo ?? "None"}</TableCell>
            <TableCell className="text-right tabular-nums">
              {p.amount === 0 ? "Complimentary" : formatPaise(p.amount)}
              {p.refundedAt ? <span className="ml-1.5 text-hx-ink-soft">(refunded)</span> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
