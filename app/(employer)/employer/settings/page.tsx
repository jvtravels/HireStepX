"use client";

import { useEmployerData, type EmployerTier } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Pill } from "@/employer/_atoms";
import { PageSkeleton, ErrorPanel } from "@/employer/_consoleParts";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import { PageHeader, FlatSection, SoundsSection } from "@/settingsSections";

const TIER_LABEL: Record<EmployerTier, string> = {
  basic: "Unverified",
  email_verified: "Work email confirmed",
  verified: "Verified company",
};

const TIER_BLURB: Record<EmployerTier, string> = {
  basic: "Sign in with a confirmed work email (not Gmail, Yahoo or similar) to raise your limits. A work email on the same domain as your website verifies your company fully.",
  email_verified: "Your work email is confirmed. Use a work email on the same domain as your company website to verify your company fully and raise your limits again.",
  verified: "Your email domain matches your company website. You have the highest limits.",
};

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderTop: `1px solid ${t.line}` }}>
      <dt style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>{label}</dt>
      <dd style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0 }}>{value}</dd>
    </div>
  );
}

/* /employer/settings — edit the company profile submitted during
   onboarding, and see the account's trust tier and the limits that come with
   it. Saving re-runs the same POST /api/employer-profile upsert onboarding
   uses, which re-derives the tier on the server. Billing/GSTIN fields are
   deliberately absent: no server endpoint accepts them yet. */
export default function EmployerSettingsPage() {
  const {
    companyName, companyWebsite, companyLogoUrl, companyStatus, companyStatusLoading, companyStatusError,
    refreshCompanyStatus, verificationTier, limits, suspended,
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
        <PageHeader title="Settings" desc="Update your company profile and review your account limits." />

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

        <FlatSection title="Account verification">
          <div style={{ maxWidth: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <Pill tone={suspended ? "error" : verificationTier === "basic" ? "warning" : "success"}>
                {suspended ? "Suspended" : TIER_LABEL[verificationTier]}
              </Pill>
            </div>
            <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, margin: "0 0 16px" }}>
              {suspended
                ? "Unlocking, messaging and posting are turned off while your account is suspended. Contact support to restore access."
                : TIER_BLURB[verificationTier]}
            </p>
            <dl style={{ margin: 0, borderBottom: `1px solid ${t.line}` }}>
              <LimitRow label="Candidate unlocks per day" value={String(limits.unlocksPerDay)} />
              <LimitRow label="Open jobs at a time" value={String(limits.openRequirements)} />
              <LimitRow label="Re-matches per hour" value={String(limits.rematchesPerHour)} />
            </dl>
          </div>
        </FlatSection>

        <FlatSection title="Sounds" last>
          <SoundsSection />
        </FlatSection>
      </div>
    </div>
  );
}
