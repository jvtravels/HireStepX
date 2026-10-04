"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authHeaders } from "@/supabase";
import { apiFetch } from "@/apiClient";
import { RequirementSummary, Requirement, Candidate, RequirementStage, RequirementFormValues, CandidateStatus, ArchiveDisposition } from "./mockData";

/* Real backend layer for the employer console — see server-handlers/
   employer-profile.ts, employer-requirements.ts,
   employer-requirement-detail.ts, employer-create-unlock-order.ts,
   employer-verify-unlock-payment.ts and the "Employer talent-roster
   feature" block in supabase-schema.sql.

   Company profile submission is instantly approved (see handlePost in
   employer-profile.ts) — there's no review queue to wait on. "pending"
   stays in CompanyStatus only for any legacy row from before that change;
   the UI treats it the same as "none". "rejected" is still real: an admin
   can reject a profile after the fact from src/AdminDashboard.tsx
   ("Employers" tab) via server-handlers/admin-data.ts's
   "approve-employer"/"reject-employer" actions, which blocks posting via
   the status check in employer-requirements.ts. */

export type CompanyStatus = "none" | "pending" | "approved" | "rejected";

export interface UnlockOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  name: string;
  description: string;
}

/** A candidate's actual per-skill scores from their most recent completed
 *  practice session — mirrors EvidenceSkill in
 *  server-handlers/_employer-candidate-evidence-helpers.ts. Empty `skills`
 *  means no completed session has skill data yet, not a zero score.
 *  `quotes`/`readiness`/`starCompleteness` mirror the same file's
 *  EvidenceQuote / EvidenceReadiness / StarCompleteness — all `null`/empty
 *  when the session's report predates that data or has none to show. */
export interface CandidateEvidence {
  matchId: string;
  skills: Array<{ name: string; score: number }>;
  quotes: Array<{ kind: "win" | "redFlag"; text: string; quote: string }>;
  readiness: { band: "strongHire" | "hire" | "leanHire"; confidence: "low" | "medium" | "high" } | null;
  starCompleteness: { pct: number; questionsConsidered: number } | null;
  sessionDate: string | null;
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
}

