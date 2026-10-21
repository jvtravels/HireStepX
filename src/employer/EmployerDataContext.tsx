"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { authHeaders } from "@/supabase";
import { apiFetch } from "@/apiClient";
import type { CandidateRequestDto, CreateRequestBody } from "./_candidateRequestTypes";
import { getNetworkInfo, isSlowConnection } from "@/_browser-api-guards";
import { captureClientEvent } from "@/posthogClient";
import { isDashboardData, type EmployerDashboardData, type DashboardRange } from "./dashboardData";
import type { InvoiceSnapshot } from "../../server-handlers/_unlock-tax";
import { RequirementSummary, Requirement, Candidate, RequirementStage, RequirementFormValues, CandidateStatus, ArchiveDisposition } from "./mockData";

/* Real backend layer for the employer console — see server-handlers/
   employer-profile.ts, employer-requirements.ts,
   employer-requirement-detail.ts, employer-create-unlock-order.ts,
   employer-verify-unlock-payment.ts and the "Employer talent-roster
   feature" block in supabase-schema.sql.

   There is no admin-approval step: a saved company profile is "approved"
   straight away, so CompanyStatus only distinguishes "no profile yet" from
   "has a profile". What gates an employer is the verification tier (basic /
   email_verified / verified), which sets daily/open/rematch limits, and the
   `suspended` flag, which makes the console read-only. */

export type CompanyStatus = "none" | "approved";

export type EmployerTier = "basic" | "email_verified" | "verified";

export interface EmployerLimits {
  unlocksPerDay: number;
  openRequirements: number;
  rematchesPerHour: number;
}

/** Mirrors TIER_LIMITS in server-handlers/_employer-trust.ts. Only used until
 *  the profile response lands (the server value always wins), so a drift here
 *  just shows slightly stale numbers for one render — never enforces anything. */
const DEFAULT_TIER_LIMITS: Record<EmployerTier, EmployerLimits> = {
  basic: { unlocksPerDay: 3, openRequirements: 3, rematchesPerHour: 5 },
  email_verified: { unlocksPerDay: 25, openRequirements: 15, rematchesPerHour: 20 },
  verified: { unlocksPerDay: 100, openRequirements: 50, rematchesPerHour: 40 },
};

/** Structured failure from an employer API call. `code`/`limit`/`tier` are only
 *  present when the server sent them (402 unlock_required, 403 suspended, 429
 *  tier limits), so callers can branch on them instead of string-matching. */
export interface EmployerApiError {
  error: string;
  status?: number;
  code?: string;
  limit?: number;
  tier?: EmployerTier;
}

export type EmployerApiResult<T> = { ok: true; data: T } | { ok: false; error: EmployerApiError };


export interface UnlockOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
  /** Paise of the unlock price covered by account credit; amount is the remaining cash charge. */
  creditAppliedPaise?: number;
  /** Credit covered the whole price: there is nothing to pay and the unlock is already done. */
  paidWithCredit?: boolean;
  candidates?: Array<{ matchId: string; name: string; contact: { email: string } }>;
}

/** A single capability's verification state — mirrors EvidenceCapability in
 *  src/evidenceCapabilities.ts, the same module the candidate dashboard
 *  reads. "Verified" means 2+ practice sessions scored 70+ on it; this is
 *  never computed independently on the employer side, so it can't drift
 *  from what the candidate's own dashboard shows them. */
export interface VerifiedCapability {
  key: string;
  label: string;
  verified: boolean;
  verifiedDateLabel: string | null;
}

/** A candidate's actual per-skill scores from their most recent completed
 *  practice session — mirrors EvidenceSkill in
 *  server-handlers/_employer-candidate-evidence-helpers.ts. Empty `skills`
 *  means no completed session has skill data yet, not a zero score.
 *  `quotes`/`readiness`/`starCompleteness` mirror the same file's
 *  EvidenceQuote / EvidenceReadiness / StarCompleteness — all `null`/empty
 *  when the session's report predates that data or has none to show.
 *  `verifiedCapabilities` is computed across the candidate's full recent
 *  session history (not just the latest session) using the same bar as the
 *  candidate dashboard's Evidence Capabilities card. */
export interface CandidateEvidence {
  matchId: string;
  skills: Array<{ name: string; score: number }>;
  quotes: Array<{ kind: "win" | "redFlag"; text: string; quote: string }>;
  readiness: { band: "strongHire" | "hire" | "leanHire"; confidence: "low" | "medium" | "high" } | null;
  starCompleteness: { pct: number; questionsConsidered: number } | null;
  sessionDate: string | null;
  roleFit?: { status: "matched" | "mismatch" | "none"; practicedFor: string | null; practicedAt: string | null };
  verifiedCapabilities: VerifiedCapability[];
  sessionTrend?: Array<{ date: string; score: number; focus: string | null; type?: string | null }>;
  questions?: EvidenceQuestion[];
  delivery?: EvidenceDelivery | null;
  resumeFile?: { fileName: string } | null;
}

export interface EvidenceQuestion {
  idx: number;
  question: string;
  score: number;
  verdict: "strong" | "complete" | "partial" | "weak" | "skipped";
  difficulty: "warmup" | "standard" | "hard" | null;
  star: { S: boolean; T: boolean; A: boolean; R: boolean } | null;
  length: { verdict: "too-brief" | "right" | "too-long"; wordCount: number } | null;
  answerText?: string;
  explanation?: string;
}

export interface EvidenceDelivery {
  paceWpm: number | null;
  fillersPerMin: number | null;
  pausePct: number | null;
  responseSec: number | null;
  hedgesPerMin: number | null;
}

