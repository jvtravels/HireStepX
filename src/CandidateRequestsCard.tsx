"use client";

/* Candidate-side inbox for employer requests on one match: share a reply,
   fill in the contact details asked for, or decline. Backed by the
   resolve_request action in /api/candidate-employer-actions. */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "./AuthContext";
import { daysAgo } from "./hiringMatchFormat";
import { REQUEST_REPLY_MAX, resolveCandidateRequest } from "./employerActions";
import type { JobRequest } from "./DashboardJobs";

const PLACEHOLDER: Record<JobRequest["kind"], string> = {
  contact: "",
  document: "Describe what you are sharing, or paste a link once they have unlocked your profile.",
  practice: "Tell them when you will retake it, or add context for your earlier answer.",
  clarification: "Write your answer",
};

type ContactField = "phone" | "linkedin" | "portfolio";
type ContactValues = Record<ContactField, string>;

const CONTACT_INPUTS: Record<ContactField, { label: string; placeholder: string; type: string; autoComplete: string }> = {
  phone: { label: "Phone number", placeholder: "+91 98765 43210", type: "tel", autoComplete: "tel" },
  linkedin: { label: "LinkedIn profile", placeholder: "linkedin.com/in/your-name", type: "url", autoComplete: "url" },
  portfolio: { label: "Portfolio or GitHub link", placeholder: "github.com/your-name", type: "url", autoComplete: "url" },
};

/** Inputs to show: everything the employer asked for except email, which is
 *  the account email and is shared automatically on unlock. A legacy request
 *  with no field list asks for all three. */
export function contactInputsFor(fields: readonly string[] | null | undefined): ContactField[] {
  const all: ContactField[] = ["phone", "linkedin", "portfolio"];
  if (!fields || fields.length === 0) return all;
  return all.filter((f) => fields.includes(f));
}

const withScheme = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

/** Returns the cleaned value, or an error message for the field. */
export function validateContactValue(field: ContactField, raw: string): { value: string } | { error: string } {
  const v = raw.trim();
  if (!v) return { error: `Add your ${CONTACT_INPUTS[field].label.toLowerCase()}, or decline.` };
  if (field === "phone") {
    const digits = v.replace(/\D/g, "");
    if (!/^\+?[\d\s().-]+$/.test(v) || digits.length < 7 || digits.length > 15) return { error: "Enter a valid phone number." };
    return { value: v.slice(0, 30) };
  }
  const url = withScheme(v);
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".")) return { error: "Enter a valid link." };
    if (field === "linkedin" && !/(^|\.)linkedin\.com$/i.test(u.hostname)) return { error: "Enter your linkedin.com profile link." };
    return { value: url.slice(0, 500) };
  } catch {
    return { error: "Enter a valid link." };
  }
}

function ContactForm({ values, errors, onChange, inputs, includesEmail }: {
  values: ContactValues;
  errors: Partial<ContactValues>;
  onChange: (field: ContactField, value: string) => void;
  inputs: ContactField[];
  includesEmail: boolean;
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {inputs.map((field) => {
        const meta = CONTACT_INPUTS[field];
        const id = `contact-${field}`;
        return (
          <div key={field}>
            <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-hx-coal">{meta.label}</label>
            <Input
              id={id}
              type={meta.type}
              inputMode={field === "phone" ? "tel" : "url"}
              autoComplete={meta.autoComplete}
              placeholder={meta.placeholder}
              value={values[field]}
              onChange={(e) => onChange(field, e.target.value)}
              aria-invalid={errors[field] ? true : undefined}
              aria-describedby={errors[field] ? `${id}-error` : undefined}
              className="h-9"
            />
            {errors[field] && <p id={`${id}-error`} role="alert" className="m-0 mt-1 text-[12px] text-hx-error-ink">{errors[field]}</p>}
          </div>
        );
      })}
      <p className="m-0 text-[12px] leading-normal text-hx-ink-soft">
        {includesEmail ? "Your account email is shared too. " : ""}Employers only see these once they unlock your profile.
      </p>
    </div>
  );
}

