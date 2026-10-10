/* Status-preserving API calls for the employer requirement surfaces.

   EmployerDataContext's mutation helpers collapse every failure to
   `false`/`null`, which makes it impossible to tell "unlock required" (402)
   from "candidate declined" (409), "daily limit reached" (429) or "suspended"
   (403). These wrappers keep the HTTP status and the server's structured error
   body so each surface can show the right inline message. They hit the same
   endpoints with the same payloads; no API contract changes. */

import { apiFetch, type ApiResponse } from "@/apiClient";
import { authHeaders } from "@/supabase";
import type { CandidateEvidence, ConversationMessage, UnlockOrder } from "@/employer/EmployerDataContext";
import type { CandidateStatus } from "@/employer/mockData";
import { TIER_LIMITS, isEmployerTier, type EmployerTier } from "../../server-handlers/_employer-trust";

export interface CallFailure {
  ok: false;
  /** 0 means the request never reached the server (offline, blocked, aborted). */
  status: number;
  code: string | null;
  message: string | null;
  limit: number | null;
  tier: string | null;
  retryAfter: number | null;
}

export type CallResult<T> = { ok: true; data: T } | CallFailure;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function toFailure(status: number, body: unknown, fallbackMessage: string | null): CallFailure {
  const b: Record<string, unknown> = body && typeof body === "object" ? { ...body } : {};
  return {
    ok: false,
    status,
    code: str(b.code),
    message: str(b.error) ?? str(b.message) ?? fallbackMessage,
    limit: num(b.limit),
    tier: str(b.tier),
    retryAfter: num(b.retryAfter),
  };
}

function fromApi<T>(res: ApiResponse<T>): CallResult<T> {
  if (res.ok && res.data != null) return { ok: true, data: res.data };
  // A 2xx with no body is still a failure for every call below, which all return data.
  return toFailure(res.ok ? 502 : res.status, res.errorData, res.error);
}

async function getJson<T>(path: string): Promise<CallResult<T>> {
  try {
    const headers = await authHeaders();
    const res = await fetch(path, { headers });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && body != null) return { ok: true, data: body as T };
    return toFailure(res.ok ? 502 : res.status, body, null);
  } catch {
    return toFailure(0, null, "Network error");
  }
}

/* ── Calls ── */

export interface UnlockedCandidate {
  matchId: string;
  name: string;
  contact: { email: string };
}

export function createUnlockOrder(
  request: { mode: "single"; matchId: string } | { mode: "batch"; requirementId: string },
): Promise<CallResult<UnlockOrder>> {
  return apiFetch<UnlockOrder>("/api/employer-create-unlock-order", request, { method: "POST" }).then(fromApi);
}

export function verifyUnlockPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<CallResult<{ candidates: UnlockedCandidate[] }>> {
  return apiFetch<{ candidates: UnlockedCandidate[] }>("/api/employer-verify-unlock-payment", payload, { method: "POST" }).then(fromApi);
}

export function setCandidateStatus(
  matchId: string,
  payload: { candidateStatus: CandidateStatus; note?: string; interviewScheduledAt?: string },
): Promise<CallResult<{ id: string; candidateStatus: string }>> {
  return apiFetch<{ id: string; candidateStatus: string }>(
    "/api/employer-candidate-status",
    { matchId, ...payload },
    { method: "PATCH" },
  ).then(fromApi);
}

export function postMessage(
  matchId: string,
  payload: { body?: string; attachmentPath?: string; attachmentName?: string; attachmentMime?: string },
): Promise<CallResult<{ conversationId: string; message: ConversationMessage }>> {
  return apiFetch<{ conversationId: string; message: ConversationMessage }>(
    "/api/messages",
    { matchId, ...payload },
    { method: "POST" },
  ).then(fromApi);
}

export function postFlagMessage(messageId: string, reason: string): Promise<CallResult<{ ok: boolean }>> {
  return apiFetch<{ ok: boolean }>("/api/flag-message", { messageId, reason }, { method: "POST" }).then(fromApi);
}

/** Evidence payload. Before unlock the server sends `quotesLocked: true`,
    `unlocked: false` and an empty `quotes` array. */
export type EvidenceResponse = CandidateEvidence & { quotesLocked?: boolean; unlocked?: boolean };

export function getEvidence(matchId: string): Promise<CallResult<EvidenceResponse>> {
  return getJson<EvidenceResponse>(`/api/employer-candidate-evidence?matchId=${encodeURIComponent(matchId)}`);
}

