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
  StatusChip,
  EmployerIcon,
} from "@/employer/_atoms";

/* A pragmatic website check, not a full RFC 3986 parser: catches the two
   real-world mistakes (missing scheme, no dot in the host) without
   rejecting valid domains our regex doesn't fully understand. */
function isPlausibleWebsite(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const host = new URL(v).hostname;
    return host.includes(".") && host.length > 3;
  } catch {
    return false;
  }
}

function CompanyOnboarding() {
  const { submitCompanyProfile } = useEmployerData();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [websiteTouched, setWebsiteTouched] = useState(false);
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

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Eyebrow tone="indigo">Company profile · one step</Eyebrow>
        <h1 style={{ fontFamily: f.serif, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.01em", color: t.coal, margin: "10px 0 12px" }}>
          Tell us about your company
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>
          We review every employer before they can browse the candidate roster — this protects candidates from
          recruiters who aren't hiring in good faith. Most companies hear back within one business day, and
          there's nothing else to fill out after this.
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
                const ok = await submitCompanyProfile({ companyName, website });
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

/* Employer landing after approval — same two-column dashboard layout as the
   candidate DashboardHome (src/DashboardHome.tsx): hero greeting, one
   emphasized "next move" card, a 3-cell stat strip, then the requirements
   list in the main column; a supporting card in the rail. Reuses that
   file's grid proportions (minmax(0,1fr) / minmax(280px,360px), 1280 max
   width) so the employer surface reads as the same product. */
function EmployerDashboard() {
  const { user } = useAuth();
  const { requirements, requirementsLoading } = useEmployerData();

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

        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, letterSpacing: "-0.01em", margin: 0 }}>
                Your open roles
              </h2>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "4px 0 0" }}>
                Newest first.
              </p>
            </div>
          </div>

          {requirementsLoading ? (
            <Card style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
            </Card>
          ) : requirements.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 48 }}>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
                You haven't posted a requirement yet.
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {requirements.map((req) => (
                <Link key={req.id} href={`/employer/requirements/${req.id}`} style={{ textDecoration: "none" }}>
                  <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal }}>{req.title}</div>
                      <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 4 }}>
                        {req.location} · Posted {req.createdAt}
                      </div>
                    </div>
                    <StatusChip status={req.status} />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ─── Rail ─── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ color: t.indigo }}><EmployerIcon.Building /></span>
            <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
              Company profile
            </h2>
          </div>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
            You're approved to browse the candidate roster and unlock contact details.
          </p>
          <OutlineCta full size="sm">Edit company details</OutlineCta>
        </Card>

        <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, padding: 20, boxShadow: shadows.card }}>
          <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px" }}>
            How matching works
          </h2>
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>
            Match score reflects fit against this requirement; roster score reflects lifetime interview
            performance across a candidate's practice sessions. Contact details stay hidden until you unlock
            them.
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
