"use client";

import { useState } from "react";
import { useAuth } from "@/AuthContext";
import { useToast } from "@/Toast";
import { authHeaders } from "@/supabase";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { PageSkeleton, ErrorPanel } from "@/employer/_consoleParts";
import BillingHistorySection from "@/employer/BillingHistorySection";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import { PageHeader, FlatSection, SoundsSection, EmailPreferencesSection, AccountSection, DangerZoneSection } from "@/settingsSections";

/* /employer/settings — edit the company profile submitted during
   onboarding. Saving re-runs the same POST /api/employer-profile upsert
   onboarding uses, which re-derives the tier on the server. GSTIN and the invoice name are
   part of that form; invoices are generated from billing history. Billing history is read-only.
   Password reset and account deletion reuse the candidate settings sections; the
   erasure pipeline already clears employer rows and anonymises retained payments. */
export default function EmployerSettingsPage() {
  const {
    companyName, companyWebsite, companyLogoUrl, companyStatus, companyStatusLoading, companyStatusError,
    refreshCompanyStatus, suspended,
  } = useEmployerData();
  const { user, logout, resetPassword } = useAuth();
  const { toast } = useToast();
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

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
    <div style={{ width: "100%", maxWidth: 960, margin: "0 auto" }}>
      <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
        <PageHeader title="Settings" desc="Update your company profile, manage your account security, review your purchases and set notification sounds." />

        <FlatSection title="Company profile">
          <div style={{ maxWidth: 480 }}>
            {suspended && (
              <p role="status" style={{ fontFamily: f.sans, fontSize: 13, color: t.errorInk, margin: "0 0 16px", lineHeight: 1.5 }}>
                Your account is suspended, so changes can&apos;t be saved right now.
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
            />
          </div>
        </FlatSection>

        <FlatSection title="Email preferences">
          <EmailPreferencesSection audience="employer" />
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

        <FlatSection title="Danger zone" last>
          <DangerZoneSection
            authUser={user}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
            deleteEmailInput={deleteEmailInput} setDeleteEmailInput={setDeleteEmailInput}
            deleteLoading={deleteLoading} setDeleteLoading={setDeleteLoading}
            deleteMsg={deleteMsg} setDeleteMsg={setDeleteMsg}
            onLogout={() => { void logout(); }} showToast={(msg) => toast(msg, "success")}
            authHeaders={authHeaders}
          />
        </FlatSection>
      </div>
    </div>
  );
}