export function getMessages(matchId: string): Promise<CallResult<{ messages: ConversationMessage[] }>> {
  return getJson<{ messages?: ConversationMessage[] }>(`/api/messages?matchId=${encodeURIComponent(matchId)}`).then((r) =>
    r.ok ? { ok: true as const, data: { messages: r.data.messages ?? [] } } : r,
  );
}

export interface EmployerProfileAccess {
  suspended: boolean;
  tier: EmployerTier | null;
  limits: { unlocksPerDay: number; openRequirements: number; rematchesPerHour: number } | null;
}

export async function getEmployerAccess(): Promise<CallResult<EmployerProfileAccess>> {
  const res = await getJson<Record<string, unknown>>("/api/employer-profile");
  if (!res.ok) return res;
  const tier = isEmployerTier(res.data.verificationTier) ? res.data.verificationTier : null;
  const rawLimits = res.data.limits;
  const l: Record<string, unknown> = rawLimits && typeof rawLimits === "object" ? { ...rawLimits } : {};
  const unlocksPerDay = num(l.unlocksPerDay);
  const openRequirements = num(l.openRequirements);
  const rematchesPerHour = num(l.rematchesPerHour);
  return {
    ok: true,
    data: {
      suspended: res.data.suspended === true,
      tier,
      limits:
        unlocksPerDay != null && openRequirements != null && rematchesPerHour != null
          ? { unlocksPerDay, openRequirements, rematchesPerHour }
          : null,
    },
  };
}

/* ── Failure copy ── */

export type FailureAction = "unlock" | "status" | "message" | "evidence";

const TIER_LABEL: Record<EmployerTier, string> = {
  basic: "Basic",
  email_verified: "Email-verified",
  verified: "Verified",
};

/** What verifying the company does, tailored to the tier it is on now. */
function verifyHint(tier: EmployerTier | null): string {
  if (tier === "verified") return "Your company is already fully verified, so please try again tomorrow.";
  if (tier === "email_verified") {
    return `Sign in with a work email that matches your company website to reach the Verified tier, which allows ${TIER_LIMITS.verified.unlocksPerDay} unlocks a day.`;
  }
  return `Verify your company by confirming a work email on your company domain: that raises the limit to ${TIER_LIMITS.email_verified.unlocksPerDay} unlocks a day, and matching your website raises it to ${TIER_LIMITS.verified.unlocksPerDay}.`;
}

const SUSPENDED_COPY = "Your employer account is suspended, so this action is turned off. Contact support@hirestepx.com.";

export function failureMessage(
  action: FailureAction,
  f: CallFailure,
  ctx: { tier?: EmployerTier | null; limit?: number | null } = {},
): string {
  if (f.status === 0) return "Couldn't reach HireStepX. Check your connection and try again.";
  if (f.status === 401) return "Your session has expired. Sign in again to continue.";

  if (f.status === 402) {
    const what =
      action === "message" ? "message this candidate" : action === "status" ? "move this candidate to interview or hired" : "do this";
    return `Unlock this candidate before you ${what}. Their name and contact details stay hidden until you do.`;
  }

  if (f.status === 403) {
    if (action === "unlock") {
      return f.message ?? "This candidate can't be unlocked right now. They may have withdrawn or blocked contact, or your employer account may be suspended. Contact support@hirestepx.com if you think this is a mistake.";
    }
    return f.message ?? SUSPENDED_COPY;
  }

  if (f.status === 409) {
    if (action === "unlock") return f.message ?? "This candidate is already unlocked or an order is in progress. Refresh the page to see the latest.";
    return f.message ?? "This candidate has declined, or their status can't change that way. Refresh the page to see the latest.";
  }

  if (f.status === 429) {
    if (action === "unlock" || f.limit != null) {
      const tier = isEmployerTier(f.tier) ? f.tier : ctx.tier ?? null;
      const limit = f.limit ?? ctx.limit ?? (tier ? TIER_LIMITS[tier].unlocksPerDay : null);
      const label = tier ? ` on the ${TIER_LABEL[tier]} tier` : "";
      const head = limit != null ? `You've reached today's limit of ${limit} unlocks${label}.` : "You've reached today's unlock limit.";
      return `${head} ${verifyHint(tier)}`;
    }
    return f.retryAfter ? `Too many requests. Wait ${f.retryAfter} seconds and try again.` : "Too many requests. Wait a moment and try again.";
  }

  if (f.status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return f.message ?? "Something went wrong. Please try again.";
}
