"use client";

import { useState } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, FieldLabel, HelpText, PrimaryCta, EmployerIcon } from "@/employer/_atoms";
import {
  LOGO_MAX_MB,
  LOGO_ACCEPTED_TYPES,
  LOGO_CONTENT_TYPE_ALLOWLIST,
  readFileAsDataUrl,
  isPlausibleWebsite,
} from "@/employer/_companyProfileHelpers";

/* /employer/settings — edit the company profile submitted during
   onboarding. Saving re-runs it through the same POST /api/employer-profile
   upsert onboarding uses, which always resets status to "pending" for a
   fresh review — the banner below exists so an already-approved employer
   isn't surprised by losing console access after a routine edit. */
export default function EmployerSettingsPage() {
  const { companyName: savedName, companyWebsite: savedWebsite, companyLogoUrl, submitCompanyProfile } = useEmployerData();
  const [companyName, setCompanyName] = useState(savedName);
  const [website, setWebsite] = useState(savedWebsite);
  const [websiteTouched, setWebsiteTouched] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nameValid = companyName.trim().length > 1;
  const websiteValid = isPlausibleWebsite(website);
  const canSave = nameValid && websiteValid && !saving;
  const websiteFormatError = websiteTouched && website.trim().length > 0 && !websiteValid;

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

  const handleSave = async () => {
    setSaveError(null);
    setSaved(false);
    setSaving(true);
    const [logoContentType, logoBase64] = logoDataUrl ? logoDataUrl.split(",") : [undefined, undefined];
    const ok = await submitCompanyProfile({
      companyName,
      website,
      logoBase64,
      logoContentType: logoContentType?.match(/^data:(.+);base64$/)?.[1],
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
    } else {
      setSaveError("Couldn't save your changes — please try again.");
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: f.serif, fontSize: "clamp(24px, 5vw, 34px)", fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: "0 0 6px" }}>
          Settings
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
          Update your company profile.
        </p>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <FieldLabel required>Company name</FieldLabel>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
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
            {websiteFormatError && (
              <HelpText tone="error">Include the full address, starting with https:// — e.g. https://acme.com</HelpText>
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
                {logoDataUrl || companyLogoUrl ? (
                  <img src={logoDataUrl ?? companyLogoUrl ?? undefined} alt="Company logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                {logoDataUrl || companyLogoUrl ? "Change logo" : "Upload logo"}
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

          <HelpText>Saving sends your profile for another review before changes go live on the roster.</HelpText>

          {saveError && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: 0 }}>{saveError}</p>
          )}
          {saved && (
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.success, margin: 0 }}>Saved. Your profile is back under review.</p>
          )}

          <PrimaryCta full disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : "Save changes"}
          </PrimaryCta>
        </div>
      </Card>
    </div>
  );
}
