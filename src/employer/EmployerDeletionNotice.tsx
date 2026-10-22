"use client";

import { formatPaise } from "../../server-handlers/_unlock-pricing";
import { CREDIT_ON_DELETION_SENTENCE } from "./_employerOffer";

/* What deleting an employer account does, shown inside the settings danger zone.
   The candidate copy ("removes your account and all data") would be wrong here:
   payment and order records are kept for tax, and open jobs, conversations and
   shortlists disappear for the candidates on the other side of them. */

export interface EmployerDeletionFacts {
  openJobs: number;
  /** null while the balance is loading or could not be read. */
  creditPaise: number | null;
}

export function deletionWarnings(facts: EmployerDeletionFacts): string[] {
  const out: string[] = [];
  if (facts.openJobs > 0) {
    out.push(`You have ${facts.openJobs} open ${facts.openJobs === 1 ? "job" : "jobs"}. ${facts.openJobs === 1 ? "It stops" : "They stop"} being matched to candidates, and nothing new can be posted until you restore the account.`);
  }
  if (facts.creditPaise !== null && facts.creditPaise > 0) {
    out.push(`You have ${formatPaise(facts.creditPaise)} of unspent account credit. ${CREDIT_ON_DELETION_SENTENCE}`);
  }
  return out;
}

export default function EmployerDeletionNotice({ facts }: { facts: EmployerDeletionFacts }) {
  const warnings = deletionWarnings(facts);
  return (
    <div className="mt-3 flex flex-col gap-3 text-[13px] leading-relaxed text-foreground">
      {warnings.length > 0 && (
        <ul role="list" className="m-0 flex list-none flex-col gap-1.5 p-0 font-medium text-destructive" aria-label="Before you delete">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <div>
        <p className="m-0 font-semibold">Erased when deletion completes</p>
        <ul className="m-0 mt-1 list-disc pl-5 text-muted-foreground">
          <li>Your company profile and logo, and every job you posted.</li>
          <li>Your shortlist and candidate statuses.</li>
          <li>Your conversations. Candidates lose the messages they exchanged with you.</li>
        </ul>
      </div>
      <div>
        <p className="m-0 font-semibold">Kept, anonymised, for tax</p>
        <ul className="m-0 mt-1 list-disc pl-5 text-muted-foreground">
          <li>Payment and order records, which we are required to keep. Your sign-in email is replaced, and your company name, website and logo are removed.</li>
          <li>The GSTIN and billing name printed on your invoices, for as long as tax law requires.</li>
        </ul>
      </div>
      <p className="m-0 text-muted-foreground">
        For 7 days your account is paused, not gone. Nothing can be posted, unlocked or messaged. Log in and restore it any time before then.
      </p>
    </div>
  );
}
