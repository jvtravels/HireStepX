"use client";

import { useEffect, useRef, useState } from "react";
import { isValidGstin, normalizeGstin } from "../../server-handlers/_gstin";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { EmployerIcon, FIELD_CLASS, FieldLabel, HelpText, OutlineCta, PrimaryCta } from "@/employer/_atoms";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LOGO_ACCEPTED_TYPES,
  LOGO_CONTENT_TYPE_ALLOWLIST,
  LOGO_MAX_MB,
  WEBSITE_FORMAT_MESSAGE,
  isPlausibleWebsite,
  readFileAsDataUrl,
  splitLogoDataUrl,
} from "@/employer/_companyProfileHelpers";

const legendStyle: React.CSSProperties = { fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, padding: 0, marginBottom: 12 };
const GSTIN_CLASS = cn(FIELD_CLASS, "font-mono tracking-[0.04em]");

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
  disabled = false,
  onDirtyChange,
}: {
  initialName?: string;
  initialWebsite?: string;
  initialLogoUrl?: string | null;
  submitLabel: string;
  busyLabel: string;
  idPrefix: string;
  websiteHelp?: string;
  onSaved?: () => void;
  /** Suspended or deletion-pending accounts: the server rejects the save, so don't offer it. */
  disabled?: boolean;
  /** Reports whether there are unsaved edits, so the host page can warn before leaving. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { submitCompanyProfileResult, companyGstin, companyBillingName } = useEmployerData();
  const [companyName, setCompanyName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [gstin, setGstin] = useState(companyGstin);
  const [billingName, setBillingName] = useState(companyBillingName);
  const [gstinTouched, setGstinTouched] = useState(false);
  const [gstinServerError, setGstinServerError] = useState<string | null>(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [websiteTouched, setWebsiteTouched] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [websiteServerError, setWebsiteServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [baseline, setBaseline] = useState({ name: initialName, website: initialWebsite, gstin: companyGstin, billingName: companyBillingName });
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = companyName !== baseline.name || website !== baseline.website || gstin !== baseline.gstin
    || billingName !== baseline.billingName || logoDataUrl !== null || removeLogo;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  // Leaving the page unmounts the form; make sure the host's guard doesn't outlive it.
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  // "Saved." is a confirmation, not a permanent status line.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  const nameValid = companyName.trim().length > 1;
  const websiteValid = isPlausibleWebsite(website);
  const nameError = nameTouched && !nameValid ? "Enter your company name (at least 2 characters)." : null;
  const websiteError = websiteServerError ?? (websiteTouched && !websiteValid ? WEBSITE_FORMAT_MESSAGE : null);

  const gstinValid = gstin.trim() === "" || isValidGstin(gstin);
  const gstinError = gstinServerError ?? (gstinTouched && !gstinValid ? "That GSTIN doesn't look right. It is 15 characters, like 27AAPFU0939F1ZV." : null);
  const gstinId = `${idPrefix}-gstin`;
  const billingNameId = `${idPrefix}-billing-name`;
  const nameId = `${idPrefix}-name`;
  const websiteId = `${idPrefix}-website`;
  const logoHelpId = `${idPrefix}-logo-help`;
  const logoSrc = removeLogo ? null : logoDataUrl ?? initialLogoUrl;

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
      setRemoveLogo(false);
      setSaved(false);
    } catch {
      setLogoError("Couldn't read that file. Try a different image.");
    }
  };

  const handleRemoveLogo = () => {
    setLogoDataUrl(null);
    setLogoName(null);
    setLogoError(null);
    if (fileRef.current) fileRef.current.value = "";
    // Only a logo the server already holds needs a delete request; a just-picked one is simply dropped.
    if (initialLogoUrl) setRemoveLogo(true);
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || disabled) return;
    setNameTouched(true);
    setWebsiteTouched(true);
    setGstinTouched(true);
    if (!nameValid || !websiteValid || !gstinValid) return;
    setFormError(null);
    setWebsiteServerError(null);
    setGstinServerError(null);
    setSaved(false);
    setSaving(true);
    const res = await submitCompanyProfileResult({ companyName: companyName.trim(), website: website.trim(), gstin: normalizeGstin(gstin), billingName: billingName.trim(), ...splitLogoDataUrl(logoDataUrl), ...(removeLogo && !logoDataUrl ? { removeLogo: true } : {}) });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setBaseline({ name: companyName, website, gstin, billingName });
      setLogoDataUrl(null);
      setLogoName(null);
      setRemoveLogo(false);
      onSaved?.();
      return;
    }
    if (res.error.code === "work_email_required") {
      setFormError("Employer accounts need a work email. Sign out and create your account with your company email address.");
    } else if (res.error.code === "account_deletion_pending") {
      setFormError("Your account is scheduled for deletion. Restore it with the Restore account button at the top of the page, then save again.");
    } else if (res.error.code === "account_suspended") {
      setFormError("Your account is suspended, so your company profile can't be changed. Contact support@hirestepx.com.");
    } else if (res.error.code === "invalid_gstin") setGstinServerError(res.error.error);
    else if (/website/i.test(res.error.error)) setWebsiteServerError(res.error.error);
    else setFormError(res.error.error);
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <FieldLabel required htmlFor={nameId}>Company name</FieldLabel>
        <Input
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
          disabled={disabled}
          className={FIELD_CLASS}
        />
        {nameError && <HelpText id={`${nameId}-err`} tone="error">{nameError}</HelpText>}
      </div>

      <div>
        <FieldLabel required htmlFor={websiteId}>Company website</FieldLabel>
        <Input
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
          disabled={disabled}
          className={FIELD_CLASS}
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
          <OutlineCta size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
            {logoSrc ? "Change logo" : "Upload logo"}
          </OutlineCta>
          {logoSrc && (
            <OutlineCta size="sm" disabled={disabled} onClick={handleRemoveLogo}>
              Remove logo
            </OutlineCta>
          )}
          <Input
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
            {removeLogo ? "The logo will be removed when you save. " : logoName ? `Selected: ${logoName}. ` : ""}PNG, JPG, or WEBP · up to {LOGO_MAX_MB} MB.
          </HelpText>
        )}
      </div>

      <fieldset className="m-0 flex flex-col gap-[18px] border-0 p-0">
        <legend style={legendStyle}>
          GST invoice details (optional)
        </legend>
        <div>
          <FieldLabel htmlFor={gstinId}>GSTIN</FieldLabel>
          <Input
            id={gstinId}
            name="company-gstin"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            value={gstin}
            onChange={(e) => { setGstin(e.target.value.toUpperCase()); setGstinServerError(null); setSaved(false); }}
            onBlur={() => setGstinTouched(true)}
            aria-invalid={gstinError ? true : undefined}
            aria-describedby={`${gstinId}-${gstinError ? "err" : "help"}`}
            placeholder="27AAPFU0939F1ZV"
            disabled={disabled}
            className={GSTIN_CLASS}
          />
          {gstinError ? (
            <HelpText id={`${gstinId}-err`} tone="error">{gstinError}</HelpText>
          ) : (
            <HelpText id={`${gstinId}-help`}>Printed on every invoice so you can claim input tax credit. You can add it later in Settings.</HelpText>
          )}
        </div>
        <div>
          <FieldLabel htmlFor={billingNameId}>Name on invoices</FieldLabel>
          <Input
            id={billingNameId}
            name="company-billing-name"
            autoComplete="organization"
            maxLength={120}
            value={billingName}
            onChange={(e) => { setBillingName(e.target.value); setSaved(false); }}
            placeholder="Legal name as registered for GST"
            disabled={disabled}
            className={FIELD_CLASS}
          />
          <HelpText>Leave blank to use your company name.</HelpText>
        </div>
      </fieldset>

      {formError && (
        <p role="alert" style={{ fontFamily: f.sans, fontSize: 13, color: t.errorInk, margin: 0 }}>{formError}</p>
      )}
      <p role="status" style={{ fontFamily: f.sans, fontSize: 13, color: t.successInk, margin: 0, minHeight: saved ? undefined : 0 }}>
        {saved ? "Saved." : ""}
      </p>

      <PrimaryCta full type="submit" loading={saving} disabled={disabled}>
        {saving ? busyLabel : submitLabel}
      </PrimaryCta>
    </form>
  );
}
