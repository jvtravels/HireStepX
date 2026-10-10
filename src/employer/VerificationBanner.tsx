"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlertIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { captureClientEvent } from "../posthogClient";
import { useEmployerData } from "./EmployerDataContext";

const DISMISS_KEY = "hsx_employer_verify_banner_dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/* Account-trust banner at the top of the console body. Two variants:
   - suspended: role="alert", not dismissible — the console is read-only.
   - basic tier: role="status", dismissible for the session — nudges toward
     the settings page, where the limits and verification are explained.
   Higher tiers render nothing. Copy never promises a verification flow the
   server doesn't have; it only states the limits the account is under. */
export default function VerificationBanner({ onSettingsPage = false }: { onSettingsPage?: boolean }) {
  const { verificationTier, limits, suspended, companyStatus } = useEmployerData();
  const [dismissed, setDismissed] = useState(readDismissed);

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
          <strong>Your account is suspended.</strong> You can still view your jobs and candidates, but unlocking,
          messaging and posting are turned off. Contact support to restore access.
        </p>
      </div>
    );
  }

  if (verificationTier !== "basic" || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode — the banner just returns next load
    }
  };

  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 12px 12px 16px", marginBottom: 12,
        background: t.warning100, border: `1px solid ${t.warningLine}`, borderRadius: 10,
        fontFamily: f.sans, fontSize: 14, color: t.warningInk, lineHeight: 1.5,
      }}
    >
      <ShieldCheckIcon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <p style={{ margin: 0, flex: 1, minWidth: 0 }}>
        <strong>Unverified company account.</strong> Limits: {limits.unlocksPerDay} unlocks a day and{" "}
        {limits.openRequirements} open jobs.{" "}
        {onSettingsPage ? (
          <span>See the account section below for how limits grow.</span>
        ) : (
          <Link
            href="/employer/settings"
            onClick={() => captureClientEvent("employer_verification_banner_clicked", { tier: verificationTier, variant: "basic" })}
            style={{ color: t.warningInk, fontWeight: 600, textDecoration: "underline", display: "inline-block", padding: "2px 0" }}
            className="pointer-coarse:py-3"
          >
            Review your account limits
          </Link>
        )}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss account limits notice"
        className="hsx-btn-icon"
        style={{
          flexShrink: 0, width: 44, height: 44, margin: "-10px -2px -10px 0", display: "inline-flex",
          alignItems: "center", justifyContent: "center", background: "transparent", border: "none",
          borderRadius: 8, color: t.warningInk, cursor: "pointer",
        }}
      >
        <XIcon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