export interface RequirementActivity {
  id: string;
  action: "created" | "updated" | "archived" | "reopened" | "stage_changed";
  detail: string | null;
  createdAt: string;
}

/** One unlock purchase (single candidate or a batch of 10) — mirrors a row
 *  in employer_unlock_payments. `matchIds` holds one id for a single-candidate
 *  unlock, or the full batch for a bundle purchase. */
export interface UnlockPurchase {
  id: string;
  matchIds: string[];
  amount: number;
  currency: string;
  createdAt: string;
  /** Candidate name/email snapshotted at unlock time (supabase-migrations/0026),
   *  so the history still shows who this was even if the candidate's account
   *  (and match row, via cascade) has since been deleted. Null when the
   *  match row is gone or predates the snapshot column. */
  candidates: Array<{ matchId: string; name: string | null; email: string | null }>;
  /** Added by the payments ledger; absent on older rows/servers. */
  invoiceNo?: string | null;
  refundedAt?: string | null;
  requirementId?: string | null;
  status?: string;
  orderId?: string | null;
  /** Paise of this purchase paid from account credit (amount is the cash part). */
  creditAppliedPaise?: number;
  gstin?: string | null;
  billingName?: string | null;
  /** Frozen invoice data from fulfilment (migration 0045); null/absent on legacy rows. */
  invoiceSnapshot?: InvoiceSnapshot | null;
  /** Cumulative paise refunded when the payment was only partly refunded. */
  partialRefundPaise?: number;
  partialRefundAt?: string | null;
  /** One entry per refund (migration 0047); absent/empty means the number is derived from the invoice. */
  creditNotes?: Array<{ no: string; amountPaise: number; issuedAt: string }>;
}

export interface CreditEvent {
  kind: "refund" | "spend" | "release";
  amountPaise: number;
  label: string;
  createdAt: string;
}

export interface CreditSummary {
  balancePaise: number;
  events: CreditEvent[];
}

/** One message in an employer<->candidate conversation thread. Mirrors
 *  toMessageShape() in server-handlers/messages.ts. */
export interface ConversationMessage {
  id: string;
  senderRole: "employer" | "candidate" | "system";
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  attachmentMime: string | null;
  flagged: boolean;
  createdAt: string;
  /** True when the server hid a phone number or email in this body while the match is locked. */
  contactRedacted?: boolean;
}

/** One row in the employer's conversation inbox. Mirrors the shape
 *  GET /api/messages (no matchId) returns for either side. */
export interface ConversationSummary {
  matchId: string;
  conversationId: string;
  role: "employer" | "candidate";
  counterpartName: string;
  roleTitle: string;
  lastMessageAt: string | null;
  unread: boolean;
  candidateStatus: CandidateStatus;
  matchScore: number | null;
}

/** Thread-level context returned alongside GET /api/messages?matchId= — the
 *  job/company/pipeline-state framing the thread is read against. Mirrors
 *  `context` in messages.ts's handleGet response. */
export interface ConversationContext {
  roleTitle: string;
  companyName: string;
  candidateName: string;
  matchScore: number | null;
  candidateStatus: CandidateStatus;
  interviewScheduledAt: string | null;
  viewerRole: "employer" | "candidate";
  /** The candidate's own reply to this employer ("interested" opens messaging pre-unlock). */
  candidateResponse?: "none" | "interested" | "declined" | null;
  /** True while the employer hasn't unlocked: candidate-written phone/email is masked in message bodies. */
  contactLocked?: boolean;
  contactNotice?: string | null;
  candidateWithdrew?: boolean;
}

interface ProfileFields { companyName: string; website: string; logoBase64?: string; logoContentType?: string; gstin?: string; billingName?: string; removeLogo?: boolean }
type UnlockRequest = { mode: "single"; matchId: string } | { mode: "batch"; requirementId: string };
type VerifyPayload = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type VerifyResult = { candidates: Array<{ matchId: string; name: string; contact: { email: string } }> };
/** `note` is the employer's PRIVATE note (never shown to the candidate).
 *  `candidateMessage` is the optional message the candidate will see. */
type StatusPayload = { candidateStatus: CandidateStatus; note?: string; candidateMessage?: string; interviewScheduledAt?: string };
type MessagePayload = { body?: string; attachmentPath?: string; attachmentName?: string; attachmentMime?: string };

