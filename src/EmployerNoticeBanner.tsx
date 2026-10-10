"use client";

/* One-time dashboard notice that employer discovery exists and where to
   control it. Dismissal is remembered in localStorage (guarded — it can throw
   in private mode, in which case the notice just reappears next visit). */

import { useEffect, useState } from "react";
import Link from "next/link";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokens as t, fonts as f } from "./auth/_tokens";
import { dismissVisibilityNotice, isVisibilityNoticeDismissed } from "./employerVisibility";

export default function EmployerNoticeBanner() {
  // Start hidden and decide after mount so server and client markup agree.
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(!isVisibilityNoticeDismissed()); }, []);

  if (!visible) return null;

  return (
    <section
      aria-label="Employer visibility notice"
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px",
        border: `1px solid ${t.line}`, borderRadius: 12, background: t.creamSoft,
      }}
    >
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, lineHeight: 1.55, margin: 0, flex: 1 }}>
        Employers can now discover your practice evidence &mdash; your name and contact stay hidden.{" "}
        <Link href="/settings" className="underline underline-offset-4" style={{ color: t.indigo, fontWeight: 600 }}>
          Manage in Settings
        </Link>
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Dismiss employer visibility notice"
        onClick={() => { dismissVisibilityNotice(); setVisible(false); }}
        style={{ flexShrink: 0, width: 32, height: 32, marginTop: -4 }}
      >
        <XIcon size={16} aria-hidden="true" />
      </Button>
    </section>
  );
}
