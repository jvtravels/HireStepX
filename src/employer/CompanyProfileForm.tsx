"use client";

import { useRef, useState } from "react";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { EmployerIcon, FieldLabel, HelpText, OutlineCta, PrimaryCta } from "@/employer/_atoms";
import {
  LOGO_ACCEPTED_TYPES,
  LOGO_CONTENT_TYPE_ALLOWLIST,
  LOGO_MAX_MB,
  WEBSITE_FORMAT_MESSAGE,
  isPlausibleWebsite,
  readFileAsDataUrl,
  splitLogoDataUrl,
} from "@/employer/_companyProfileHelpers";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${t.line}`,
  background: t.white,
  fontFamily: f.sans,
  // 16px stops iOS Safari zooming the page on focus.
  fontSize: 16,
  color: t.coal,
  boxSizing: "border-box",
};

/* The one company-profile form, used by first-run onboarding and by Settings.
   Both POST the same upsert, so they share validation, the logo picker and the
   way the server's message is surfaced (a website the server rejects shows its
   own text under the field, not a generic failure). */
export default function CompanyProfileForm({
  initialName = "",
  initialWebsite = "",
  initialLogoUrl = null,
  submitLabel,
  busyLabel,
  idPrefix,
  websiteHelp,
  onSaved,
}: {
  initialName?: string;
  initialWebsite?: string;
  initialLogoUrl?: string | null;
  submitLabel: string;
  busyLabel: string;
  idPrefix: string;
  websiteHelp?: string;
  onSaved?: () => void;
}) {
  const { submitCompanyProfileResult } = useEmployerData();
  const [companyName, setCompanyName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [nameTouched, setNameTouched] = useState(false);
  const [websiteTouched, setWebsiteTouched] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [websiteServerError, setWebsiteServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameValid = companyName.trim().length > 1;
  const websiteValid = isPlausibleWebsite(website);
  const nameError = nameTouched && !nameValid ? "Enter your company name (at least 2 characters)." : null;
  const websiteError = websiteServerError ?? (websiteTouched && !websiteValid ? WEBSITE_FORMAT_MESSAGE : null);

  const nameId = `${idPrefix}-name`;
  const websiteId = `${idPrefix}-website`;
  const logoHelpId = `${idPrefix}-logo-help`;
  const logoSrc = logoDataUrl ?? initialLogoUrl;

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
    try {
      setLogoDataUrl(await readFileAsDataUrl(file));
      setLogoName(file.name);
      setSaved(false);
    } catch {
      setLogoError("Couldn't read that file. Try a different image.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setNameTouched(true);
    setWebsiteTouched(true);
    if (!nameValid || !websiteValid) return;
    setFormError(null);
    setWebsiteServerError(null);
    setSaved(false);
    setSaving(true);
    const res = await submitCompanyProfileResult({ companyName: companyName.trim(), website: website.trim(), ...splitLogoDataUrl(logoDataUrl) });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      onSaved?.();
      return;
    }
    if (/website/i.test(res.error.error)) setWebsiteServerError(res.error.error);
    else setFormError(res.error.error);
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <FieldLabel required htmlFor={nameId}>Company name</FieldLabel>
        <input
          id={nameId}
          name="company-name"
          autoComplete="organization"
          value={companyName}
          onChange={(e) => { setCompanyName(e.target.value); setSaved(false); }}
          onBlur={() => setNameTouched(true)}
          aria-required="true"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${nameId}-err` : undefined}
          placeholder="Acme Technologies Pvt Ltd"
          style={{ ...inputStyle, borderColor: nameError ? t.error : t.line }}
        />
        {nameError && <HelpText id={`${nameId}-err`} tone="error">{nameError}</HelpText>}
      </div>

      <div>
        <FieldLabel required htmlFor={websiteId}>Company website</FieldLabel>
        <input
          id={websiteId}
          name="company-website"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          value={website}
          onChange={(e) => { setWebsite(e.target.value); setWebsiteServerError(null); setSaved(false); }}
          onBlur={() => setWebsiteTouched(true)}
          aria-required="true"
          aria-invalid={websiteError ? true : undefined}
          aria-describedby={`${websiteId}-${websiteError ? "err" : "help"}`}
          placeholder="acme.com"
          style={{ ...inputStyle, borderColor: websiteError ? t.error : t.line }}
        />
        {websiteError ? (
          <HelpText id={`${websiteId}-err`} tone="error">{websiteError}</HelpText>
        ) : (
          <HelpText id={`${websiteId}-help`}>{websiteHelp ?? "Candidates see this on your jobs."}</HelpText>
        )}
      </div>

      <div>
        <FieldLabel>Company logo (optional)</FieldLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 12, border: `1px solid ${t.line}`, background: t.creamSoft,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
            }}
          >
            {logoSrc ? (
              <img src={logoSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span aria-hidden="true" style={{ color: t.inkFaint }}><EmployerIcon.Building /></span>
            )}
          </div>
          <OutlineCta size="sm" onClick={() => fileRef.current?.click()}>
            {logoSrc ? "Change logo" : "Upload logo"}
          </OutlineCta>
          <input
            ref={fileRef}
            type="file"
            accept={LOGO_ACCEPTED_TYPES}
            onChange={(e) => handleLogoChange(e.target.files?.[0])}
            tabIndex={-1}
            aria-hidden="true"
            hidden
          />
        </div>
        {logoError ? (
          <HelpText id={logoHelpId} tone="error">{logoError}</HelpText>
        ) : (
          <HelpText id={logoHelpId}>
            {logoName ? `Selected: ${logoName}. ` : ""}PNG, JPG, or WEBP · up to {LOGO_MAX_MB} MB.
          </HelpText>
        )}
      </div>

      {formError && (
        <p role="alert" style={{ fontFamily: f.sans, fontSize: 13, color: t.errorInk, margin: 0 }}>{formError}</p>
      )}
      <p role="status" style={{ fontFamily: f.sans, fontSize: 13, color: t.successInk, margin: 0, minHeight: saved ? undefined : 0 }}>
        {saved ? "Saved." : ""}
      </p>

      <PrimaryCta full type="submit" loading={saving}>
        {saving ? busyLabel : submitLabel}
      </PrimaryCta>
    </form>
  );
}