interface EmployerDataContextValue {
  companyStatus: CompanyStatus;
  companyStatusLoading: boolean;
  /** True when the profile could not be loaded at all (after retries), so
   *  "none" means "unknown" — pages must offer a retry, not onboarding. */
  companyStatusError: boolean;
  companyLogoUrl: string | null;
  companyName: string;
  companyWebsite: string;
  /** Buyer GSTIN / billing name printed on invoices; empty when not provided. */
  companyGstin: string;
  companyBillingName: string;
  verificationTier: EmployerTier;
  limits: EmployerLimits;
  /** Suspended employers can read but not act; the server rejects writes with 403. */
  suspended: boolean;
  /** Part of `suspended`: the account is in its 7-day deletion grace period (restore by logging in again). */
  deletionPending: boolean;
  requirements: RequirementSummary[];
  requirementsLoading: boolean;
  requirementsError: boolean;
  refreshCompanyStatus: () => Promise<void>;
  submitCompanyProfile: (fields: ProfileFields) => Promise<boolean>;
  /** Same call as submitCompanyProfile but returns the server's message (e.g.
   *  the website validation error) instead of collapsing it to false. */
  submitCompanyProfileResult: (fields: ProfileFields) => Promise<EmployerApiResult<null>>;
  addRequirement: (r: RequirementFormValues) => Promise<{ id: string } | EmployerApiError>;
  updateRequirement: (id: string, r: RequirementFormValues) => Promise<{ ok: true } | EmployerApiError>;
  createUnlockOrder: (request: UnlockRequest) => Promise<UnlockOrder | null>;
  /** Same as createUnlockOrder but surfaces 429 {limit, tier}, 403 suspended etc. */
  createUnlockOrderResult: (request: UnlockRequest) => Promise<EmployerApiResult<UnlockOrder>>;
  verifyUnlockPayment: (payload: VerifyPayload) => Promise<VerifyResult | null>;
  /** Loads the job with its whole shortlist (every page, capped at MAX_SHORTLIST_CANDIDATES);
   *  pass `{ firstPageOnly: true }` when only job fields are needed. `onFirstPage` receives the top 25 early so the screen can paint before the rest arrives. `total` is the true count. */
  /** A job's shortlist. Reuses a result fetched in the last 30 s (and joins one already in flight) unless `fresh` is set. */
  fetchRequirementDetail: (id: string, options?: { firstPageOnly?: boolean; fresh?: boolean; onFirstPage?: (partial: Requirement) => void }) => Promise<Requirement | null>;
  /** Warms the detail cache ahead of a click; a no-op when it is already warm. */
  prefetchRequirementDetail: (id: string) => void;
  archiveRequirement: (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => Promise<boolean>;
  /** Same as archiveRequirement but also returns the candidates "reject_remaining" changed, so the caller can offer Undo. */
  archiveRequirementResult: (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => Promise<{ ok: boolean; rejectedMatches: ArchivedMatchRecord[] }>;
  /** Puts candidates rejected by an archive back to the status they held. Resolves to how many were restored, or null on failure. */
  restoreArchivedMatches: (id: string, matches: readonly ArchivedMatchRecord[]) => Promise<number | null>;
  reopenRequirement: (id: string) => Promise<boolean>;
  updateRequirementStage: (id: string, stage: RequirementStage) => Promise<boolean>;
  updateCandidateStatus: (matchId: string, payload: StatusPayload) => Promise<boolean>;
  /** Same as updateCandidateStatus but exposes `code: "unlock_required"` (402) / suspended (403). */
  updateCandidateStatusResult: (matchId: string, payload: StatusPayload) => Promise<EmployerApiResult<null>>;
  fetchCandidateRequests: (matchId: string) => Promise<{ requests: CandidateRequestDto[]; available: boolean } | null>;
  createCandidateRequest: (matchId: string, body: CreateRequestBody) => Promise<EmployerApiResult<CandidateRequestDto>>;
  cancelCandidateRequest: (matchId: string, requestId: string) => Promise<EmployerApiResult<CandidateRequestDto>>;
  fetchCandidateEvidence: (matchId: string) => Promise<CandidateEvidence | null>;
  fetchCandidateResumeUrl: (matchId: string) => Promise<{ url: string; fileName: string } | null>;
  fetchRequirementActivity: (id: string) => Promise<RequirementActivity[] | null>;
  fetchUnlockHistory: () => Promise<UnlockPurchase[] | null>;
  fetchCredit: () => Promise<CreditSummary | null>;
  fetchDashboard: (range: DashboardRange) => Promise<EmployerDashboardData | null>;
  refreshRequirements: () => Promise<void>;
  listConversations: () => Promise<ConversationSummary[] | null>;
  fetchMessages: (matchId: string) => Promise<{ messages: ConversationMessage[]; context: ConversationContext | null } | null>;
  sendMessage: (matchId: string, payload: MessagePayload) => Promise<ConversationMessage | null>;
  sendMessageResult: (matchId: string, payload: MessagePayload) => Promise<EmployerApiResult<ConversationMessage>>;
  uploadMessageAttachment: (matchId: string, file: { fileName: string; contentType: string; fileBase64: string }) => Promise<{ attachmentPath: string; attachmentName: string; attachmentMime: string } | { error: string }>;
  flagMessage: (messageId: string, reason: string, note?: string) => Promise<boolean>;
  fetchMessageAttachmentUrl: (messageId: string) => Promise<string | null>;
}

export interface ArchivedMatchRecord {
  id: string;
  previousStatus: string;
}

function parseArchivedMatches(data: Record<string, unknown>): ArchivedMatchRecord[] {
  if (!Array.isArray(data.rejectedMatches)) return [];
  const out: ArchivedMatchRecord[] = [];
  for (const m of data.rejectedMatches) {
    if (isRecord(m) && typeof m.id === "string" && typeof m.previousStatus === "string") out.push({ id: m.id, previousStatus: m.previousStatus });
  }
  return out;
}

const EmployerDataContext = createContext<EmployerDataContextValue | null>(null);

export function useEmployerData() {
  const ctx = useContext(EmployerDataContext);
  if (!ctx) throw new Error("useEmployerData must be used within EmployerDataProvider");
  return ctx;
}

/* ── Helpers ── */

const SHORTLIST_PAGE_LIMIT = 100;
const FIRST_PAINT_LIMIT = 25;
/** Upper bound on candidates loaded into one job page; beyond it the page says "showing N of M". */
export const MAX_SHORTLIST_CANDIDATES = 500;
/** How long a fetched job shortlist is reused before the next open asks the server again. */
const DETAIL_CACHE_TTL_MS = 30_000;
/** How long the pointer must rest on a row before its job is prefetched. */
const PREFETCH_DWELL_MS = 150;
const RETRY_DELAYS_MS = [300, 900];
/** A stalled connection otherwise sits on skeletons for the browser's own ~45s timeout; cutting it sooner lets the retry (which usually lands) run. */
const GET_ATTEMPT_TIMEOUT_MS = 10_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Server failures and dead networks are worth a ticket; 4xx and 429 are answers. */
function reportFetchFailure(url: string, status: number | null) {
  const path = url.split("?")[0];
  void import("../errorReporter").then((m) => m.reportHandledError(`Employer fetch failed: ${path} ${status ?? "network"}`)).catch(() => {});
}

/** Only the heavy shortlist reads are timed; one in ten loads is sampled to keep event volume low. */
const TIMED_PATHS = new Set(["/api/employer-requirements", "/api/employer-requirement-detail", "/api/employer-candidate-evidence"]);
const TIMING_SAMPLE_RATE = 0.1;

function reportFetchTiming(url: string, startedAt: number, serverTiming: string | null) {
  const path = url.split("?")[0];
  if (!TIMED_PATHS.has(path) || Math.random() >= TIMING_SAMPLE_RATE) return;
  const handlerMs = Number(serverTiming?.match(/handler;dur=([\d.]+)/)?.[1]);
  captureClientEvent("employer_api_timing", {
    path,
    total_ms: Math.round(performance.now() - startedAt),
    handler_ms: Number.isFinite(handlerMs) ? Math.round(handlerMs) : null,
  });
}

/** GET with exponential backoff. Only transient failures retry (network error,
 *  5xx); a 4xx is a real answer and returns immediately. 429 is not retried:
 *  the limiter's window outlasts our backoff, so retrying only spends the
 *  user's remaining budget. Never throws — `null` means the network never
 *  produced a response. Idempotent GETs only. */
export async function getWithRetry(url: string): Promise<{ ok: boolean; status: number; data: unknown } | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const last = attempt === RETRY_DELAYS_MS.length;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GET_ATTEMPT_TIMEOUT_MS);
    try {
      const headers = await authHeaders();
      const startedAt = performance.now();
      const res = await fetch(url, { headers, signal: controller.signal });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok) reportFetchTiming(url, startedAt, res.headers.get("server-timing"));
      if (res.status < 500 || last) {
        if (res.status >= 500) reportFetchFailure(url, res.status);
        return { ok: res.ok, status: res.status, data };
      }
    } catch {
      if (last) {
        reportFetchFailure(url, null);
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
    await wait(RETRY_DELAYS_MS[attempt]);
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseTier(v: unknown): EmployerTier {
  return v === "email_verified" || v === "verified" ? v : "basic";
}

function parseLimits(v: unknown, tier: EmployerTier): EmployerLimits {
  const base = DEFAULT_TIER_LIMITS[tier];
  if (!isRecord(v)) return base;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  return {
    unlocksPerDay: num(v.unlocksPerDay, base.unlocksPerDay),
    openRequirements: num(v.openRequirements, base.openRequirements),
    rematchesPerHour: num(v.rematchesPerHour, base.rematchesPerHour),
  };
}

function toApiError(res: { status: number; error: string | null; errorData: unknown }, fallback: string): EmployerApiError {
  const body = isRecord(res.errorData) ? res.errorData : {};
  const message = typeof body.error === "string" && body.error ? body.error : fallback;
  return {
    error: message,
    status: res.status || undefined,
    code: typeof body.code === "string" ? body.code : undefined,
    limit: typeof body.limit === "number" ? body.limit : undefined,
    tier: body.tier === "basic" || body.tier === "email_verified" || body.tier === "verified" ? body.tier : undefined,
  };
}

const SUSPENDED_MESSAGE = "Your account is suspended. Contact support to restore access.";

/* ── Provider ── */

export function EmployerDataProvider({ children }: { children: React.ReactNode }) {
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>("none");
  const [companyStatusLoading, setCompanyStatusLoading] = useState(true);
  const [companyStatusError, setCompanyStatusError] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyBillingName, setCompanyBillingName] = useState("");
  const [verificationTier, setVerificationTier] = useState<EmployerTier>("basic");
  const [limits, setLimits] = useState<EmployerLimits>(DEFAULT_TIER_LIMITS.basic);
  const [suspended, setSuspended] = useState(false);
  const [deletionPending, setDeletionPending] = useState(false);
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [requirementsLoaded, setRequirementsLoaded] = useState(false);
  const [requirementsError, setRequirementsError] = useState(false);

  // Read by long-lived callbacks so they never close over a stale status/tier.
  const statusRef = useRef<CompanyStatus>("none");
  const tierRef = useRef<EmployerTier>("basic");
  const requirementsSeq = useRef(0);

  const applyProfile = useCallback((data: Record<string, unknown>, fallback?: { companyName: string; website: string }) => {
    const status: CompanyStatus = data.status === "approved" ? "approved" : "none";
    const tier = parseTier(data.verificationTier);
    statusRef.current = status;
    tierRef.current = tier;
    setCompanyStatus(status);
    setCompanyLogoUrl(typeof data.logoUrl === "string" ? data.logoUrl : null);
    setCompanyName(typeof data.companyName === "string" ? data.companyName : fallback?.companyName ?? "");
    setCompanyWebsite(typeof data.website === "string" ? data.website : fallback?.website ?? "");
    setCompanyGstin(typeof data.gstin === "string" ? data.gstin : "");
    setCompanyBillingName(typeof data.billingName === "string" ? data.billingName : "");
    setVerificationTier(tier);
    setLimits(parseLimits(data.limits, tier));
    setSuspended(data.suspended === true);
    setDeletionPending(data.deletionPending === true);
  }, []);

  const refreshCompanyStatus = useCallback(async () => {
    const res = await getWithRetry("/api/employer-profile");
    if (res && res.ok && isRecord(res.data)) {
      applyProfile(res.data);
      setCompanyStatusError(false);
    } else {
      // Keep whatever we last knew; flag it so the UI offers a retry rather
      // than mistaking a network failure for "no company profile yet".
      setCompanyStatusError(true);
    }
    setCompanyStatusLoading(false);
  }, [applyProfile]);

  /* The jobs list is requested together with the company profile instead of
     after it. The list is scoped to the signed-in employer server-side, so for
     a company that turns out not to be approved the answer is simply unused. */
  const earlyRequirements = useRef<ReturnType<typeof getWithRetry> | null>(null);

  useEffect(() => {
    earlyRequirements.current = getWithRetry("/api/employer-requirements");
    refreshCompanyStatus();
  }, [refreshCompanyStatus]);

  const refreshRequirements = useCallback(async () => {
    if (statusRef.current !== "approved") return;
    const seq = ++requirementsSeq.current;
    const early = earlyRequirements.current;
    earlyRequirements.current = null;
    const res = await (early ?? getWithRetry("/api/employer-requirements"));
    // A newer refresh started while this one was in flight — let it win.
    if (seq !== requirementsSeq.current) return;
    if (res && res.ok && isRecord(res.data) && Array.isArray(res.data.requirements)) {
      setRequirements(res.data.requirements as RequirementSummary[]);
      setRequirementsError(false);
    } else {
      // leave previous list in place on a transient failure, but surface it
      setRequirementsError(true);
    }
    setRequirementsLoaded(true);
  }, []);

  /* Initial load only: an approved company with no completed fetch yet is
     "loading", so the first paint is a skeleton instead of a false empty
     state. Later refreshes (archive, reopen) keep the list on screen. */
  const requirementsLoading = companyStatus === "approved" && !requirementsLoaded;

  useEffect(() => {
    refreshRequirements();
  }, [companyStatus, refreshRequirements]);

  const detailCache = useRef(new Map<string, { at: number; value: Requirement }>());
  const detailInflight = useRef(new Map<string, Promise<Requirement | null>>());
  const detailGeneration = useRef(0);

  /** Called after anything that changes a shortlist, so the next open can't show it stale. */
  const invalidateDetails = useCallback(() => {
    detailGeneration.current++;
    detailCache.current.clear();
    detailInflight.current.clear();
  }, []);

  const submitCompanyProfileResult = useCallback(async (fields: ProfileFields): Promise<EmployerApiResult<null>> => {
    const wasNew = statusRef.current === "none";
    const res = await apiFetch<Record<string, unknown>>("/api/employer-profile", fields, { method: "POST" });
    if (res.ok && isRecord(res.data)) {
      applyProfile(res.data, { companyName: fields.companyName, website: fields.website });
      setCompanyStatusError(false);
      if (wasNew) captureClientEvent("employer_company_created", { has_logo: Boolean(fields.logoBase64), tier: tierRef.current });
      return { ok: true, data: null };
    }
    return { ok: false, error: toApiError(res, "Couldn't save your company profile. Please try again.") };
  }, [applyProfile]);

  const submitCompanyProfile = useCallback(async (fields: ProfileFields) => (await submitCompanyProfileResult(fields)).ok, [submitCompanyProfileResult]);

  const addRequirement = useCallback(async (r: RequirementFormValues): Promise<{ id: string } | EmployerApiError> => {
    const res = await apiFetch<{ id: string }>("/api/employer-requirements", r, { method: "POST" });
    if (res.ok && res.data) {
      captureClientEvent("employer_requirement_created", { tier: tierRef.current });
      refreshRequirements();
      return { id: res.data.id };
    }
    const err = toApiError(res, "Couldn't create this job. Please try again.");
    if (res.status === 403 && !err.code) err.code = "suspended";
    return err;
  }, [refreshRequirements]);

  const updateRequirement = useCallback(async (id: string, r: RequirementFormValues): Promise<{ ok: true } | EmployerApiError> => {
    const res = await apiFetch<{ id: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, r, { method: "PATCH" });
    if (res.ok && res.data) {
      invalidateDetails();
      refreshRequirements();
      return { ok: true as const };
    }
    return toApiError(res, "Couldn't save changes. Please try again.");
  }, [refreshRequirements, invalidateDetails]);

  const createUnlockOrderResult = useCallback(async (request: UnlockRequest): Promise<EmployerApiResult<UnlockOrder>> => {
    captureClientEvent("employer_unlock_started", { mode: request.mode, tier: tierRef.current });
    const res = await apiFetch<UnlockOrder>("/api/employer-create-unlock-order", request, { method: "POST" });
    if (res.ok && res.data) return { ok: true, data: res.data };
    const err = toApiError(res, res.status === 403 ? SUSPENDED_MESSAGE : "Couldn't start payment. Please try again.");
    if (res.status === 429 && err.limit !== undefined) {
      captureClientEvent("employer_unlock_limit_hit", { mode: request.mode, limit: err.limit, tier: err.tier ?? tierRef.current });
    }
    return { ok: false, error: err };
  }, []);

  const createUnlockOrder = useCallback(async (request: UnlockRequest) => {
    const res = await createUnlockOrderResult(request);
    return res.ok ? res.data : null;
  }, [createUnlockOrderResult]);

  const verifyUnlockPayment = useCallback(async (payload: VerifyPayload) => {
    const res = await apiFetch<VerifyResult>("/api/employer-verify-unlock-payment", payload, { method: "POST" });
    if (res.ok && res.data) {
      invalidateDetails();
      captureClientEvent("employer_unlock_completed", { unlocked: res.data.candidates.length, tier: tierRef.current });
      return res.data;
    }
    return null;
  }, [invalidateDetails]);

  const loadRequirementDetail = useCallback(async (id: string, onFirstPage?: (partial: Requirement) => void): Promise<Requirement | null> => {
    const base = `/api/employer-requirement-detail?id=${encodeURIComponent(id)}`;
    // A small first page lets the screen paint while the rest loads; every
    // request repeats the server's ranking, so the remainder is fetched in
    // parallel rather than one page after another.
    const fullFirst = getWithRetry(`${base}&page=1&limit=${SHORTLIST_PAGE_LIMIT}`);
    const quick = onFirstPage ? await getWithRetry(`${base}&page=1&limit=${FIRST_PAINT_LIMIT}`) : null;
    if (quick && quick.ok && quick.data) onFirstPage?.(quick.data as Requirement);
    const first = await fullFirst;
    if (!first || !first.ok || !first.data) return quick && quick.ok ? (quick.data as Requirement) : null;
    const detail = first.data as Requirement;
    const total = Math.min(detail.total ?? detail.candidates.length, MAX_SHORTLIST_CANDIDATES);
    const lastPage = Math.ceil(total / SHORTLIST_PAGE_LIMIT);
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) => getWithRetry(`${base}&page=${i + 2}&limit=${SHORTLIST_PAGE_LIMIT}`)),
    );
    const seen = new Set(detail.candidates.map((c) => c.id));
    let candidates = detail.candidates;
    let next: number | null = detail.nextPage ?? null;
    for (const more of rest) {
      if (!more || !more.ok || !isRecord(more.data) || !Array.isArray(more.data.candidates)) break;
      const fresh = (more.data.candidates as Candidate[]).filter((c) => !seen.has(c.id));
      for (const c of fresh) seen.add(c.id);
      candidates = candidates.concat(fresh);
      next = typeof more.data.nextPage === "number" ? more.data.nextPage : null;
    }
    return { ...detail, candidates, nextPage: next };
  }, []);

  const fetchRequirementDetail = useCallback(async (id: string, options?: { firstPageOnly?: boolean; fresh?: boolean; onFirstPage?: (partial: Requirement) => void }): Promise<Requirement | null> => {
    if (options?.firstPageOnly) {
      const only = await getWithRetry(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`);
      return only && only.ok && only.data ? (only.data as Requirement) : null;
    }
    if (!options?.fresh) {
      const hit = detailCache.current.get(id);
      if (hit && Date.now() - hit.at < DETAIL_CACHE_TTL_MS) return hit.value;
      const pending = detailInflight.current.get(id);
      if (pending) return pending;
    }
    const generation = detailGeneration.current;
    const run: Promise<Requirement | null> = loadRequirementDetail(id, options?.onFirstPage).then((value) => {
      // A change landed while this was in flight: the answer may predate it.
      if (value && generation === detailGeneration.current) detailCache.current.set(id, { at: Date.now(), value });
      return value;
    }).finally(() => {
      if (detailInflight.current.get(id) === run) detailInflight.current.delete(id);
    });
    detailInflight.current.set(id, run);
    return run;
  }, [loadRequirementDetail]);

  // Only the row the pointer rests on is warmed: a sweep across a table would
  // otherwise burn the detail endpoint's per-minute budget on rows never opened.
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchRequirementDetail = useCallback((id: string) => {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    const net = getNetworkInfo();
    if (net?.saveData || isSlowConnection()) return;
    prefetchTimer.current = setTimeout(() => { void fetchRequirementDetail(id); }, PREFETCH_DWELL_MS);
  }, [fetchRequirementDetail]);

  const archiveRequirementResult = useCallback(async (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => {
    const res = await apiFetch<{ status: string }>(
      `/api/employer-requirement-detail?id=${encodeURIComponent(id)}`,
      { action: "archive", archiveReason: options?.archiveReason, archiveDisposition: options?.archiveDisposition },
      { method: "PATCH" },
    );
    if (!res.ok) return { ok: false, rejectedMatches: [] };
    invalidateDetails();
    refreshRequirements();
    return { ok: true, rejectedMatches: isRecord(res.data) ? parseArchivedMatches(res.data) : [] };
  }, [refreshRequirements, invalidateDetails]);

  const archiveRequirement = useCallback(async (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => {
    return (await archiveRequirementResult(id, options)).ok;
  }, [archiveRequirementResult]);

  const restoreArchivedMatches = useCallback(async (id: string, matches: readonly ArchivedMatchRecord[]) => {
    const res = await apiFetch<{ restored: number }>(
      `/api/employer-requirement-detail?id=${encodeURIComponent(id)}`,
      { action: "restore", matches },
      { method: "PATCH" },
    );
    if (!res.ok) return null;
    invalidateDetails();
    refreshRequirements();
    return isRecord(res.data) && typeof res.data.restored === "number" ? res.data.restored : matches.length;
  }, [refreshRequirements, invalidateDetails]);

  const reopenRequirement = useCallback(async (id: string) => {
    const res = await apiFetch<{ status: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { action: "reopen" }, { method: "PATCH" });
    if (res.ok) {
      invalidateDetails();
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements, invalidateDetails]);

  const updateRequirementStage = useCallback(async (id: string, stage: RequirementStage) => {
    const res = await apiFetch<{ stage: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { action: "set_stage", stage }, { method: "PATCH" });
    if (res.ok) {
      invalidateDetails();
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements, invalidateDetails]);

  const updateCandidateStatusResult = useCallback(async (matchId: string, payload: StatusPayload): Promise<EmployerApiResult<null>> => {
    const res = await apiFetch<{ id: string; candidateStatus: string }>(
      "/api/employer-candidate-status",
      { matchId, candidateStatus: payload.candidateStatus, note: payload.note, candidateMessage: payload.candidateMessage, interviewScheduledAt: payload.interviewScheduledAt },
      { method: "PATCH" },
    );
    if (res.ok) {
      invalidateDetails();
      return { ok: true, data: null };
    }
    const err = toApiError(res, res.status === 403 ? SUSPENDED_MESSAGE : "Couldn't update this candidate. Please try again.");
    if (res.status === 402 && !err.code) err.code = "unlock_required";
    return { ok: false, error: err };
  }, [invalidateDetails]);

  const updateCandidateStatus = useCallback(async (matchId: string, payload: StatusPayload) => (await updateCandidateStatusResult(matchId, payload)).ok, [updateCandidateStatusResult]);

  const fetchCandidateRequests = useCallback(async (matchId: string) => {
    const res = await getWithRetry(`/api/employer-candidate-requests?matchId=${encodeURIComponent(matchId)}`);
    if (!res || !res.ok || !isRecord(res.data) || !Array.isArray(res.data.requests)) return null;
    return { requests: res.data.requests as CandidateRequestDto[], available: res.data.available !== false };
  }, []);

  const createCandidateRequest = useCallback(async (matchId: string, body: CreateRequestBody): Promise<EmployerApiResult<CandidateRequestDto>> => {
    const res = await apiFetch<{ request?: CandidateRequestDto }>("/api/employer-candidate-requests", { matchId, ...body }, { method: "POST" });
    if (res.ok && res.data?.request) {
      invalidateDetails();
      return { ok: true, data: res.data.request };
    }
    return { ok: false, error: toApiError(res, res.status === 403 ? SUSPENDED_MESSAGE : "Couldn't send the request. Please try again.") };
  }, [invalidateDetails]);

  const cancelCandidateRequest = useCallback(async (matchId: string, requestId: string): Promise<EmployerApiResult<CandidateRequestDto>> => {
    const res = await apiFetch<{ request?: CandidateRequestDto }>("/api/employer-candidate-requests", { action: "cancel", matchId, requestId }, { method: "POST" });
    if (res.ok && res.data?.request) {
      invalidateDetails();
      return { ok: true, data: res.data.request };
    }
    return { ok: false, error: toApiError(res, "Couldn't cancel the request. Please try again.") };
  }, [invalidateDetails]);

  const fetchCandidateEvidence = useCallback(async (matchId: string): Promise<CandidateEvidence | null> => {
    const res = await getWithRetry(`/api/employer-candidate-evidence?matchId=${encodeURIComponent(matchId)}`);
    if (!res || !res.ok || !res.data) return null;
    const evidence = res.data as CandidateEvidence;
    return Array.isArray(evidence.skills) ? evidence : null;
  }, []);

  const fetchCandidateResumeUrl = useCallback(async (matchId: string): Promise<{ url: string; fileName: string } | null> => {
    const res = await getWithRetry(`/api/employer-candidate-resume-url?matchId=${encodeURIComponent(matchId)}`);
    if (!res || !res.ok || !isRecord(res.data) || typeof res.data.url !== "string") return null;
    return { url: res.data.url, fileName: typeof res.data.fileName === "string" ? res.data.fileName : "resume" };
  }, []);

  const fetchRequirementActivity = useCallback(async (id: string): Promise<RequirementActivity[] | null> => {
    const res = await getWithRetry(`/api/employer-requirement-activity?id=${encodeURIComponent(id)}`);
    if (!res || !res.ok || !isRecord(res.data) || !Array.isArray(res.data.activity)) return null;
    return res.data.activity as RequirementActivity[];
  }, []);

  const fetchUnlockHistory = useCallback(async (): Promise<UnlockPurchase[] | null> => {
    const res = await getWithRetry("/api/employer-unlock-history");
    if (!res || !res.ok || !isRecord(res.data) || !Array.isArray(res.data.purchases)) return null;
    return res.data.purchases as UnlockPurchase[];
  }, []);

  const fetchCredit = useCallback(async (): Promise<CreditSummary | null> => {
    const res = await getWithRetry("/api/employer-credit");
    if (!res || !res.ok || !isRecord(res.data) || typeof res.data.balancePaise !== "number") return null;
    return { balancePaise: res.data.balancePaise, events: Array.isArray(res.data.events) ? (res.data.events as CreditEvent[]) : [] };
  }, []);

  const fetchDashboard = useCallback(async (range: DashboardRange): Promise<EmployerDashboardData | null> => {
    const res = await getWithRetry(`/api/employer-dashboard?range=${range}`);
    if (!res || !res.ok || !isDashboardData(res.data)) return null;
    return res.data;
  }, []);

  const listConversations = useCallback(async (): Promise<ConversationSummary[] | null> => {
    const res = await getWithRetry("/api/messages");
    if (!res || !res.ok || !isRecord(res.data)) return null;
    return (Array.isArray(res.data.conversations) ? res.data.conversations : []) as ConversationSummary[];
  }, []);

  const fetchMessages = useCallback(async (matchId: string): Promise<{ messages: ConversationMessage[]; context: ConversationContext | null } | null> => {
    const res = await getWithRetry(`/api/messages?matchId=${encodeURIComponent(matchId)}`);
    if (!res || !res.ok || !isRecord(res.data)) return null;
    return {
      messages: (Array.isArray(res.data.messages) ? res.data.messages : []) as ConversationMessage[],
      context: (res.data.context ?? null) as ConversationContext | null,
    };
  }, []);

  const sendMessageResult = useCallback(async (matchId: string, payload: MessagePayload): Promise<EmployerApiResult<ConversationMessage>> => {
    const res = await apiFetch<{ conversationId: string; message: ConversationMessage }>(
      "/api/messages",
      { matchId, body: payload.body, attachmentPath: payload.attachmentPath, attachmentName: payload.attachmentName, attachmentMime: payload.attachmentMime },
      { method: "POST" },
    );
    if (res.ok && res.data) return { ok: true, data: res.data.message };
    const err = toApiError(res, res.status === 403 ? SUSPENDED_MESSAGE : "Couldn't send message. Please try again.");
    if (res.status === 402 && !err.code) err.code = "unlock_required";
    return { ok: false, error: err };
  }, []);

  const sendMessage = useCallback(async (matchId: string, payload: MessagePayload) => {
    const res = await sendMessageResult(matchId, payload);
    return res.ok ? res.data : null;
  }, [sendMessageResult]);

  const uploadMessageAttachment = useCallback(async (
    matchId: string,
    file: { fileName: string; contentType: string; fileBase64: string },
  ): Promise<{ attachmentPath: string; attachmentName: string; attachmentMime: string } | { error: string }> => {
    const res = await apiFetch<{ attachmentPath: string; attachmentName: string; attachmentMime: string }>(
      "/api/message-attachment-upload",
      { matchId, fileName: file.fileName, contentType: file.contentType, fileBase64: file.fileBase64 },
      { method: "POST" },
    );
    if (res.ok && res.data) return res.data;
    return { error: toApiError(res, "Upload failed").error };
  }, []);

  const flagMessage = useCallback(async (messageId: string, reason: string, note?: string): Promise<boolean> => {
    const res = await apiFetch<{ ok: boolean }>(
      "/api/flag-message",
      { messageId, reason, note },
      { method: "POST" },
    );
    return res.ok;
  }, []);

  const fetchMessageAttachmentUrl = useCallback(async (messageId: string): Promise<string | null> => {
    const res = await getWithRetry(`/api/message-attachment-url?messageId=${encodeURIComponent(messageId)}`);
    if (!res || !res.ok || !isRecord(res.data) || typeof res.data.url !== "string") return null;
    return res.data.url;
  }, []);

  // Memoized so consumers that put the context in an effect/callback dependency
  // list don't re-run on every provider render. Every function above is
  // referentially stable, so this only changes when real data does.
  const value = useMemo<EmployerDataContextValue>(() => ({
    companyStatus,
    companyStatusLoading,
    companyStatusError,
    companyLogoUrl,
    companyName,
    companyWebsite,
    companyGstin,
    companyBillingName,
    verificationTier,
    limits,
    suspended,
    deletionPending,
    requirements,
    requirementsLoading,
    requirementsError,
    refreshCompanyStatus,
    submitCompanyProfile,
    submitCompanyProfileResult,
    addRequirement,
    updateRequirement,
    createUnlockOrder,
    createUnlockOrderResult,
    verifyUnlockPayment,
    fetchRequirementDetail,
    prefetchRequirementDetail,
    archiveRequirement,
    archiveRequirementResult,
    restoreArchivedMatches,
    reopenRequirement,
    updateRequirementStage,
    updateCandidateStatus,
    updateCandidateStatusResult,
    fetchCandidateRequests, createCandidateRequest, cancelCandidateRequest,
    fetchCandidateEvidence,
    fetchCandidateResumeUrl,
    fetchRequirementActivity,
    fetchUnlockHistory,
    fetchCredit,
    fetchDashboard,
    refreshRequirements,
    listConversations,
    fetchMessages,
    sendMessage,
    sendMessageResult,
    uploadMessageAttachment,
    flagMessage,
    fetchMessageAttachmentUrl,
  }), [
    companyStatus, companyStatusLoading, companyStatusError, companyLogoUrl, companyName, companyWebsite, companyGstin, companyBillingName,
    verificationTier, limits, suspended, deletionPending, requirements, requirementsLoading, requirementsError,
    refreshCompanyStatus, submitCompanyProfile, submitCompanyProfileResult, addRequirement, updateRequirement,
    createUnlockOrder, createUnlockOrderResult, verifyUnlockPayment, fetchRequirementDetail, prefetchRequirementDetail, archiveRequirement, archiveRequirementResult, restoreArchivedMatches,
    reopenRequirement, updateRequirementStage, updateCandidateStatus, updateCandidateStatusResult,
    fetchCandidateRequests, createCandidateRequest, cancelCandidateRequest, fetchCandidateEvidence, fetchCandidateResumeUrl, fetchRequirementActivity, fetchUnlockHistory, fetchCredit, fetchDashboard, refreshRequirements, listConversations,
    fetchMessages, sendMessage, sendMessageResult, uploadMessageAttachment, flagMessage, fetchMessageAttachmentUrl,
  ]);

  return <EmployerDataContext.Provider value={value}>{children}</EmployerDataContext.Provider>;
}

export type { Requirement, RequirementSummary, Candidate, CandidateStatus, ArchiveDisposition };
