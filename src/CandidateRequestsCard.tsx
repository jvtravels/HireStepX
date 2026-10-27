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
import { ROUNDS, roundKeyForTopic } from "./focusRounds";
import { HIRING_REQUEST_FIELDS, isHiringField, type HiringRequestField } from "./employer/_candidateRequestTypes";
import { HIRING_FACT_MAX, NOTICE_PERIOD_OPTIONS, readHiringFacts, withHiringFacts, type HiringFacts } from "./hiringFacts";
import { isAiResume } from "./resumeParser";
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

type HiringValues = Record<HiringRequestField, string>;

const HIRING_INPUTS: Record<HiringRequestField, { label: string; placeholder: string; fact: "noticePeriod" | "currentCtc" | "expectedCtc" }> = {
  notice_period: { label: "Notice period", placeholder: "30 days", fact: "noticePeriod" },
  current_ctc: { label: "Current CTC", placeholder: "18 LPA", fact: "currentCtc" },
  expected_ctc: { label: "Expected CTC", placeholder: "24 LPA", fact: "expectedCtc" },
};

/** The hiring facts an employer asked for, in display order. */
export function hiringInputsFor(fields: readonly string[] | null | undefined): HiringRequestField[] {
  return HIRING_REQUEST_FIELDS.filter((f) => !!fields && fields.includes(f));
}

/** Returns the cleaned value, or an error message. A bare number is read as lakhs per annum. */
export function validateHiringValue(field: HiringRequestField, raw: string): { value: string } | { error: string } {
  const v = raw.replace(/\s+/g, " ").trim();
  const label = HIRING_INPUTS[field].label.toLowerCase();
  if (!v) return { error: `Add your ${label}, or decline.` };
  if (field === "notice_period") {
    if (!/immediate|\d/i.test(v)) return { error: "Enter your notice period, like 30 days or Immediate." };
  } else {
    if (!/\d/.test(v)) return { error: "Enter an amount, like 18 LPA." };
    if (/^\d+(\.\d+)?$/.test(v)) return { value: `${v} LPA`.slice(0, HIRING_FACT_MAX) };
  }
  return { value: v.slice(0, HIRING_FACT_MAX) };
}

