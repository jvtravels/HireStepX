"use client";

import { ShieldAlertIcon } from "lucide-react";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { useEmployerData } from "./EmployerDataContext";

/* Suspended-account alert at the top of the console body (role="alert", not
   dismissible: the console is read-only). Everything else renders nothing. */
export default function VerificationBanner() {
  const { suspended, deletionPending, companyStatus } = useEmployerData();

  if (companyStatus !== "approved") return null;

  if (suspended) {
    return (
      <div
        role="alert"
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", marginBottom: 12,
          background: t.error100, border: `1px solid ${t.error}`, borderRadius: 10,
          fontFamily: f.sans, fontSize: 14, color: t.errorInk, lineHeight: 1.5,
        }}
      >
        <ShieldAlertIcon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, flex: 1 }}>
          {deletionPending ? (
            <>
              <strong>Your account is scheduled for deletion.</strong> You can still view your jobs and candidates, but
              unlocking, messaging and posting are turned off. Use the Restore account button at the top of the page to continue.
            </>
          ) : (
            <>
              <strong>Your account is suspended.</strong> You can still view your jobs and candidates, but unlocking,
              messaging and posting are turned off. Contact support to restore access.
            </>
          )}
        </p>
      </div>
    );
  }

  return null;
}
