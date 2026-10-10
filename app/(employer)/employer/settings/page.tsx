"use client";

import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { PageSkeleton, ErrorPanel } from "@/employer/_consoleParts";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import { PageHeader, FlatSection, SoundsSection } from "@/settingsSections";

/* /employer/settings — edit the company profile submitted during
   onboarding. Saving re-runs the same POST /api/employer-profile upsert
   onboarding uses, which re-derives the tier on the server. Billing/GSTIN fields are
   deliberately absent: no server endpoint accepts them yet. */
export default function EmployerSettingsPage() {
  const {
    companyName, companyWebsite, companyLogoUrl, companyStatus, companyStatusLoading, companyStatusError,
    refreshCompanyStatus, suspended,
  } = useEmployerData();

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
        <PageHeader title="Settings" desc="Update your company profile and notification sounds." />

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

        <FlatSection title="Sounds" last>
          <SoundsSection />
        </FlatSection>
      </div>
    </div>
  );
}
