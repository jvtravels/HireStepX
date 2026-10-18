"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OutlineCta } from "@/employer/_atoms";
import { useEmployerData, type CreditSummary, type UnlockPurchase } from "@/employer/EmployerDataContext";
import { canIssueCreditNote, isPartiallyRefundedPurchase, isRefundedPurchase, openInvoice, purchaseAmountLabel, purchaseAmounts, type InvoiceInput } from "@/employer/_invoiceHtml";
import { LEGAL_ENTITY } from "../../data/legal-entity";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { formatPaise } from "../../server-handlers/_unlock-pricing";

function describe(p: UnlockPurchase): string {
  const names = p.candidates.map((c) => c.name).filter((n): n is string => !!n);
  if (names.length > 0) return names.length > 2 ? `${names.slice(0, 2).join(", ")} and ${names.length - 2} more` : names.join(", ");
  return p.matchIds.length > 1 ? `Batch of ${p.matchIds.length} candidates` : "Single candidate";
}

export default function BillingHistorySection() {
  const { fetchUnlockHistory, fetchCredit, companyName, companyGstin, companyBillingName, requirements } = useEmployerData();
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
  const liveSupplier = { name: LEGAL_ENTITY.name, address: LEGAL_ENTITY.address, gstin: LEGAL_ENTITY.gstin, sac: LEGAL_ENTITY.sac };
  // A purchase with a snapshot is judged and rendered by the supplier it was issued under, not today's env.
  const supplierFor = (p: UnlockPurchase) => p.invoiceSnapshot?.supplier ?? liveSupplier;
  const showDocument = (p: UnlockPurchase, document: InvoiceInput["document"], creditNote: InvoiceInput["creditNote"] = null) => {
    const { cashPaise, creditPaise } = purchaseAmounts(p);
    openInvoice({
      invoiceNo: p.invoiceNo ?? null,
      createdAt: p.createdAt,
      orderId: p.orderId ?? null,
      candidateNames: p.candidates.map((c) => c.name).filter((n): n is string => !!n),
      candidateCount: p.matchIds.length,
      cashPaise,
      creditPaise,
      refunded: isRefundedPurchase(p),
      refundedAt: p.refundedAt ?? null,
      jobTitle: requirements.find((r) => r.id === p.requirementId)?.title ?? null,
      document,
      partialRefundPaise: p.partialRefundPaise ?? 0,
      partialRefundAt: p.partialRefundAt ?? null,
      creditNote,
      snapshot: p.invoiceSnapshot ?? null,
      supplier: liveSupplier,
      buyer: { companyName, billingName: companyBillingName, gstin: companyGstin },
    });
  };
  const linkClass = "cursor-pointer border-0 bg-transparent p-0 text-[13px] text-hx-ink-soft underline underline-offset-2 hover:text-hx-coal";
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
            <TableCell className="tabular-nums text-hx-ink-soft">{purchaseAmounts(p).cashPaise === 0 ? "Credit redemption" : p.invoiceNo ?? "None"}</TableCell>
            <TableCell className="text-right tabular-nums">
              {purchaseAmountLabel(p)}
              {isRefundedPurchase(p) ? <span className="ml-1.5 text-hx-ink-soft">(refunded)</span> : isPartiallyRefundedPurchase(p) ? <span className="ml-1.5 text-hx-ink-soft">(partially refunded)</span> : null}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right">
              {purchaseAmounts(p).totalPaise > 0 && (p.invoiceNo || purchaseAmounts(p).cashPaise === 0) ? (
                <button type="button" className={linkClass} onClick={() => showDocument(p, "invoice")}>{purchaseAmounts(p).cashPaise === 0 || !supplierFor(p).gstin ? "View receipt" : "View invoice"}</button>
              ) : null}
              {canIssueCreditNote(p, supplierFor(p)) ? (
                (p.creditNotes?.length ?? 0) > 0 ? (
                  p.creditNotes?.map((n) => (
                    <button key={n.no} type="button" className={`${linkClass} ml-3`} onClick={() => showDocument(p, "credit_note", n)}>
                      {(p.creditNotes?.length ?? 0) > 1 ? `Credit note ${n.no}` : "Credit note"}
                    </button>
                  ))
                ) : (
                  <button type="button" className={`${linkClass} ml-3`} onClick={() => showDocument(p, "credit_note")}>Credit note</button>
                )
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>
  );
}
