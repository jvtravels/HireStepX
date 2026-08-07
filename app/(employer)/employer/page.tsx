"use client";

import { useState } from "react";
import Link from "next/link";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  Card,
  Eyebrow,
  FieldLabel,
  HelpText,
  PrimaryCta,
  OutlineCta,
  StatusChip,
  EmployerIcon,
} from "@/employer/_atoms";

function CompanyOnboarding() {
  const { submitCompanyProfile } = useEmployerData();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [gstin, setGstin] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = companyName.trim().length > 1 && website.trim().length > 3;

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Eyebrow tone="indigo">Company profile</Eyebrow>
        <h1 style={{ fontFamily: f.serif, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.01em", color: t.coal, margin: "10px 0 12px" }}>
          Tell us about your company
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>
          We review every employer before they can browse the candidate roster — this protects candidates from
          recruiters who aren't hiring in good faith.
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
              placeholder="https://acme.com"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <FieldLabel>GSTIN (optional)</FieldLabel>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: 14, boxSizing: "border-box" }}
            />
            <HelpText>Speeds up review — not required to apply.</HelpText>
          </div>
          <PrimaryCta
            full
            disabled={!canSubmit || submitted}
            onClick={() => {
              setSubmitted(true);
              submitCompanyProfile();
            }}
          >
            {submitted ? "Submitting…" : "Submit for approval"}
          </PrimaryCta>
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
      <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, lineHeight: 1.6 }}>
        We typically approve genuine employers within one business day. You'll be able to post a requirement as
        soon as you're approved — this page will update automatically.
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

function Console() {
  const { requirements } = useEmployerData();
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <Eyebrow tone="indigo">Requirements</Eyebrow>
          <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "6px 0 0" }}>Your open roles</h1>
        </div>
        <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
          <PrimaryCta icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryCta>
        </Link>
      </div>

      {requirements.length === 0 ? (
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
    </div>
  );
}

export default function EmployerHomePage() {
  const { companyStatus } = useEmployerData();

  if (companyStatus === "none") return <CompanyOnboarding />;
  if (companyStatus === "pending") return <CompanyPending />;
  if (companyStatus === "rejected") return <CompanyRejected />;
  return <Console />;
}