/** What the employer reads under "Candidate replied". */
export function hiringReplyText(values: Partial<HiringValues>): string {
  return HIRING_REQUEST_FIELDS.filter((f) => values[f]).map((f) => `${HIRING_INPUTS[f].label}: ${values[f]}`).join(" · ");
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

function HiringForm({ values, errors, onChange, inputs }: {
  values: HiringValues;
  errors: Partial<HiringValues>;
  onChange: (field: HiringRequestField, value: string) => void;
  inputs: HiringRequestField[];
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-2.5">
      {inputs.map((field) => {
        const meta = HIRING_INPUTS[field];
        const id = `hiring-${field}`;
        return (
          <div key={field}>
            <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-hx-coal">{meta.label}</label>
            <Input
              id={id}
              list={field === "notice_period" ? "hiring-notice-options" : undefined}
              value={values[field]}
              onChange={(e) => onChange(field, e.target.value.slice(0, HIRING_FACT_MAX))}
              placeholder={meta.placeholder}
              aria-invalid={errors[field] ? true : undefined}
              aria-describedby={errors[field] ? `${id}-error` : undefined}
              className="h-9"
            />
            {errors[field] && <p id={`${id}-error`} role="alert" className="m-0 mt-1 text-[12px] text-hx-error-ink">{errors[field]}</p>}
          </div>
        );
      })}
      <datalist id="hiring-notice-options">{NOTICE_PERIOD_OPTIONS.map((o) => <option key={o} value={o} />)}</datalist>
      <p className="m-0 text-[12px] leading-normal text-hx-ink-soft">
        This employer sees your answer. It is also saved to your hiring details, which you can change any time.
      </p>
    </div>
  );
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

/** The round label when a practice request names one of the four focuses. */
export function roundLabelForRequest(request: Pick<JobRequest, "kind" | "topic">): string | null {
  if (request.kind !== "practice") return null;
  const key = roundKeyForTopic(request.topic);
  return ROUNDS.find((r) => r.key === key)?.label ?? null;
}

export interface PracticeLaunch {
  hrefFor: (focusLabel: string) => string;
  onStart: () => void;
}

function RequestRow({ matchId, request, unlocked, practice, onResolved, onError }: {
  matchId: string;
  request: JobRequest;
  unlocked: boolean;
  practice?: PracticeLaunch;
  onResolved: (id: string, resolution: "fulfilled" | "declined") => void;
  onError: (message: string) => void;
}) {
  const { user, updateUser } = useAuth();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"fulfilled" | "declined" | null>(null);
  const isContact = request.kind === "contact";
  const roundLabel = practice ? roundLabelForRequest(request) : null;
  const needsReply = request.kind === "clarification";
  const hiringInputs = isContact ? hiringInputsFor(request.fields) : [];
  const hiringOnly = hiringInputs.length > 0 && (request.fields ?? []).every(isHiringField);
  const contactInputs = isContact && !hiringOnly ? contactInputsFor(request.fields) : [];
  const [hiring, setHiring] = useState<HiringValues>(() => {
    const facts = readHiringFacts(user?.resumeData);
    return { notice_period: facts.noticePeriod, current_ctc: facts.currentCtc, expected_ctc: facts.expectedCtc };
  });
  const [hiringErrors, setHiringErrors] = useState<Partial<HiringValues>>({});
  const [contact, setContact] = useState<ContactValues>(() => ({
    phone: user?.resumeData?.phone ?? "",
    linkedin: user?.resumeData?.linkedin ?? "",
    portfolio: user?.portfolioLinks?.[0]?.url ?? "",
  }));
  const [contactErrors, setContactErrors] = useState<Partial<ContactValues>>({});

  /** Validates the hiring answers and saves them to the profile when the resume can hold them.
   *  The answer also travels in the reply, so a candidate without an AI resume can still respond. */
  const saveHiring = async (): Promise<string | null> => {
    const cleaned: Partial<HiringValues> = {};
    const errors: Partial<HiringValues> = {};
    for (const field of hiringInputs) {
      const r = validateHiringValue(field, hiring[field]);
      if ("error" in r) errors[field] = r.error; else cleaned[field] = r.value;
    }
    setHiringErrors(errors);
    if (Object.keys(errors).length > 0) return null;
    if (user && isAiResume(user.resumeData)) {
      const current = readHiringFacts(user.resumeData);
      const next: HiringFacts = { ...current };
      for (const field of hiringInputs) next[HIRING_INPUTS[field].fact] = cleaned[field] ?? "";
      try { await updateUser({ resumeData: withHiringFacts(user.resumeData, next) }); } catch { onError("Could not save your details. Try again."); return null; }
    }
    return hiringReplyText(cleaned);
  };

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
    let replyText = reply;
    if (isContact && resolution === "fulfilled") {
      if (hiringInputs.length > 0) {
        const text = await saveHiring();
        if (text === null) { setBusy(null); return; }
        replyText = text;
      }
      if (contactInputs.length > 0 && !(await saveContact())) { setBusy(null); return; }
    }
    const res = await resolveCandidateRequest(matchId, request.id, resolution, replyText);
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
        <>
          {hiringInputs.length > 0 && (
            <HiringForm
              values={hiring}
              errors={hiringErrors}
              onChange={(field, value) => { setHiring((h) => ({ ...h, [field]: value })); setHiringErrors((e) => ({ ...e, [field]: undefined })); }}
              inputs={hiringInputs}
            />
          )}
          {(contactInputs.length > 0 || !hiringOnly) && (
            <ContactForm
              values={contact}
              errors={contactErrors}
              onChange={(field, value) => { setContact((c) => ({ ...c, [field]: value })); setContactErrors((e) => ({ ...e, [field]: undefined })); }}
              inputs={contactInputs}
              includesEmail={!request.fields || request.fields.includes("email")}
            />
          )}
        </>
      ) : roundLabel && practice ? (
        <p className="m-0 mt-2 text-[13px] leading-normal text-hx-ink-soft">
          Complete a {roundLabel} practice session and your result is sent to this employer automatically. Nothing else to do.
        </p>
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
        {roundLabel && practice ? (
          <Button asChild size="sm">
            <a href={practice.hrefFor(roundLabel)} onClick={practice.onStart}>Practise {roundLabel}</a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy !== null || (needsReply && !reply.trim())} onClick={() => void submit("fulfilled")}>
            {busy === "fulfilled" ? "Saving…" : isContact ? "Share details" : "Send reply"}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void submit("declined")}>
          {busy === "declined" ? "Saving…" : "Decline"}
        </Button>
      </div>
    </li>
  );
}

export default function CandidateRequestsCard({ matchId, requests, unlocked, practice, onResolved, onError, style, className }: {
  matchId: string;
  requests: JobRequest[];
  unlocked: boolean;
  practice?: PracticeLaunch;
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
          <RequestRow key={r.id} matchId={matchId} request={r} unlocked={unlocked} practice={practice} onResolved={onResolved} onError={onError} />
        ))}
      </ul>
    </section>
  );
}