interface EmployerDataContextValue {
  companyStatus: CompanyStatus;
  companyStatusLoading: boolean;
  companyLogoUrl: string | null;
  companyName: string;
  companyWebsite: string;
  requirements: RequirementSummary[];
  requirementsLoading: boolean;
  requirementsError: boolean;
  submitCompanyProfile: (fields: { companyName: string; website: string; logoBase64?: string; logoContentType?: string }) => Promise<boolean>;
  resetCompanyProfile: () => void;
  addRequirement: (r: RequirementFormValues) => Promise<string | null>;
  updateRequirement: (id: string, r: RequirementFormValues) => Promise<boolean>;
  createUnlockOrder: (request: { mode: "single"; matchId: string } | { mode: "batch"; requirementId: string }) => Promise<UnlockOrder | null>;
  verifyUnlockPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => Promise<{ candidates: Array<{ matchId: string; name: string; contact: { email: string } }> } | null>;
  fetchRequirementDetail: (id: string) => Promise<Requirement | null>;
  archiveRequirement: (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => Promise<boolean>;
  reopenRequirement: (id: string) => Promise<boolean>;
  updateRequirementStage: (id: string, stage: RequirementStage) => Promise<boolean>;
  updateCandidateStatus: (matchId: string, payload: { candidateStatus: CandidateStatus; note?: string; interviewScheduledAt?: string }) => Promise<boolean>;
  fetchCandidateEvidence: (matchId: string) => Promise<CandidateEvidence | null>;
  fetchRequirementActivity: (id: string) => Promise<RequirementActivity[] | null>;
  fetchUnlockHistory: () => Promise<UnlockPurchase[] | null>;
  refreshRequirements: () => Promise<void>;
}

const EmployerDataContext = createContext<EmployerDataContextValue | null>(null);

export function useEmployerData() {
  const ctx = useContext(EmployerDataContext);
  if (!ctx) throw new Error("useEmployerData must be used within EmployerDataProvider");
  return ctx;
}

export function EmployerDataProvider({ children }: { children: React.ReactNode }) {
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>("none");
  const [companyStatusLoading, setCompanyStatusLoading] = useState(true);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [requirementsError, setRequirementsError] = useState(false);

  const refreshCompanyStatus = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/employer-profile", { headers });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCompanyStatus(data.status as CompanyStatus);
        setCompanyLogoUrl(typeof data.logoUrl === "string" ? data.logoUrl : null);
        setCompanyName(typeof data.companyName === "string" ? data.companyName : "");
        setCompanyWebsite(typeof data.website === "string" ? data.website : "");
      }
    } catch {
      // network hiccup — keep last known status, next poll/refresh retries
    } finally {
      setCompanyStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCompanyStatus();
  }, [refreshCompanyStatus]);

  const refreshRequirements = useCallback(async () => {
    if (companyStatus !== "approved") return;
    setRequirementsLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/employer-requirements", { headers });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.requirements) {
        setRequirements(data.requirements);
        setRequirementsError(false);
      } else {
        // leave previous list in place on a transient failure, but surface it
        setRequirementsError(true);
      }
    } catch {
      // leave previous list in place on a transient failure, but surface it
      setRequirementsError(true);
    } finally {
      setRequirementsLoading(false);
    }
  }, [companyStatus]);

  useEffect(() => {
    refreshRequirements();
  }, [refreshRequirements]);

  const submitCompanyProfile = useCallback(async (fields: { companyName: string; website: string; logoBase64?: string; logoContentType?: string }) => {
    const res = await apiFetch<{ status: CompanyStatus; companyName?: string; website?: string; logoUrl?: string | null }>("/api/employer-profile", fields, { method: "POST" });
    if (res.ok && res.data) {
      setCompanyStatus(res.data.status);
      setCompanyLogoUrl(res.data.logoUrl ?? null);
      setCompanyName(res.data.companyName ?? fields.companyName);
      setCompanyWebsite(res.data.website ?? fields.website);
      return true;
    }
    return false;
  }, []);

  // Server-side status stays "rejected" until a real resubmission lands —
  // this just lets the client show the onboarding form again so the user
  // can resubmit via submitCompanyProfile, which instantly re-approves.
  const resetCompanyProfile = useCallback(() => setCompanyStatus("none"), []);

  const addRequirement = useCallback(async (r: RequirementFormValues) => {
    const res = await apiFetch<{ id: string }>("/api/employer-requirements", r, { method: "POST" });
    if (res.ok && res.data) {
      refreshRequirements();
      return res.data.id;
    }
    return null;
  }, [refreshRequirements]);

  const updateRequirement = useCallback(async (id: string, r: RequirementFormValues) => {
    const res = await apiFetch<{ id: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, r, { method: "PATCH" });
    if (res.ok && res.data) {
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements]);

  const createUnlockOrder = useCallback(async (
    request: { mode: "single"; matchId: string } | { mode: "batch"; requirementId: string },
  ) => {
    const res = await apiFetch<UnlockOrder>(
      "/api/employer-create-unlock-order",
      request,
      { method: "POST" },
    );
    if (res.ok && res.data) return res.data;
    return null;
  }, []);

  const verifyUnlockPayment = useCallback(async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const res = await apiFetch<{ candidates: Array<{ matchId: string; name: string; contact: { email: string } }> }>(
      "/api/employer-verify-unlock-payment",
      payload,
      { method: "POST" },
    );
    if (res.ok && res.data) return res.data;
    return null;
  }, []);

  const fetchRequirementDetail = useCallback(async (id: string): Promise<Requirement | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return null;
      return data as Requirement;
    } catch {
      return null;
    }
  }, []);

  const archiveRequirement = useCallback(async (id: string, options?: { archiveReason?: string; archiveDisposition?: ArchiveDisposition }) => {
    const res = await apiFetch<{ status: string }>(
      `/api/employer-requirement-detail?id=${encodeURIComponent(id)}`,
      { action: "archive", archiveReason: options?.archiveReason, archiveDisposition: options?.archiveDisposition },
      { method: "PATCH" },
    );
    if (res.ok) {
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements]);

  const reopenRequirement = useCallback(async (id: string) => {
    const res = await apiFetch<{ status: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { action: "reopen" }, { method: "PATCH" });
    if (res.ok) {
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements]);

  const updateRequirementStage = useCallback(async (id: string, stage: RequirementStage) => {
    const res = await apiFetch<{ stage: string }>(`/api/employer-requirement-detail?id=${encodeURIComponent(id)}`, { action: "set_stage", stage }, { method: "PATCH" });
    if (res.ok) {
      refreshRequirements();
      return true;
    }
    return false;
  }, [refreshRequirements]);

  const updateCandidateStatus = useCallback(async (
    matchId: string,
    payload: { candidateStatus: CandidateStatus; note?: string; interviewScheduledAt?: string },
  ) => {
    const res = await apiFetch<{ id: string; candidateStatus: string }>(
      "/api/employer-candidate-status",
      { matchId, candidateStatus: payload.candidateStatus, note: payload.note, interviewScheduledAt: payload.interviewScheduledAt },
      { method: "PATCH" },
    );
    return res.ok;
  }, []);

  const fetchCandidateEvidence = useCallback(async (matchId: string): Promise<CandidateEvidence | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/employer-candidate-evidence?matchId=${encodeURIComponent(matchId)}`, { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return null;
      return data as CandidateEvidence;
    } catch {
      return null;
    }
  }, []);

  const fetchRequirementActivity = useCallback(async (id: string): Promise<RequirementActivity[] | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/employer-requirement-activity?id=${encodeURIComponent(id)}`, { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.activity) return null;
      return data.activity as RequirementActivity[];
    } catch {
      return null;
    }
  }, []);

  const fetchUnlockHistory = useCallback(async (): Promise<UnlockPurchase[] | null> => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/employer-unlock-history", { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.purchases) return null;
      return data.purchases as UnlockPurchase[];
    } catch {
      return null;
    }
  }, []);

  const value: EmployerDataContextValue = {
    companyStatus,
    companyStatusLoading,
    companyLogoUrl,
    companyName,
    companyWebsite,
    requirements,
    requirementsLoading,
    requirementsError,
    submitCompanyProfile,
    resetCompanyProfile,
    addRequirement,
    updateRequirement,
    createUnlockOrder,
    verifyUnlockPayment,
    fetchRequirementDetail,
    archiveRequirement,
    reopenRequirement,
    updateRequirementStage,
    updateCandidateStatus,
    fetchCandidateEvidence,
    fetchRequirementActivity,
    fetchUnlockHistory,
    refreshRequirements,
  };

  return <EmployerDataContext.Provider value={value}>{children}</EmployerDataContext.Provider>;
}

export type { Requirement, RequirementSummary, Candidate, CandidateStatus, ArchiveDisposition };
