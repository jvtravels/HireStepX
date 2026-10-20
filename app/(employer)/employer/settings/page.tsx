"use client";

import { useUnsavedNavGuard } from "@/employer/useUnsavedNavGuard";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/AuthContext";
import { useToast } from "@/Toast";
import { authHeaders } from "@/supabase";
import { apiFetch } from "@/apiClient";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { PageSkeleton, ErrorPanel } from "@/employer/_consoleParts";
import BillingHistorySection from "@/employer/BillingHistorySection";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import NotificationPreferences from "@/notifications/NotificationPreferences";
import { Badge, OutlineCta } from "@/employer/_atoms";
import {
  describeLimits, exportBody, exportFilename, exportIsIncomplete, openJobCount, tierPresentation,
} from "@/employer/_accountHelpers";
import { PageHeader, FlatSection, ActionRow, SoundsSection, EmailPreferencesSection, AccountSection, DangerZoneSection, icons } from "@/settingsSections";

/* /employer/settings — edit the company profile submitted during
   onboarding. Saving re-runs the same POST /api/employer-profile upsert
   onboarding uses, which re-derives the tier on the server. GSTIN and the invoice name are
   part of that form; invoices are generated from billing history. Billing history is read-only.
   Password reset and account deletion reuse the candidate settings sections; the
   erasure pipeline already clears employer rows and anonymises retained payments. */
export default function EmployerSettingsPage() {
  const {
    companyName, companyWebsite, companyLogoUrl, companyStatus, companyStatusLoading, companyStatusError,
    refreshCompanyStatus, suspended, deletionPending, verificationTier, limits, requirements, fetchCredit,
  } = useEmployerData();
  const { user, logout, resetPassword } = useAuth();
  const { toast } = useToast();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [creditPaise, setCreditPaise] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState("");

  // Warn before a refresh/close throws away unsaved company details.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useUnsavedNavGuard(() => dirty);

  // The deletion warning quotes the unspent credit, so read it before the owner opens that panel.
  useEffect(() => {
    let live = true;
    void fetchCredit().then((c) => { if (live && c) setCreditPaise(c.balancePaise); });
    return () => { live = false; };
  }, [fetchCredit]);

  const handleDownloadData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportNote("");
    const res = await apiFetch<unknown>("/api/export-user-data", {});
    setExporting(false);
    if (!res.ok || res.data === null) {
      toast(res.status === 429 ? "You can download your data a few times an hour. Try again shortly." : res.error || "Couldn't prepare your data", "error");
      return;
    }
    const url = URL.createObjectURL(new Blob([exportBody(res.data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFilename(res.headers);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (exportIsIncomplete(res.headers)) {
      setExportNote("Some of your data could not be loaded, so this file is incomplete. Download again in a few minutes for the full copy.");
    } else {
      toast("Your data is downloading", "success");
    }
  };

  const onDirtyChange = useCallback((v: boolean) => setDirty(v), []);
  const formLocked = suspended || deletionPending;
  const tierInfo = tierPresentation(verificationTier);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    const result = await resetPassword(user.email);
    setResetLoading(false);
    if (result.success) {
      setResetSent(true);
      toast("Password reset email sent", "success");
      setTimeout(() => setResetSent(false), 10000);
    } else {
      toast(result.error || "Couldn't send the reset email", "error");
    }
  };

  if (companyStatusLoading) return <PageSkeleton label="Loading settings" />;
  if (companyStatusError && companyStatus === "none") {
    return (
      <ErrorPanel
        title="We couldn't load your settings"
        message="Check your connection and try again."
        onRetry={() => { void refreshCompanyStatus(); }}
      />
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
        <PageHeader title="Settings" desc="Update your company profile, manage your account security, review your purchases and set notification sounds." />

        <FlatSection title="Company profile">
          <div style={{ maxWidth: 480 }}>
            {formLocked && (
              <p role="status" style={{ fontFamily: f.sans, fontSize: 13, color: t.errorInk, margin: "0 0 16px", lineHeight: 1.5 }}>
                {deletionPending
                  ? "Your account is scheduled for deletion, so changes can't be saved. Restore it with the button at the top of the page."
                  : "Your account is suspended, so changes can't be saved right now."}
              </p>
            )}
            {/* Keyed so the form re-seeds when the profile arrives or a save
                changes what the server holds, instead of going stale. */}
            <CompanyProfileForm
              key={`${companyName}|${companyWebsite}`}
              idPrefix="settings"
              initialName={companyName}
              initialWebsite={companyWebsite}
              initialLogoUrl={companyLogoUrl}
              submitLabel="Save changes"
              busyLabel="Saving…"
              disabled={formLocked}
              onDirtyChange={onDirtyChange}
            />
          </div>
        </FlatSection>

        <FlatSection title="Verification and limits">
          <div className="flex max-w-[480px] flex-col gap-2 text-[13px] leading-relaxed text-foreground">
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span className="font-semibold">Current tier</span>
              {tierInfo.verifiedBadge ? <Badge tone="success">Verified</Badge> : <Badge tone="neutral">{tierInfo.label}</Badge>}
            </p>
            <p className="m-0 text-muted-foreground">Your limits: {describeLimits(limits)}.</p>
            {tierInfo.nextStep && <p className="m-0 text-muted-foreground">{tierInfo.nextStep}</p>}
          </div>
        </FlatSection>

        <FlatSection title="Email preferences">
          <EmailPreferencesSection audience="employer" />
        </FlatSection>

        <FlatSection title="Notifications">
          <NotificationPreferences audience="employer" />
        </FlatSection>

        <FlatSection title="Billing history">
          <BillingHistorySection />
        </FlatSection>

        <FlatSection title="Sounds">
          <SoundsSection />
        </FlatSection>

        <FlatSection title="Account">
          <AccountSection
            resetLoading={resetLoading} resetSent={resetSent}
            handlePasswordReset={handlePasswordReset}
            isOAuthOnly={user?.signedInVia === "google"}
          />
        </FlatSection>

        <FlatSection title="Your data">
          <ActionRow
            last
            icon={icons.download}
            title="Download my data"
            desc="A JSON copy of your company profile, jobs, conversations and payment records."
            action={<OutlineCta size="sm" onClick={() => { void handleDownloadData(); }} loading={exporting} disabled={exporting}>{exporting ? "Preparing…" : "Download"}</OutlineCta>}
          />
          {exportNote && <p role="status" className="m-0 mt-2 text-[13px] text-destructive">{exportNote}</p>}
        </FlatSection>

        <FlatSection title="Danger zone" last>
          <DangerZoneSection
            authUser={user}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
            deleteEmailInput={deleteEmailInput} setDeleteEmailInput={setDeleteEmailInput}
            deleteLoading={deleteLoading} setDeleteLoading={setDeleteLoading}
            deleteMsg={deleteMsg} setDeleteMsg={setDeleteMsg}
            onLogout={() => { void logout(); }} showToast={(msg) => toast(msg, "success")}
            authHeaders={authHeaders}
            employer={{ openJobs: openJobCount(requirements), creditPaise }}
          />
        </FlatSection>
      </div>
    </div>
  );
}
