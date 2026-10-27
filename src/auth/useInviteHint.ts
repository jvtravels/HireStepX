"use client";
import { useEffect, useState } from "react";

export interface InviteHint {
  email: string;
  companyName: string;
  inviterName: string | null;
}

/* The unauthenticated, token-gated preview, so signup can show who invited you and
 * pre-fill the address the invite was sent to. Accepting requires that exact email,
 * so letting people type a different one only moves the failure to the next screen.
 * Only a still-pending invite yields a hint; the join page explains dead ones. */
export function useInviteHint(token: string | null): InviteHint | null {
  const [hint, setHint] = useState<InviteHint | null>(null);

  useEffect(() => {
    if (!token) { setHint(null); return; }
    const ctl = new AbortController();
    fetch(`/api/employer-team-accept?token=${encodeURIComponent(token)}`, { signal: ctl.signal })
      .then(async (res) => (res.ok ? ((await res.json().catch(() => null)) as Record<string, unknown> | null) : null))
      .then((d) => {
        if (!d || d.state !== "pending" || typeof d.email !== "string" || typeof d.companyName !== "string") return;
        setHint({
          email: d.email,
          companyName: d.companyName,
          inviterName: typeof d.inviterName === "string" ? d.inviterName : null,
        });
      })
      .catch(() => { /* purely a convenience; the form works without it */ });
    return () => ctl.abort();
  }, [token]);

  return hint;
}
