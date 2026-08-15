"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/AuthContext";
import { CopyEmailLink } from "@/_CopyEmailLink";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f, shadows } from "@/auth/_tokens";
import {
  Card,
  Eyebrow,
  FieldLabel,
  HelpText,
  PrimaryCta,
  OutlineCta,
  StatCell,
  EmployerIcon,
} from "@/employer/_atoms";
import {
  LOGO_MAX_MB,
  LOGO_ACCEPTED_TYPES,
  LOGO_CONTENT_TYPE_ALLOWLIST,
  readFileAsDataUrl,
  isPlausibleWebsite,
} from "@/employer/_companyProfileHelpers";

function CompanyOnboarding() {
  const { submitCompanyProfile } = useEmployerData();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [websiteTouched, setWebsiteTouched] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const nameValid = companyName.trim().length > 1;
  const websiteValid = isPlausibleWebsite(website);
  const canSubmit = nameValid && websiteValid;
  const websiteFormatError = websiteTouched && website.trim().length > 0 && !websiteValid;

  const missingFieldsHint = !nameValid && !websiteValid
    ? "Enter your company name and website to continue."
    : !nameValid
      ? "Enter your company name to continue."
      : !websiteValid
        ? "Enter a valid company website to continue."
        : null;

  const handleLogoChange = async (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    if (!LOGO_CONTENT_TYPE_ALLOWLIST.has(file.type)) {
      setLogoError("Use a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > LOGO_MAX_MB * 1_000_000) {
      setLogoError(`Keep it under ${LOGO_MAX_MB} MB.`);
      return;
    }
    setLogoDataUrl(await readFileAsDataUrl(file));
  };

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: f.serif, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.01em", color: t.coal, margin: 0 }}>
          Tell us about your company
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>
          We review every employer before they can browse the roster. Most companies hear back within one business day.
        </p>
      </div>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Company name</FieldLabel>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Technologies Pvt Ltd"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <FieldLabel required>Company website</FieldLabel>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onBlur={() => setWebsiteTouched(true)}
              placeholder="https://acme.com"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid ${websiteFormatError ? t.error : t.line}`,
                fontFamily: f.sans,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
            {websiteFormatError ? (
              <HelpText tone="error">Include the full address, starting with https:// — e.g. https://acme.com</HelpText>
            ) : (
              <HelpText>We'll use this to verify your company is real.</HelpText>
            )}
          </div>
          <div>
            <FieldLabel>Company logo (optional)</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  border: `1px solid ${t.line}`,
                  background: t.creamSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {logoDataUrl ? (
                  <img src={logoDataUrl} alt="Company logo preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: t.inkFaint }}><EmployerIcon.Building /></span>
                )}
              </div>
              <label
                htmlFor="company-logo-input"
                style={{
                  padding: "9px 16px",
                  borderRadius: 10,
                  border: `1px solid ${t.lineStrong}`,
                  fontFamily: f.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.coal,
                  cursor: "pointer",
                }}
              >
                {logoDataUrl ? "Change logo" : "Upload logo"}
                <input
                  id="company-logo-input"
                  type="file"
                  accept={LOGO_ACCEPTED_TYPES}
                  onChange={(e) => handleLogoChange(e.target.files?.[0])}
                  style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}
                />
              </label>
            </div>
            {logoError ? (
              <HelpText tone="error">{logoError}</HelpText>
            ) : (
              <HelpText>PNG, JPG, or WEBP · up to {LOGO_MAX_MB} MB.</HelpText>
            )}
          </div>
          {submitError && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: 0 }}>{submitError}</p>
          )}
          <div>
            <PrimaryCta
              full
              disabled={!canSubmit || submitted}
              onClick={async () => {
                setSubmitError(null);
                setSubmitted(true);
                const [logoContentType, logoBase64] = logoDataUrl ? logoDataUrl.split(",") : [undefined, undefined];
                const ok = await submitCompanyProfile({
                  companyName,
                  website,
                  logoBase64,
                  logoContentType: logoContentType?.match(/^data:(.+);base64$/)?.[1],
                });
                if (!ok) {
                  setSubmitted(false);
                  setSubmitError("Couldn't submit your company profile — please try again.");
                }
              }}
            >
              {submitted ? "Submitting…" : "Submit for approval"}
            </PrimaryCta>
            {!submitted && missingFieldsHint && (
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: "8px 0 0", textAlign: "center" }}>
                {missingFieldsHint}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Eyebrow tone="copper">What happens next</Eyebrow>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {[
            { icon: <EmployerIcon.Check />, title: "You submit", body: "Company name and website. A logo speeds up review." },
            { icon: <EmployerIcon.Clock />, title: "We review", body: "A human checks every employer. Most hear back in one business day." },
            { icon: <EmployerIcon.Arrow />, title: "You post roles", body: "Get an AI-matched shortlist, scored on real interview performance." },
          ].map((step) => (
            <div key={step.title} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: t.indigo100,
                  color: t.indigoDeep,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px",
                }}
              >
                {step.icon}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, color: t.coal, marginBottom: 4 }}>
                {step.title}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.5 }}>
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompanyPending() {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: t.indigo100, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: t.indigoDeep }}>
        <EmployerIcon.Clock />
      </div>
      <h1 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: "0 0 8px" }}>Your profile is under review</h1>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, margin: "0 0 20px" }}>
        We typically approve genuine employers within one business day. You'll be able to post a requirement as
        soon as you're approved — this page will update automatically.
      </p>
      <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, margin: 0 }}>
        Made a mistake in your details, or been waiting longer than a day?{" "}
        <CopyEmailLink email="support@hirestepx.com" style={{ color: t.inkFaint }} />
      </p>
    </div>
  );
}

function CompanyRejected() {
  const { resetCompanyProfile } = useEmployerData();
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: t.error100, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: t.error }}>
        <EmployerIcon.Alert />
      </div>
      <h1 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: "0 0 8px" }}>We couldn't approve this profile</h1>
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6, marginBottom: 20 }}>
        We couldn't verify this as a genuine hiring company from the details provided. You're welcome to
        resubmit with more information.
      </p>
      <OutlineCta onClick={resetCompanyProfile}>Resubmit company profile</OutlineCta>
    </div>
  );
}

/* Employer landing after approval — lightweight overview only. The full
   requirements list lives on /employer/jobs; this screen is the "how's it
   going" glance (greeting, next move, stat strip, company profile rail).
   Reuses DashboardHome's (src/DashboardHome.tsx) grid proportions
   (minmax(0,1fr) / minmax(280px,360px), 1280 max width) so the employer
   surface reads as the same product. */
function EmployerDashboard() {
  const { user } = useAuth();
  const { requirements, companyLogoUrl } = useEmployerData();

  const openRequirements = requirements.filter((r) => r.status !== "closed");
  const totalCandidates = requirements.reduce((sum, r) => sum + r.candidateCount, 0);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
        gap: 32,
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ─── Main stage ─── */}
      <main style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        <section>
          <Eyebrow tone="ink">Employer console</Eyebrow>
          <h1 style={{ fontFamily: f.serif, fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", color: t.coal, margin: "8px 0 6px" }}>
            Welcome <em style={{ fontStyle: "italic", fontWeight: 400, color: t.copper }}>back</em>, {user?.name || "there"}.
          </h1>
          <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, maxWidth: 560 }}>
            {openRequirements.length > 0
              ? "Here's where your open roles and shortlists stand."
              : "Post your first requirement and we'll start matching candidates against it."}
          </p>
        </section>

        <Card pad={28}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow tone="copper">Your next move</Eyebrow>
              <p style={{ fontFamily: f.serif, fontSize: 28, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.01em", color: t.coal, margin: "8px 0 10px" }}>
                Post a requirement
              </p>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
                Tell us the role, location, and notice-period preference — we'll return a scored shortlist
                from candidates actively practicing on HireStepX.
              </p>
              <div style={{ marginTop: 18 }}>
                <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
                  <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <section>
          <Eyebrow tone="ink">Overview</Eyebrow>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 0, margin: "10px 0 0", borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
            <StatCell label="Open requirements" value={String(openRequirements.length)} unit="" />
            <StatCell label="Candidates matched" value={String(totalCandidates)} unit="" />
          </dl>
        </section>

        <Link href="/employer/jobs" style={{ textDecoration: "none" }}>
          <OutlineCta full>View all jobs</OutlineCta>
        </Link>
      </main>

      {/* ─── Rail ─── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt="Company logo"
                style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }}
              />
            ) : (
              <span style={{ color: t.indigo }}><EmployerIcon.Building /></span>
            )}
            <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
              Company profile
            </h2>
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
            You're approved to browse the candidate roster and view contact details.
          </p>
          <Link href="/employer/settings" style={{ textDecoration: "none" }}>
            <OutlineCta full size="sm">Edit company details</OutlineCta>
          </Link>
        </Card>

        <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 20, boxShadow: shadows.card }}>
          <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px" }}>
            How matching works
          </h2>
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>
            Match score reflects fit against this requirement; roster score reflects lifetime interview
            performance across a candidate's practice sessions.
          </p>
        </div>
      </aside>
    </div>
  );
}

export default function EmployerHomePage() {
  const { companyStatus, companyStatusLoading } = useEmployerData();

  if (companyStatusLoading) return null;
  if (companyStatus === "none") return <CompanyOnboarding />;
  if (companyStatus === "pending") return <CompanyPending />;
  if (companyStatus === "rejected") return <CompanyRejected />;
  return <EmployerDashboard />;
}
