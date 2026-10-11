"use client";

/* One-time dashboard notice: employer discovery is on by default, so say what
   employers see and let the candidate keep it on or turn it off in one click.
   "Keep on" writes a 'granted' consent-log row, "Turn off" a 'withdrawn' one
   (both via /api/candidate-visibility). Closing the notice only marks it seen.
   The server decides whether it is still pending (never answered, not seen);
   localStorage additionally stops it reappearing on this device if the
   optional employer_notice_seen_at column isn't applied. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "./auth/_tokens";
import {
  DISCLOSURE_SUMMARY, dismissVisibilityNotice, fetchVisibility, isVisibilityNoticeDismissed,
  markNoticeSeen, saveVisibility,
} from "./employerVisibility";

export default function EmployerNoticeBanner() {
  // Start hidden and decide after the server answers so markup never flashes.
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isVisibilityNoticeDismissed()) return;
    let cancelled = false;
    fetchVisibility().then((s) => { if (!cancelled && s?.noticePending) setVisible(true); });
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  const choose = async (next: "masked" | "off") => {
    setBusy(true);
    setError(null);
    const res = await saveVisibility(next, "dashboard");
    setBusy(false);
    if (res.ok) { dismissVisibilityNotice(); setVisible(false); }
    else setError("Couldn't save your choice. Please try again.");
  };

  const close = () => {
    dismissVisibilityNotice();
    setVisible(false);
    void markNoticeSeen();
  };

  return (
    <section
      aria-label="Employer visibility notice"
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
        border: `1px solid ${t.line}`, borderRadius: 12, background: t.creamSoft,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, lineHeight: 1.55, margin: 0 }}>
          Employers can find your masked profile. Turn off anytime.
        </p>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "2px 0 0" }}>
          {DISCLOSURE_SUMMARY}{" "}
          <Link href="/settings" className="underline underline-offset-4" style={{ color: t.indigo, fontWeight: 600 }}>
            See exactly what they see
          </Link>
        </p>
        {error && <p role="alert" style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: "6px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <Button type="button" size="sm" disabled={busy} onClick={() => choose("masked")}>Keep on</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => choose("off")}>Turn off</Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss employer visibility notice"
        disabled={busy}
        onClick={close}
        style={{ flexShrink: 0, width: 32, height: 32, marginTop: -4 }}
      >
        <XIcon size={16} aria-hidden="true" />
      </Button>
    </section>
  );
}