function RequestRow({ matchId, request, unlocked, onResolved, onError }: {
  matchId: string;
  request: JobRequest;
  unlocked: boolean;
  onResolved: (id: string, resolution: "fulfilled" | "declined") => void;
  onError: (message: string) => void;
}) {
  const { user, updateUser } = useAuth();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"fulfilled" | "declined" | null>(null);
  const isContact = request.kind === "contact";
  const needsReply = request.kind === "clarification";
  const contactInputs = isContact ? contactInputsFor(request.fields) : [];
  const [contact, setContact] = useState<ContactValues>(() => ({
    phone: user?.resumeData?.phone ?? "",
    linkedin: user?.resumeData?.linkedin ?? "",
    portfolio: user?.portfolioLinks?.[0]?.url ?? "",
  }));
  const [contactErrors, setContactErrors] = useState<Partial<ContactValues>>({});

  const saveContact = async (): Promise<boolean> => {
    const cleaned: Partial<ContactValues> = {};
    const errors: Partial<ContactValues> = {};
    for (const field of contactInputs) {
      const r = validateContactValue(field, contact[field]);
      if ("error" in r) errors[field] = r.error; else cleaned[field] = r.value;
    }
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return false;
    const updates: Parameters<typeof updateUser>[0] = {};
    if (cleaned.phone || cleaned.linkedin) {
      if (!user?.resumeData) { onError("Add your resume first, then share your details."); return false; }
      updates.resumeData = { ...user.resumeData, ...(cleaned.phone ? { phone: cleaned.phone } : {}), ...(cleaned.linkedin ? { linkedin: cleaned.linkedin } : {}) };
    }
    if (cleaned.portfolio) {
      const url = cleaned.portfolio;
      const host = new URL(url).hostname.replace(/^www\./, "");
      updates.portfolioLinks = [...(user?.portfolioLinks ?? []).filter((l) => l.url !== url), { title: host, url }].slice(-5);
    }
    if (Object.keys(updates).length > 0) {
      try { await updateUser(updates); } catch { onError("Could not save your details. Try again."); return false; }
    }
    return true;
  };

  const submit = async (resolution: "fulfilled" | "declined") => {
    setBusy(resolution);
    if (isContact && resolution === "fulfilled" && !(await saveContact())) { setBusy(null); return; }
    const res = await resolveCandidateRequest(matchId, request.id, resolution, reply);
    setBusy(null);
    if (res.ok) onResolved(request.id, resolution);
    else onError(res.error);
  };

  return (
    <li className="list-none border-t border-hx-line py-3.5">
      <div className="text-[14px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{request.headline}</div>
      <div className="mt-0.5 text-[12px] text-hx-ink-soft">Asked {daysAgo(request.createdAt)}</div>
      {request.note && (
        <p className="m-0 mt-2 text-[14px] leading-normal whitespace-pre-line text-hx-coal [overflow-wrap:anywhere]">{request.note}</p>
      )}
      {isContact ? (
        <ContactForm
          values={contact}
          errors={contactErrors}
          onChange={(field, value) => { setContact((c) => ({ ...c, [field]: value })); setContactErrors((e) => ({ ...e, [field]: undefined })); }}
          inputs={contactInputs}
          includesEmail={!request.fields || request.fields.includes("email")}
        />
      ) : (
        <>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, REQUEST_REPLY_MAX))}
            placeholder={PLACEHOLDER[request.kind]}
            aria-label={`Your reply to: ${request.headline}`}
            rows={3}
            className="mt-2.5"
          />
          {!unlocked && (
            <p className="m-0 mt-1.5 text-[12px] text-hx-ink-soft">
              Links and contact details can be shared once this employer unlocks your profile.
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null || (needsReply && !reply.trim())} onClick={() => void submit("fulfilled")}>
          {busy === "fulfilled" ? "Saving…" : isContact ? "Share details" : "Send reply"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void submit("declined")}>
          {busy === "declined" ? "Saving…" : "Decline"}
        </Button>
      </div>
    </li>
  );
}

export default function CandidateRequestsCard({ matchId, requests, unlocked, onResolved, onError, style, className }: {
  matchId: string;
  requests: JobRequest[];
  unlocked: boolean;
  onResolved: (id: string, resolution: "fulfilled" | "declined") => void;
  onError: (message: string) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="job-requests-heading" style={style} className={className}>
      <h2 id="job-requests-heading" className="m-0 text-[16px] font-semibold leading-6 text-hx-coal">
        Requests from this employer
      </h2>
      <p className="mt-1 mb-1.5 text-[13px] leading-normal text-hx-ink-soft">
        Sharing more evidence can strengthen your profile. You can decline anything you would rather not provide.
      </p>
      <ul className="m-0 p-0">
        {requests.map((r) => (
          <RequestRow key={r.id} matchId={matchId} request={r} unlocked={unlocked} onResolved={onResolved} onError={onError} />
        ))}
      </ul>
    </section>
  );
}
