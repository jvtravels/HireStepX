"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OutlineCta } from "@/employer/_atoms";
import { useEmployerData, type CreditSummary, type UnlockPurchase } from "@/employer/EmployerDataContext";
import { openInvoice } from "@/employer/_invoiceHtml";
import { LEGAL_ENTITY } from "../../data/legal-entity";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { formatPaise } from "../../server-handlers/_unlock-pricing";

function describe(p: UnlockPurchase): string {
  const names = p.candidates.map((c) => c.name).filter((n): n is string => !!n);
  if (names.length > 0) return names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
  return p.matchIds.length > 1 ? `Batch of ${p.matchIds.length} candidates` : "Single candidate";
}

function amountLabel(p: UnlockPurchase): string {
  const credit = p.creditAppliedPaise ?? 0;
  if (p.amount === 0 && credit > 0) return `${formatPaise(credit)} credit`;
  if (p.amount === 0) return "Complimentary";
  return credit > 0 ? `${formatPaise(p.amount)} + ${formatPaise(credit)} credit` : formatPaise(p.amount);
}

export default function BillingHistorySection() {
  const { fetchUnlockHistory, fetchCredit, companyName, companyGstin, companyBillingName } = useEmployerData();
  const [purchases, setPurchases] = useState<UnlockPurchase[] | null>(null);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setPurchases(null);
    void fetchCredit().then(setCredit);
    void fetchUnlockHistory().then((res) => {
      if (res == null) setFailed(true);
      else setPurchases(res);
    });
  }, [fetchUnlockHistory, fetchCredit]);

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
  const creditPanel = credit && (credit.balancePaise > 0 || credit.events.length > 0) ? (
    <div className="mb-4 rounded-xl border border-hx-line p-3.5">
      <p className="m-0 text-[13px] font-semibold text-hx-coal">Account credit: {formatPaise(credit.balancePaise)}</p>
      <p className="m-0 mt-0.5 text-[12.5px] text-hx-ink-soft">Applied automatically to your next unlock. Added back when a candidate you paid for declines, withdraws, blocks you or doesn&apos;t reply within 14 days.</p>
      {credit.events.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-[12.5px] text-hx-ink-soft">
          {credit.events.slice(0, 5).map((e, idx) => (
            <li key={`${e.createdAt}-${idx}`} className="flex justify-between gap-3">
              <span>{new Date(e.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {e.label}</span>
              <span className="tabular-nums">{e.kind === "spend" ? "\u2212" : "+"}{formatPaise(e.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
  const showInvoice = (p: UnlockPurchase) => openInvoice({
    invoiceNo: p.invoiceNo ?? null,
    createdAt: p.createdAt,
    orderId: p.orderId ?? null,
    candidateNames: p.candidates.map((c) => c.name).filter((n): n is string => !!n),
    candidateCount: p.matchIds.length,
    cashPaise: p.amount,
    creditPaise: p.creditAppliedPaise ?? 0,
    refunded: !!p.refundedAt,
    supplier: { name: LEGAL_ENTITY.name, address: LEGAL_ENTITY.address, gstin: LEGAL_ENTITY.gstin },
    buyer: { companyName, billingName: companyBillingName, gstin: companyGstin },
  });
  if (purchases.length === 0) {
    return (
      <>
        {creditPanel}
        <p className="m-0 text-[13px] text-hx-ink-soft">No purchases yet. Contact unlocks you buy will be listed here.</p>
      </>
    );
  }
  return (
    <>
    {creditPanel}
    <Table className="mx-fade">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Candidates</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="w-px"><span className="sr-only">Invoice</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="whitespace-nowrap tabular-nums">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</TableCell>
            <TableCell className="max-w-[260px] truncate">{describe(p)}</TableCell>
            <TableCell className="tabular-nums text-hx-ink-soft">{p.invoiceNo ?? "None"}</TableCell>
            <TableCell className="text-right tabular-nums">
              {amountLabel(p)}
              {p.refundedAt ? <span className="ml-1.5 text-hx-ink-soft">(refunded)</span> : null}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
              {p.invoiceNo ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-hx-ink-soft underline underline-offset-2 hover:text-hx-coal" onClick={() => showInvoice(p)}>View invoice</button> : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  );
}
