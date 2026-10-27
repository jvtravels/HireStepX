"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { ROLE_BLURB, ROLE_LABEL, isEmployerRole, type EmployerRole } from "../../server-handlers/_employer-team-helpers";

/* One-time welcome after accepting an invite (/employer?joined=<role>): says what the
   person can do. The query is stripped so a refresh doesn't repeat it. */
export default function JoinedBanner() {
  const [role, setRole] = useState<EmployerRole | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const joined = url.searchParams.get("joined");
    if (!isEmployerRole(joined)) return;
    setRole(joined);
    url.searchParams.delete("joined");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  }, []);

  if (!role) return null;
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", marginBottom: 12,
        background: t.success100, border: `1px solid ${t.success}`, borderRadius: 10,
        fontFamily: f.sans, fontSize: 14, color: t.successInk, lineHeight: 1.5,
      }}
    >
      <p style={{ margin: 0, flex: 1 }}>
        <strong>You&apos;ve joined the team as {ROLE_LABEL[role]}.</strong> {ROLE_BLURB[role]}{" "}
        <Link href="/employer/team" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>See your team</Link>
      </p>
      <button type="button" aria-label="Dismiss" onClick={() => setRole(null)} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", padding: 2, display: "inline-flex" }}>
        <XIcon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
